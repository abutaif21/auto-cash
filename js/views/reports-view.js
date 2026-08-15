import { db } from '../core/db.js';
import { exportDatabaseToJson, importDatabaseFromJson } from '../utils/backup-restore.js';
import { showToast, showConfirmDialog } from '../utils/ui-feedback.js';
import { showCustomAlert } from '../app.js';

export async function renderReportsView(container) {
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10);
  
  // التبويبات الثلاثة:
  // 'cash' = كشف الصندوق والكاش المالي (الدورة الحالية)
  // 'cars' = كشف حركة وحجز السيارات التشغيلي (مستمر وغير مقيد بالإقفال)
  // 'archive' = أرشيف الدورات المالية السابقة
  let activeTab = 'cash'; 
  let startDate = todayDateStr;
  let endDate = todayDateStr;
  let currentFilterLabel = 'اليوم';

  // فلترة كشف السيارات (الكل / موجودة بالموقف / غادرت)
  let carStatusFilter = 'all';

  // جلب تاريخ آخر إقفال مالي للحساب
  async function getLastClosureDate() {
    const closure = await db.settings.get('last_financial_closure');
    return closure ? closure.value : null;
  }

  function renderMainStructure() {
    container.innerHTML = `
      <div class="reports-main-wrapper">
        <div class="card no-print" style="margin-bottom: 12px; padding: 6px;">
          <div style="display: flex; gap: 4px;">
            <button id="tab-cash-btn" class="report-main-tab-btn ${activeTab === 'cash' ? 'active' : ''}">
              <i data-lucide="wallet" style="width: 15px;"></i> كشف الصندوق والكاش
            </button>
            <button id="tab-cars-btn" class="report-main-tab-btn ${activeTab === 'cars' ? 'active' : ''}">
              <i data-lucide="car" style="width: 15px;"></i> حركة وحجز السيارات
            </button>
            <button id="tab-archive-btn" class="report-main-tab-btn ${activeTab === 'archive' ? 'active' : ''}">
              <i data-lucide="archive" style="width: 15px;"></i> الأرشيف المالي
            </button>
          </div>
        </div>

        <div id="reports-dynamic-content"></div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    container.querySelector('#tab-cash-btn').onclick = () => {
      activeTab = 'cash';
      renderMainStructure();
      loadCashReport();
    };

    container.querySelector('#tab-cars-btn').onclick = () => {
      activeTab = 'cars';
      renderMainStructure();
      loadCarsOperationalReport();
    };

    container.querySelector('#tab-archive-btn').onclick = () => {
      activeTab = 'archive';
      renderMainStructure();
      loadArchiveReport();
    };

    if (activeTab === 'cash') loadCashReport();
    else if (activeTab === 'cars') loadCarsOperationalReport();
    else if (activeTab === 'archive') loadArchiveReport();
  }

  // ========================================================
  // 1. كشف الصندوق والكاش المالي (خاضع للإقفال والترحيل)
  // ========================================================
  async function loadCashReport() {
    const contentArea = container.querySelector('#reports-dynamic-content');
    if (!contentArea) return;

    const lastClosure = await getLastClosureDate();
    const allCars = await db.cars.toArray();
    const allTransactions = await db.transactions.toArray();

    // 1. حساب الرصيد الافتتاحي المرحّل قبل بداية تاريخ الفلترة (مع مراعاة آخر إقفال)
    let carriedOverBalance = 0;

    allCars.forEach(car => {
      if (car.entryDate) {
        const cDate = car.entryDate.slice(0, 10);
        if ((!lastClosure || cDate > lastClosure) && cDate < startDate) {
          carriedOverBalance += Number(car.price || 0);
        }
      }
    });

    allTransactions.forEach(tx => {
      if (tx.date) {
        const tDate = tx.date.slice(0, 10);
        if ((!lastClosure || tDate > lastClosure) && tDate < startDate) {
          const amt = Number(tx.amount || 0);
          if (tx.type === 'دخل') carriedOverBalance += amt;
          else if (tx.type === 'مصروف' || tx.type === 'سحب') carriedOverBalance -= amt;
        }
      }
    });

    // 2. تصفية العمليات النقدية للفترة المحددة
    const filteredTransactions = allTransactions.filter(t => {
      if (!t.date) return false;
      const tDate = t.date.slice(0, 10);
      if (lastClosure && tDate <= lastClosure) return false;
      return tDate >= startDate && tDate <= endDate;
    });

    // تحصيل السيارات النقدية خلال هذه الفترة
    const currentPeriodCars = allCars.filter(c => {
      if (!c.entryDate) return false;
      const cDate = c.entryDate.slice(0, 10);
      if (lastClosure && cDate <= lastClosure) return false;
      return cDate >= startDate && cDate <= endDate;
    });

    let dayCarIncome = 0;
    currentPeriodCars.forEach(c => dayCarIncome += Number(c.price || 0));

    let dayOtherIncome = 0;
    let dayExpense = 0;
    let dayWithdrawal = 0;

    const incomeByCategory = { 'تحصيل سيارات': dayCarIncome };
    const expenseByCategory = {};

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount || 0);
      const sub = t.subtype || t.subType || 'عام';
      if (t.type === 'دخل') {
        dayOtherIncome += amt;
        incomeByCategory[sub] = (incomeByCategory[sub] || 0) + amt;
      } else if (t.type === 'مصروف') {
        dayExpense += amt;
        expenseByCategory[sub] = (expenseByCategory[sub] || 0) + amt;
      } else if (t.type === 'سحب') {
        dayWithdrawal += amt;
        expenseByCategory[`سحب (${sub})`] = (expenseByCategory[`سحب (${sub})`] || 0) + amt;
      }
    });

    const totalIncome = dayCarIncome + dayOtherIncome;
    const totalOutflow = dayExpense + dayWithdrawal;
    const periodSurplus = totalIncome - totalOutflow;
    const finalRemaining = carriedOverBalance + periodSurplus;

    contentArea.innerHTML = `
      <div class="detailed-report-wrapper">
        
        <div class="card no-print" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h2 style="font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="filter" style="width: 16px; color: var(--primary);"></i> فلترة حركة الصندوق والكاش
            </h2>
            <div style="display: flex; gap: 6px;">
              <button id="close-period-btn" style="background: var(--warning-light); color: var(--warning); border: 1px solid var(--warning); padding: 7px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="lock" style="width: 14px;"></i> إقفال الحساب
              </button>
              <button id="print-cash-btn" style="background: var(--primary); color: white; border: none; padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="printer" style="width: 14px;"></i> طباعة A4
              </button>
            </div>
          </div>

          <div style="display: flex; gap: 6px; margin-bottom: 10px;">
            <button class="date-filter-btn ${currentFilterLabel === 'اليوم' ? 'active' : ''}" data-range="today">اليوم</button>
            <button class="date-filter-btn ${currentFilterLabel === '7 أيام' ? 'active' : ''}" data-range="week">7 أيام</button>
            <button class="date-filter-btn ${currentFilterLabel === 'هذا الشهر' ? 'active' : ''}" data-range="month">هذا الشهر</button>
            <button class="date-filter-btn ${currentFilterLabel === 'الكل' ? 'active' : ''}" data-range="all">الكل</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">من تاريخ:</label>
              <button type="button" id="btn-start-date" class="date-selector-btn">
                <span>${startDate}</span>
                <i data-lucide="calendar" style="width: 14px; color: var(--primary);"></i>
              </button>
            </div>
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">إلى تاريخ:</label>
              <button type="button" id="btn-end-date" class="date-selector-btn">
                <span>${endDate}</span>
                <i data-lucide="calendar" style="width: 14px; color: var(--primary);"></i>
              </button>
            </div>
          </div>

          ${lastClosure ? `
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px; background: var(--bg-main); padding: 6px 10px; border-radius: 6px; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="shield-check" style="width: 14px; color: var(--primary);"></i> تم آخر إقفال بتاريخ: <b>${lastClosure}</b> (الكاش المعروض للدورة الحالية فقط)
            </div>
          ` : ''}
        </div>

        <div class="print-page">
          <div class="report-header">
            <div style="text-align: right;">
              <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">Auto Cash | كشف حركة الصندوق والتدفق المالي</h1>
              <div style="font-size: 11px; color: #64748b;">الفترة: <b>${startDate === endDate ? `يوم (${startDate})` : `من ${startDate} إلى ${endDate}`}</b></div>
            </div>
            <div style="text-align: left; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; background: #f8fafc; font-size: 11px;">
              <div>النوع: <b>كشف حساب نقدي</b></div>
              <div style="color: #64748b;">تاريخ الطباعة: ${todayDateStr}</div>
            </div>
          </div>

          <div class="financial-summary-grid">
            <div class="sum-box bg-slate">
              <span class="sum-title">الرصيد الافتتاحي المرحّل</span>
              <span class="sum-val ${carriedOverBalance >= 0 ? 'text-primary' : 'text-danger'}">${carriedOverBalance.toLocaleString()} ريال</span>
            </div>
            <div class="sum-box bg-emerald">
              <span class="sum-title">إجمالي المقبوضات النقدي (+)</span>
              <span class="sum-val text-emerald">${totalIncome.toLocaleString()} ريال</span>
            </div>
            <div class="sum-box bg-rose">
              <span class="sum-title">إجمالي المصروفات والسحب (-)</span>
              <span class="sum-val text-danger">${totalOutflow.toLocaleString()} ريال</span>
            </div>
            <div class="sum-box bg-blue">
              <span class="sum-title">صافي الرصيد الختامي للصندوق</span>
              <span class="sum-val text-blue">${finalRemaining.toLocaleString()} ريال</span>
            </div>
          </div>

          <div class="section-title">
            <span>💸 العمليات والمصروفات النقدية المسجلة</span>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>النوع</th>
                <th>التصنيف</th>
                <th>التاريخ والوقت</th>
                <th>البيان / الملاحظة</th>
                <th>المبلغ (ريال)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.length === 0 
                ? `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 12px;">لا توجد عمليات كاش أو مصروفات مسجلة في هذا النطاق</td></tr>`
                : filteredTransactions.map((t, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><span class="status-tag ${t.type === 'دخل' ? 'tag-done' : (t.type === 'سحب' ? 'tag-warn' : 'tag-danger')}">${t.type}</span></td>
                    <td style="font-weight: 700;">${t.subtype || t.subType || 'عام'}</td>
                    <td>${t.date ? t.date.replace('T', ' ').slice(0, 16) : '-'}</td>
                    <td>${t.note || '-'}</td>
                    <td style="font-weight: 700; ${t.type === 'دخل' ? 'color: #047857;' : 'color: #b91c1c;'}">
                      ${t.type === 'دخل' ? '+' : '-'}${Number(t.amount || 0).toLocaleString()}
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="text-align: left; font-weight: 800;">إجمالي المصروفات والمسحوبات:</td>
                <td style="font-weight: 800; color: #b91c1c;">${totalOutflow > 0 ? '-' : ''}${totalOutflow.toLocaleString()} ريال</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-breakdown-grid">
            <div class="breakdown-card">
              <div class="breakdown-header">تفصيل الإيرادات المقبوضة (+)</div>
              ${Object.entries(incomeByCategory).map(([k, v]) => `
                <div class="breakdown-row"><span>${k}</span><b>${v.toLocaleString()} ريال</b></div>
              `).join('')}
              <div class="breakdown-total"><span>إجمالي الإيرادات:</span><span>${totalIncome.toLocaleString()} ريال</span></div>
            </div>

            <div class="breakdown-card">
              <div class="breakdown-header">تفصيل المصروفات والخرج (-)</div>
              ${Object.keys(expenseByCategory).length === 0 
                ? `<div style="font-size: 11px; color: #64748b; padding: 6px;">لا توجد مصروفات</div>`
                : Object.entries(expenseByCategory).map(([k, v]) => `
                  <div class="breakdown-row"><span>${k}</span><b>${v.toLocaleString()} ريال</b></div>
                `).join('')
              }
              <div class="breakdown-total" style="color: #b91c1c;"><span>إجمالي الخرج:</span><span>${totalOutflow.toLocaleString()} ريال</span></div>
            </div>
          </div>

          <div class="report-signatures">
            <div><span>أمين الصندوق / المستلم:</span><div class="signature-line"></div></div>
            <div><span>المعتمد / الإدارة:</span><div class="signature-line"></div></div>
          </div>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    attachCashEvents(filteredTransactions, finalRemaining, totalIncome, totalOutflow);
  }

  // ========================================================
  // 2. كشف حركة وحجز السيارات (سجل تشغيلي مستمر بدون إقفال)
  // ========================================================
  async function loadCarsOperationalReport() {
    const contentArea = container.querySelector('#reports-dynamic-content');
    if (!contentArea) return;

    const allCars = await db.cars.toArray();

    // تصفية السيارات بناءً على النطاق الزمني وحالة السيارة (دون أي ربط بإقفال الكاش)
    const filteredCars = allCars.filter(c => {
      if (!c.entryDate) return false;
      const cDate = c.entryDate.slice(0, 10);
      
      const inDateRange = (startDate === '2024-01-01' && endDate === '2032-12-31') ? true : (cDate >= startDate && cDate <= endDate);
      
      if (carStatusFilter === 'inside') {
        return c.status === 'موجودة';
      } else if (carStatusFilter === 'exited') {
        return c.status === 'خرجت' && inDateRange;
      }
      return inDateRange;
    });

    const totalCarsInside = allCars.filter(c => c.status === 'موجودة').length;
    const totalCarsExited = allCars.filter(c => c.status === 'خرجت').length;
    let expectedRevenue = 0;
    filteredCars.forEach(c => expectedRevenue += Number(c.price || 0));

    contentArea.innerHTML = `
      <div class="cars-report-wrapper">
        
        <div class="card no-print" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h2 style="font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="car" style="width: 16px; color: var(--primary);"></i> تصفية سجل حركة وحجز السيارات
            </h2>
            <button id="print-cars-btn" style="background: var(--primary); color: white; border: none; padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <i data-lucide="printer" style="width: 14px;"></i> طباعة كشف الحجز A4
            </button>
          </div>

          <div style="display: flex; gap: 6px; margin-bottom: 10px;">
            <button class="car-status-filter-btn ${carStatusFilter === 'all' ? 'active' : ''}" data-status="all">كافة الحركات</button>
            <button class="car-status-filter-btn ${carStatusFilter === 'inside' ? 'active' : ''}" data-status="inside">المحجوزة حالياً (${totalCarsInside})</button>
            <button class="car-status-filter-btn ${carStatusFilter === 'exited' ? 'active' : ''}" data-status="exited">التي غادرت</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">تاريخ الدخول من:</label>
              <button type="button" id="btn-cars-start-date" class="date-selector-btn">
                <span>${startDate}</span>
                <i data-lucide="calendar" style="width: 14px; color: var(--primary);"></i>
              </button>
            </div>
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">إلى تاريخ:</label>
              <button type="button" id="btn-cars-end-date" class="date-selector-btn">
                <span>${endDate}</span>
                <i data-lucide="calendar" style="width: 14px; color: var(--primary);"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="print-page">
          <div class="report-header">
            <div style="text-align: right;">
              <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">Auto Cash | كشف وسجل حركة حجز السيارات التشغيلي</h1>
              <div style="font-size: 11px; color: #64748b;">الحالة المعروضة: <b>${carStatusFilter === 'inside' ? 'السيارات المحجوزة بالموقف حالياً' : (carStatusFilter === 'exited' ? 'السيارات المغادرة' : 'كافة حركات الدخول')}</b></div>
            </div>
            <div style="text-align: left; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; background: #f8fafc; font-size: 11px;">
              <div>العدد: <b>${filteredCars.length} سيارة</b></div>
              <div style="color: #64748b;">تاريخ الكشف: ${todayDateStr}</div>
            </div>
          </div>

          <div class="financial-summary-grid">
            <div class="sum-box bg-slate">
              <span class="sum-title">إجمالي السيارات المعروضة</span>
              <span class="sum-val text-primary">${filteredCars.length} سيارة</span>
            </div>
            <div class="sum-box bg-emerald">
              <span class="sum-title">السيارات الموجودة حالياً</span>
              <span class="sum-val text-emerald">${totalCarsInside} سيارة</span>
            </div>
            <div class="sum-box bg-blue">
              <span class="sum-title">السيارات التي غادرت</span>
              <span class="sum-val text-blue">${totalCarsExited} سيارة</span>
            </div>
            <div class="sum-box bg-rose">
              <span class="sum-title">إجمالي المبالغ والرسوم</span>
              <span class="sum-val text-danger">${expectedRevenue.toLocaleString()} ريال</span>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>نوع السيارة</th>
                <th>رقم اللوحة</th>
                <th>المربع</th>
                <th>تاريخ الدخول</th>
                <th>تاريخ الخروج</th>
                <th>المبلغ (ريال)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCars.length === 0 
                ? `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 14px;">لا توجد سيارات مسجلة تطابق خيارات البحث</td></tr>`
                : filteredCars.map((c, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td style="font-weight: 700;">${c.carType || '-'}</td>
                    <td style="font-weight: 700;">${c.plateNumber || '-'}</td>
                    <td>${c.boxNumber || '-'}</td>
                    <td>${c.entryDate ? c.entryDate.replace('T', ' ').slice(0, 16) : '-'}</td>
                    <td>${c.exitDate ? c.exitDate.replace('T', ' ').slice(0, 16) : '<span style="color:#64748b;">(مستمرة بالحجز)</span>'}</td>
                    <td style="font-weight: 700; color: #047857;">${Number(c.price || 0).toLocaleString()}</td>
                  </tr>
                `).join('')
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7" style="text-align: left; font-weight: 800;">إجمالي رسوم السيارات المحسوبة:</td>
                <td style="font-weight: 800; color: #047857;">${expectedRevenue.toLocaleString()} ريال</td>
              </tr>
            </tfoot>
          </table>

          
    `;

    if (window.lucide) window.lucide.createIcons();
    attachCarsReportEvents();
  }
  // ========================================================
  // 3. أرشيف الدورات المالية السابقة واستعراض تفاصيلها
  // ========================================================
  async function loadArchiveReport() {
    const contentArea = container.querySelector('#reports-dynamic-content');
    if (!contentArea) return;

    const periods = await db.financial_periods.reverse().toArray();

    contentArea.innerHTML = `
      <div class="archive-report-wrapper">
        <div class="card no-print" style="margin-bottom: 14px;">
          <h2 style="font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <i data-lucide="archive" style="width: 18px; color: var(--primary);"></i> أرشيف الدورات المالية المقفلة
          </h2>
          <p style="font-size: 11px; color: var(--text-muted);">
            سجل تاريخي كامل لكافة الحسابات والدورات المقفلة مسبقاً مع إمكانية استعراضها وطباعتها بأي وقت.
          </p>
        </div>

        ${periods.length === 0 ? `
          <div class="card" style="text-align: center; padding: 30px 16px; color: var(--text-muted);">
            <i data-lucide="folder-open" style="width: 36px; height: 36px; margin-bottom: 8px; opacity: 0.5;"></i>
            <div style="font-size: 13px; font-weight: 700;">لا توجد دورات مالية مقفلة في الأرشيف حتى الآن</div>
            <div style="font-size: 11px; margin-top: 4px;">عند قيامك بإقفال الحساب في كشف الصندوق، سيتم حفظ نسخة مؤرشفة هنا تلقائياً.</div>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${periods.map((p, idx) => `
              <div class="card" style="margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 14px;">
                <div>
                  <div style="font-size: 13px; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="calendar" style="width: 14px; color: var(--primary);"></i>
                    ${p.periodName || `دورة مالية مقفلة #${periods.length - idx}`}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                    تاريخ الإقفال: <b>${p.endDate || (p.closureDate ? p.closureDate.slice(0, 10) : '-')}</b> | 
                    النوع: <span style="font-weight: 700; color: ${p.closureType === 'ترحيل_الفائض' ? 'var(--primary-dark)' : 'var(--danger)'};">${p.closureType === 'ترحيل_الفائض' ? 'ترحيل الفائض' : 'تسوية وتصفير'}</span>
                  </div>
                  <div style="font-size: 12px; font-weight: 800; color: var(--primary-dark); margin-top: 4px;">
                    صافي الفائض: ${(p.surplus || 0).toLocaleString()} ريال
                  </div>
                </div>
                <div>
                  <button class="view-archive-detail-btn" data-id="${p.id}" style="background: var(--primary-light); color: var(--primary-dark); border: 1px solid var(--primary); padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i data-lucide="eye" style="width: 14px;"></i> عرض وطباعة
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // ربط أزرار استعراض تفاصيل الدورة المؤرشفة
    contentArea.querySelectorAll('.view-archive-detail-btn').forEach(btn => {
      btn.onclick = async () => {
        const pId = parseInt(btn.getAttribute('data-id'));
        const periodRecord = await db.financial_periods.get(pId);
        if (periodRecord) openArchiveModal(periodRecord);
      };
    });
  }

  // نافذة استعراض الدورة المؤرشفة المنبثقة
  function openArchiveModal(period) {
    const modal = document.getElementById('archive-view-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('archive-modal-title');
    const modalBody = document.getElementById('archive-modal-body');
    const closeBtn = document.getElementById('close-archive-modal-btn');
    const dismissBtn = document.getElementById('dismiss-archive-modal-btn');
    const printBtn = document.getElementById('print-archive-record-btn');

    modalTitle.innerHTML = `<i data-lucide="archive" style="width: 18px; color: var(--primary);"></i> ${period.periodName || 'تفاصيل الدورة المؤرشفة'}`;

    modalBody.innerHTML = `
      <div style="background: var(--bg-main); padding: 12px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">تاريخ الإقفال:</span>
          <b>${period.endDate || (period.closureDate ? period.closureDate.slice(0, 10) : '-')}</b>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">نوع الإقفال:</span>
          <b style="color: ${period.closureType === 'ترحيل_الفائض' ? 'var(--primary-dark)' : 'var(--danger)'};">${period.closureType === 'ترحيل_الفائض' ? 'إقفال مع ترحيل الفائض' : 'إقفال مع التسوية (تصفير)'}</b>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">إجمالي الإيرادات المقبوضة:</span>
          <b style="color: #047857;">${(period.totalIncome || 0).toLocaleString()} ريال</b>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">إجمالي المصروفات والسحب:</span>
          <b style="color: #b91c1c;">${(period.totalExpense || 0).toLocaleString()} ريال</b>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 6px;">
          <span style="font-weight: 800;">صافي الفائض المرحل:</span>
          <b style="color: var(--primary-dark); font-size: 14px;">${(period.surplus || 0).toLocaleString()} ريال</b>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();

    const hide = () => { modal.style.display = 'none'; };
    closeBtn.onclick = hide;
    dismissBtn.onclick = hide;

    printBtn.onclick = () => {
      window.print();
    };
  }

  // ========================================================
  // 4. نافذة اختيار التاريخ المنفصلة
  // ========================================================
  function openCustomDatePicker(targetType, onAppliedCallback) {
    const modal = document.getElementById('date-picker-modal');
    if (!modal) return;
    const title = document.getElementById('date-picker-title');
    const daySelect = document.getElementById('dp-day');
    const monthSelect = document.getElementById('dp-month');
    const yearSelect = document.getElementById('dp-year');

    title.textContent = targetType === 'start' ? 'تحديد تاريخ البداية (من)' : 'تحديد تاريخ النهاية (إلى)';
    const currentVal = targetType === 'start' ? startDate : endDate;
    const [cYear, cMonth, cDay] = currentVal.split('-').map(Number);

    yearSelect.innerHTML = '';
    for (let y = 2024; y <= 2032; y++) {
      yearSelect.innerHTML += `<option value="${y}" ${y === cYear ? 'selected' : ''}>${y}</option>`;
    }

    monthSelect.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      monthSelect.innerHTML += `<option value="${m}" ${m === cMonth ? 'selected' : ''}>${String(m).padStart(2, '0')}</option>`;
    }

    function populateDays() {
      const selectedYear = parseInt(yearSelect.value);
      const selectedMonth = parseInt(monthSelect.value);
      const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
      const prevSelectedDay = parseInt(daySelect.value) || cDay;

      daySelect.innerHTML = '';
      for (let d = 1; d <= totalDays; d++) {
        daySelect.innerHTML += `<option value="${d}" ${d === Math.min(prevSelectedDay, totalDays) ? 'selected' : ''}>${String(d).padStart(2, '0')}</option>`;
      }
    }

    yearSelect.onchange = populateDays;
    monthSelect.onchange = populateDays;
    populateDays();

    modal.style.display = 'flex';

    document.getElementById('dp-cancel-btn').onclick = () => modal.style.display = 'none';

    document.getElementById('dp-apply-btn').onclick = () => {
      const y = yearSelect.value;
      const m = String(monthSelect.value).padStart(2, '0');
      const d = String(daySelect.value).padStart(2, '0');
      const formatted = `${y}-${m}-${d}`;

      if (targetType === 'start') startDate = formatted;
      else endDate = formatted;

      currentFilterLabel = 'مخصص';
      modal.style.display = 'none';
      if (onAppliedCallback) onAppliedCallback();
    };
  }

  // ========================================================
  // 5. ربط أحداث كشف الصندوق والكاش
  // ========================================================
  function attachCashEvents(filteredTransactions, finalRemaining, totalIncome, totalOutflow) {
    container.querySelector('#btn-start-date').onclick = () => openCustomDatePicker('start', loadCashReport);
    container.querySelector('#btn-end-date').onclick = () => openCustomDatePicker('end', loadCashReport);
    container.querySelector('#print-cash-btn').onclick = () => window.print();

    // أزرار الفلترة السريعة
    container.querySelectorAll('.date-filter-btn').forEach(btn => {
      btn.onclick = () => {
        const range = btn.getAttribute('data-range');
        const d = new Date();

        if (range === 'today') {
          startDate = d.toISOString().slice(0, 10);
          endDate = d.toISOString().slice(0, 10);
          currentFilterLabel = 'اليوم';
        } else if (range === 'week') {
          const past = new Date();
          past.setDate(d.getDate() - 7);
          startDate = past.toISOString().slice(0, 10);
          endDate = d.toISOString().slice(0, 10);
          currentFilterLabel = '7 أيام';
        } else if (range === 'month') {
          const year = d.getFullYear();
          const month = d.getMonth();
          const lastDayNum = new Date(year, month + 1, 0).getDate();
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
          currentFilterLabel = 'هذا الشهر';
        } else if (range === 'all') {
          startDate = '2024-01-01';
          endDate = '2032-12-31';
          currentFilterLabel = 'الكل';
        }
        loadCashReport();
      };
    });

    // 🔒 فتح نافذة إقفال الحساب وتسمية الدورة
    const closePeriodBtn = container.querySelector('#close-period-btn');
    if (closePeriodBtn) {
      closePeriodBtn.onclick = () => {
        const closureModal = document.getElementById('close-period-modal');
        const surplusLabel = document.getElementById('closure-surplus-amount');
        const nameInput = document.getElementById('closure-period-name-input');
        const closeX = document.getElementById('close-period-modal-x');
        const cancelBtn = document.getElementById('closure-cancel-btn');
        const carryOverBtn = document.getElementById('closure-carry-over-btn');
        const settleZeroBtn = document.getElementById('closure-settle-zero-btn');

        if (!closureModal) return;

        surplusLabel.textContent = `${finalRemaining.toLocaleString()} ريال`;
        if (nameInput) nameInput.value = '';
        closureModal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();

        const hideClosureModal = () => { closureModal.style.display = 'none'; };
        closeX.onclick = hideClosureModal;
        cancelBtn.onclick = hideClosureModal;

        // 1. إقفال مع ترحيل الفائض
        carryOverBtn.onclick = async () => {
          const periodCustomName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `دورة حساب (${todayDateStr})`;
          hideClosureModal();
          showConfirmDialog({
            title: 'تأكيد ترحيل الفائض',
            message: `سيتم إقفال الدورة وتسميتها [${periodCustomName}] وترحيل مبلغ (${finalRemaining.toLocaleString()} ريال) كرصيد بداية للدورة القادمة. هل ترغب بالمتابعة؟`,
            onConfirm: async () => {
              await db.financial_periods.add({
                periodName: periodCustomName,
                endDate: todayDateStr,
                closureDate: new Date().toISOString(),
                closureType: 'ترحيل_الفائض',
                totalIncome: totalIncome,
                totalExpense: totalOutflow,
                surplus: finalRemaining,
                finalBalance: finalRemaining
              });
              await db.settings.put({ key: 'last_financial_closure', value: todayDateStr });
              showCustomAlert('تم الإقفال بنجاح', `تم إقفال الدورة وترحيل مبلغ ${finalRemaining.toLocaleString()} ريال وحفظها في الأرشيف المالي.`, 'success');
              startDate = todayDateStr;
              endDate = todayDateStr;
              currentFilterLabel = 'اليوم';
              loadCashReport();
            }
          });
        };

        // 2. إقفال مع التسوية والتصفير
        settleZeroBtn.onclick = async () => {
          const periodCustomName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `دورة حساب (${todayDateStr})`;
          hideClosureModal();
          showConfirmDialog({
            title: 'تأكيد التسوية والتصفير',
            message: `سيتم تسجيل سحب/تصفية لكامل الفائض (${finalRemaining.toLocaleString()} ريال) وتصفير الرصيد للدورة القادمة. هل ترغب بالمتابعة؟`,
            onConfirm: async () => {
              if (finalRemaining > 0) {
                await db.transactions.add({
                  type: 'سحب',
                  subtype: 'تسوية إقفال الفترة',
                  subType: 'تسوية إقفال الفترة',
                  amount: finalRemaining,
                  date: new Date().toISOString(),
                  note: `تسوية وتصفير الفائض لإقفال الدورة [${periodCustomName}]`
                });
              }
              await db.financial_periods.add({
                periodName: periodCustomName,
                endDate: todayDateStr,
                closureDate: new Date().toISOString(),
                closureType: 'تسوية_تصفير',
                totalIncome: totalIncome,
                totalExpense: totalOutflow + (finalRemaining > 0 ? finalRemaining : 0),
                surplus: 0,
                finalBalance: 0
              });
              await db.settings.put({ key: 'last_financial_closure', value: todayDateStr });
              showCustomAlert('تمت التسوية والإقفال', 'تم تصفية الرصيد وبدء دورة كاش جديدة برصيد 0 ريال مع حفظ السجل بالأرشيف.', 'success');
              startDate = todayDateStr;
              endDate = todayDateStr;
              currentFilterLabel = 'اليوم';
              loadCashReport();
            }
          });
        };
      };
    }
  }

  // ========================================================
  // 6. ربط أحداث كشف حركة وحجز السيارات
  // ========================================================
  function attachCarsReportEvents() {
    container.querySelector('#btn-cars-start-date').onclick = () => openCustomDatePicker('start', loadCarsOperationalReport);
    container.querySelector('#btn-cars-end-date').onclick = () => openCustomDatePicker('end', loadCarsOperationalReport);
    container.querySelector('#print-cars-btn').onclick = () => window.print();

    container.querySelectorAll('.car-status-filter-btn').forEach(btn => {
      btn.onclick = () => {
        carStatusFilter = btn.getAttribute('data-status');
        loadCarsOperationalReport();
      };
    });
  }

  // تنسيقات أزرار التبويبات والكشوفات
  const customStyles = `
    .report-main-tab-btn {
      flex: 1; padding: 9px 6px; border-radius: 8px; border: none; font-size: 12px;
      font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 5px; background: transparent; color: var(--text-muted); transition: all 0.2s;
    }
    .report-main-tab-btn.active {
      background: var(--primary); color: white; box-shadow: var(--shadow-sm);
    }
    .car-status-filter-btn {
      flex: 1; padding: 7px; border: 1px solid var(--border); background: var(--bg-main);
      border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; color: var(--text-main);
    }
    .car-status-filter-btn.active {
      background: var(--primary); color: white; border-color: var(--primary);
    }
    .date-filter-btn {
      flex: 1; padding: 7px; border: 1px solid var(--border); background: var(--bg-main);
      border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; color: var(--text-main);
    }
    .date-filter-btn.active {
      background: var(--primary); color: white; border-color: var(--primary);
    }
    .date-selector-btn {
      width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
      font-size: 12px; font-weight: 700; background: var(--bg-main); cursor: pointer;
      display: flex; align-items: center; justify-content: space-between;
    }
  `;
  if (!document.getElementById('reports-custom-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'reports-custom-styles';
    styleEl.textContent = customStyles;
    document.head.appendChild(styleEl);
  }

  renderMainStructure();
}
