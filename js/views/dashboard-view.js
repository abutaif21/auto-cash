import { db } from '../core/db.js';

export async function renderDashboardView(container, onNavigate) {
  // 1. التأكد من فتح قاعدة البيانات وجلب البيانات بشكل غير متزامن
  if (!db.isOpen()) {
    await db.open();
  }

  const [cars, transactions] = await Promise.all([
    db.cars.toArray(),
    db.transactions.toArray()
  ]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let totalIncome = 0;
  let totalExpense = 0;
  let totalWithdraw = 0;
  let todayExpense = 0;
  let fuelExpense = 0;
  let carIncome = 0;

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'دخل') {
      totalIncome += amt;
      if (t.subType === 'سيارات' || t.subtype === 'سيارات') carIncome += amt;
    } else if (t.type === 'مصروف') {
      totalExpense += amt;
      if (t.date && t.date.startsWith(todayStr)) todayExpense += amt;
      if (t.subType === 'بنزين' || t.subtype === 'بنزين') fuelExpense += amt;
    } else if (t.type === 'سحب') {
      totalWithdraw += amt;
    }
  });

  const netCash = totalIncome - totalExpense - totalWithdraw;
  const activeCars = cars.filter(c => c.status === 'موجودة').length;
  const exitedCars = cars.filter(c => c.status === 'خرجت').length;

  // 2. بناء عناصر الواجهة
  container.innerHTML = `
    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 22px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.35); position: relative; overflow: hidden; margin-bottom: 16px;">
      <div style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); opacity: 0.15;">
        <i data-lucide="banknote" style="width: 90px; height: 90px;"></i>
      </div>
      <div style="font-size: 13px; font-weight: 600; opacity: 0.9; display: flex; align-items: center; gap: 6px;">
        <i data-lucide="circle-dot" style="width: 14px; height: 14px;"></i> الكاش الحالي
      </div>
      <div style="font-size: 34px; font-weight: 800; margin-top: 4px; letter-spacing: -0.5px;">
        ${netCash.toLocaleString()} <span style="font-size: 16px; font-weight: 600;">ريال</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
      <div class="card" style="margin: 0; text-align: center; padding: 12px 6px;">
        <div style="color: var(--primary); display: flex; justify-content: center; margin-bottom: 4px;">
          <i data-lucide="arrow-down-circle" style="width: 20px; height: 20px;"></i>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">الدخل</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--primary); margin-top: 2px;">${totalIncome.toLocaleString()}</div>
      </div>

      <div class="card" style="margin: 0; text-align: center; padding: 12px 6px;">
        <div style="color: var(--danger); display: flex; justify-content: center; margin-bottom: 4px;">
          <i data-lucide="arrow-up-circle" style="width: 20px; height: 20px;"></i>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">المصروف</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--danger); margin-top: 2px;">${totalExpense.toLocaleString()}</div>
      </div>

      <div class="card" style="margin: 0; text-align: center; padding: 12px 6px;">
        <div style="color: var(--info); display: flex; justify-content: center; margin-bottom: 4px;">
          <i data-lucide="credit-card" style="width: 20px; height: 20px;"></i>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">السحب</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--info); margin-top: 2px;">${totalWithdraw.toLocaleString()}</div>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">مصروف اليوم</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="card" style="margin: 0; display: flex; align-items: center; gap: 12px;">
          <div style="background: var(--info-light); color: var(--info); padding: 10px; border-radius: 12px;">
            <i data-lucide="fuel" style="width: 20px; height: 20px;"></i>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">بنزين</div>
            <div style="font-size: 15px; font-weight: 700;">${fuelExpense.toLocaleString()} ريال</div>
          </div>
        </div>

        <div class="card" style="margin: 0; display: flex; align-items: center; gap: 12px;">
          <div style="background: var(--warning-light); color: var(--warning); padding: 10px; border-radius: 12px;">
            <i data-lucide="calendar" style="width: 20px; height: 20px;"></i>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">اليوم</div>
            <div style="font-size: 15px; font-weight: 700;">${todayExpense.toLocaleString()} ريال</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div style="font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="car" style="width: 18px; height: 18px; color: var(--primary);"></i> حركة السيارات
        </div>
        <button id="dash-see-all-cars" style="background: none; border: none; color: var(--primary); font-size: 12px; font-weight: 700; cursor: pointer;">عرض القائمة ←</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 12px;">
        <div>
          <div style="font-size: 20px; font-weight: 800; color: var(--warning);">${activeCars}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">موجودة</div>
        </div>
        <div>
          <div style="font-size: 20px; font-weight: 800; color: var(--primary);">${exitedCars}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">خرجت</div>
        </div>
        <div>
          <div style="font-size: 20px; font-weight: 800; color: var(--info);">${cars.length}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">إجمالي الدخول</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
        <span style="color: var(--text-muted); font-weight: 600;">دخل السيارات:</span>
        <span style="font-weight: 800; color: var(--primary); font-size: 15px;">${carIncome.toLocaleString()} ريال</span>
      </div>
    </div>
  `;

  // 3. تحديث الأيقونات وربط التنقل
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const seeAllBtn = container.querySelector('#dash-see-all-cars');
  if (seeAllBtn && typeof onNavigate === 'function') {
    seeAllBtn.addEventListener('click', () => onNavigate('cars'));
  }
}
