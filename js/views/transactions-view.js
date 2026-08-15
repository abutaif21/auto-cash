import { db } from '../core/db.js';
import { showToast, showConfirmDialog } from '../utils/ui-feedback.js';
import { showCustomAlert } from '../app.js';

export async function renderTransactionsView(container) {
  const transactions = await db.transactions.reverse().toArray();
  let selectedType = 'دخل';

  container.innerHTML = `
    <div class="card" style="margin-bottom: 16px;">
      <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <i data-lucide="plus-circle" style="width: 18px; color: var(--primary);"></i> إضافة عملية جديدة
      </h3>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
        <button type="button" class="tx-select-btn active" data-type="دخل" style="padding: 10px; border-radius: 10px; border: 1px solid var(--primary); background: var(--primary-light); color: var(--primary-dark); font-weight: 700; font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <i data-lucide="arrow-down-circle" style="width: 18px; height: 18px;"></i> دخل
        </button>
        <button type="button" class="tx-select-btn" data-type="مصروف" style="padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-weight: 700; font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <i data-lucide="arrow-up-circle" style="width: 18px; height: 18px;"></i> مصروف
        </button>
        <button type="button" class="tx-select-btn" data-type="سحب" style="padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-weight: 700; font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <i data-lucide="credit-card" style="width: 18px; height: 18px;"></i> سحب
        </button>
      </div>

      <div id="tx-fields-grid" style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 12px;">
        <div id="tx-subtype-wrapper" style="display: none;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">تصنيف المصروف</label>
          <select id="tx-subtype" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); font-size: 13px; font-weight: 700;">
            <option value="عام">عام</option>
            <option value="بنزين">بنزين</option>
            <option value="مصروف يومي">مصروف يومي</option>
          </select>
        </div>
        
        <div id="tx-amount-wrapper">
          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">المبلغ (ريال)</label>
          <input type="number" id="tx-amount" placeholder="0.00" min="1" step="any" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 15px; font-weight: 800;">
        </div>
      </div>

      <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">ملاحظة / البيان (اختياري)</label>
      <input type="text" id="tx-note" placeholder="اكتب تفاصيل أو ملاحظة للعملية..." style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; margin-bottom: 16px;">

      <button id="save-tx-btn" style="width: 100%; background: var(--primary); color: white; padding: 14px; border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i data-lucide="check" style="width: 18px;"></i> حفظ العملية في الصندوق
      </button>
    </div>

    <div style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">سجل العمليات الأخيرة (${transactions.length})</div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${transactions.length === 0 ? '<div class="card" style="text-align: center; color: var(--text-muted); padding: 30px;">لا توجد عمليات مسجلة حالياً</div>' : transactions.map(tx => {
        const isIncome = tx.type === 'دخل';
        const isExpense = tx.type === 'مصروف';
        const titleLabel = isExpense ? `مصروف (${tx.subType || tx.subtype || 'عام'})` : tx.type;

        return `
          <div class="card" style="margin: 0; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: ${isIncome ? 'var(--primary-light)' : isExpense ? 'var(--danger-light)' : 'var(--info-light)'}; color: ${isIncome ? 'var(--primary)' : isExpense ? 'var(--danger)' : 'var(--info)'}; font-weight: 800;">
                <i data-lucide="${isIncome ? 'arrow-down' : isExpense ? 'arrow-up' : 'credit-card'}" style="width: 18px; height: 18px;"></i>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${titleLabel}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
                  ${tx.date ? tx.date : ''} ${tx.note ? '• ' + tx.note : ''}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 15px; font-weight: 800; color: ${isIncome ? 'var(--primary)' : 'var(--danger)'}; direction: ltr;">
                ${isIncome ? '+' : '-'}${Number(tx.amount || 0).toLocaleString()} <span style="font-size: 11px;">ريال</span>
              </div>
              <button class="edit-tx-btn" data-id="${tx.id}" style="background: none; border: none; color: var(--info); cursor: pointer; padding: 4px;"><i data-lucide="edit-3" style="width: 16px;"></i></button>
              <button class="delete-tx-btn" data-id="${tx.id}" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 4px;"><i data-lucide="trash-2" style="width: 16px;"></i></button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
  attachTxEvents(container, transactions);
}
function attachTxEvents(container, transactions) {
  let selectedType = 'دخل';
  const typeBtns = container.querySelectorAll('.tx-select-btn');
  const subtypeWrapper = container.querySelector('#tx-subtype-wrapper');
  const fieldsGrid = container.querySelector('#tx-fields-grid');
  
  // 1. التحكم بتغيير نوع العملية وإظهار التصنيف للمصروف فقط
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => {
        b.style.background = 'var(--surface)';
        b.style.borderColor = 'var(--border)';
        b.style.color = 'var(--text-muted)';
      });
      selectedType = btn.getAttribute('data-type');
      btn.style.borderColor = selectedType === 'دخل' ? 'var(--primary)' : selectedType === 'مصروف' ? 'var(--danger)' : 'var(--info)';
      btn.style.background = selectedType === 'دخل' ? 'var(--primary-light)' : selectedType === 'مصروف' ? 'var(--danger-light)' : 'var(--info-light)';
      btn.style.color = selectedType === 'دخل' ? 'var(--primary-dark)' : selectedType === 'مصروف' ? 'var(--danger)' : 'var(--info)';

      // إظهار التصنيف للمصروف فقط وتعديل تقسيم الحقول
      if (selectedType === 'مصروف') {
        subtypeWrapper.style.display = 'block';
        fieldsGrid.style.gridTemplateColumns = '1fr 1fr';
      } else {
        subtypeWrapper.style.display = 'none';
        fieldsGrid.style.gridTemplateColumns = '1fr';
      }
    });
  });

  // 2. إضافة وحفظ عملية جديدة
  container.querySelector('#save-tx-btn').addEventListener('click', async () => {
    const amount = parseFloat(container.querySelector('#tx-amount').value);
    const note = container.querySelector('#tx-note').value.trim();
    
    // إذا كان نوع العملية مصروف نأخذ التصنيف، وإلا يكون فارغاً
    const subType = selectedType === 'مصروف' ? container.querySelector('#tx-subtype').value : '';

    if (!amount || amount <= 0) {
      showCustomAlert('تنبيه الإدخال', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'warning');
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      await db.transactions.add({ 
        type: selectedType, 
        subType: subType, 
        subtype: subType, 
        amount: amount, 
        note: note, 
        date: dateStr 
      });

      showToast('تمت إضافة العملية بنجاح');
      renderTransactionsView(container);
    } catch (err) {
      showCustomAlert('خطأ', 'تعذر حفظ العملية: ' + err.message, 'error');
    }
  });

  // 3. حذف عملية مالية
  container.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'));
      showConfirmDialog({
        title: 'حذف العملية',
        message: 'هل أنت متأكد من حذف هذه الحركة المالية من الصندوق؟',
        onConfirm: async () => {
          await db.transactions.delete(id);
          showToast('تم حذف العملية بنجاح');
          renderTransactionsView(container);
        }
      });
    });
  });

  // 4. فتح وتجهيز نافذة تعديل العملية
  const editModal = document.getElementById('edit-tx-modal');
  const editTypeSelect = document.getElementById('edit-tx-type');
  const editSubtypeSelect = document.getElementById('edit-tx-subtype');

  // إخفاء أو إظهار خيارات التصنيف في نافذة التعديل حسب النوع
  function updateEditSubtypeVisibility(typeVal) {
    if (editSubtypeSelect && editSubtypeSelect.parentElement) {
      const parentLabel = editSubtypeSelect.previousElementSibling;
      if (typeVal === 'مصروف') {
        editSubtypeSelect.style.display = 'block';
        if (parentLabel) parentLabel.style.display = 'block';
      } else {
        editSubtypeSelect.style.display = 'none';
        if (parentLabel) parentLabel.style.display = 'none';
      }
    }
  }

  if (editTypeSelect) {
    editTypeSelect.onchange = () => {
      updateEditSubtypeVisibility(editTypeSelect.value);
    };
  }

  container.querySelectorAll('.edit-tx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'));
      const tx = transactions.find(t => t.id === id);
      if (tx && editModal) {
        document.getElementById('edit-tx-id').value = tx.id;
        document.getElementById('edit-tx-type').value = tx.type;
        
        // تحديث خيارات التصنيف بالمودال
        if (editSubtypeSelect) {
          editSubtypeSelect.innerHTML = `
            <option value="عام">عام</option>
            <option value="بنزين">بنزين</option>
            <option value="مصروف يومي">مصروف يومي</option>
          `;
          editSubtypeSelect.value = tx.subType || tx.subtype || 'عام';
        }

        updateEditSubtypeVisibility(tx.type);

        document.getElementById('edit-tx-amount').value = tx.amount;
        document.getElementById('edit-tx-note').value = tx.note || '';
        editModal.style.display = 'flex';
      }
    });
  });

  const cancelEditBtn = document.getElementById('cancel-edit-tx-btn');
  if (cancelEditBtn) {
    cancelEditBtn.onclick = () => { editModal.style.display = 'none'; };
  }

  const saveEditBtn = document.getElementById('save-edit-tx-btn');
  if (saveEditBtn) {
    saveEditBtn.onclick = async () => {
      const id = parseInt(document.getElementById('edit-tx-id').value);
      const type = document.getElementById('edit-tx-type').value;
      const subType = type === 'مصروف' ? document.getElementById('edit-tx-subtype').value : '';
      const amount = parseFloat(document.getElementById('edit-tx-amount').value);
      const note = document.getElementById('edit-tx-note').value.trim();

      if (!amount || amount <= 0) {
        showCustomAlert('تنبيه الإدخال', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'warning');
        return;
      }

      await db.transactions.update(id, { 
        type, 
        subType, 
        subtype: subType, 
        amount, 
        note 
      });

      editModal.style.display = 'none';
      showToast('تم تحديث العملية بنجاح');
      renderTransactionsView(container);
    };
  }
}
