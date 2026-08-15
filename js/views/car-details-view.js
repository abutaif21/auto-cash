import { db } from '../core/db.js';
import { printReceipt } from '../utils/pdf-printer.js';
import { showToast, showConfirmDialog } from '../utils/ui-feedback.js';

export async function renderCarDetailsView(container, carId, onBack) {
  const car = await db.cars.get(carId);
  if (!car) {
    showToast('السيارة غير موجودة', 'error');
    onBack();
    return;
  }

  const carImgRecord = await db.car_images.get(carId);
  let imageUrl = null;
  if (carImgRecord && carImgRecord.image) {
    imageUrl = URL.createObjectURL(carImgRecord.image);
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <button id="back-to-cars-btn" style="background: var(--surface); border: 1px solid var(--border); padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
        <i data-lucide="arrow-right" style="width: 16px;"></i> رجوع
      </button>
      <h2 style="font-size: 17px; font-weight: 800;">تفاصيل السيارة</h2>
      <span class="badge ${car.status === 'موجودة' ? 'badge-warning' : 'badge-success'}">${car.status}</span>
    </div>

    <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 16px;">
      ${imageUrl ? `<img src="${imageUrl}" style="width: 100%; height: 200px; object-fit: cover;">` : `
        <div style="width: 100%; height: 120px; background: var(--bg-main); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 13px;">
          <i data-lucide="image" style="width: 20px; margin-left: 6px;"></i> لا توجد صورة مرفقة
        </div>
      `}
      
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 13px;">النوع</span>
          <span style="font-weight: 800;">${car.carType}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 13px;">رقم اللوحة</span>
          <span style="font-weight: 800;">${car.plateNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 13px;">المربع / الموقف</span>
          <span style="font-weight: 800;">${car.boxNumber || 'غير محدد'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 13px;">تاريخ الدخول</span>
          <span style="font-weight: 700; direction: ltr;">${car.entryDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 4px;">
          <span style="color: var(--text-muted); font-size: 14px; font-weight: 700;">المبلغ المطلوب</span>
          <span style="font-size: 18px; font-weight: 800; color: var(--primary);">${car.price || 0} ريال</span>
        </div>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      <button id="print-receipt-btn" style="background: #0284c7; color: white; border: none; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i data-lucide="printer" style="width: 18px;"></i> طباعة إيصال الموقف
      </button>

      <button id="open-edit-car-btn" style="background: var(--info-light); color: var(--info); border: 1px solid var(--info); padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i data-lucide="edit-3" style="width: 18px;"></i> تعديل بيانات السيارة
      </button>

      ${car.status === 'موجودة' ? `
        <button id="detail-checkout-btn" style="background: var(--warning); color: white; border: none; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <i data-lucide="log-out" style="width: 18px;"></i> تسجيل خروج وتحصيل (${car.price || 0} ريال)
        </button>
      ` : ''}

      <div class="card" style="margin-top: 6px; padding: 12px; border: 1px dashed var(--danger); background: var(--danger-light);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 13px; color: var(--danger);">حذف سجل السيارة نهائياً</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">سيتم حذف بيانات وصور السيارة بالكامل</div>
          </div>
          <button id="delete-car-btn" style="background: var(--danger); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">حذف</button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  container.querySelector('#back-to-cars-btn').addEventListener('click', () => onBack());

  container.querySelector('#print-receipt-btn').addEventListener('click', () => {
    printReceipt(car);
    showToast('جاري إرسال الإيصال للطباعة');
  });

  // فتح نافذة تعديل بيانات السيارة
  const editCarModal = document.getElementById('edit-car-modal');
  container.querySelector('#open-edit-car-btn').addEventListener('click', () => {
    document.getElementById('edit-car-id').value = car.id;
    document.getElementById('edit-car-type').value = car.carType;
    document.getElementById('edit-car-plate').value = car.plateNumber;
    document.getElementById('edit-car-box').value = car.boxNumber || '';
    document.getElementById('edit-car-price').value = car.price || 0;
    editCarModal.style.display = 'flex';
  });

  document.getElementById('cancel-edit-car-btn').onclick = () => editCarModal.style.display = 'none';

  document.getElementById('save-edit-car-btn').onclick = async () => {
    const id = parseInt(document.getElementById('edit-car-id').value);
    const carType = document.getElementById('edit-car-type').value.trim();
    const plateNumber = document.getElementById('edit-car-plate').value.trim();
    const boxNumber = document.getElementById('edit-car-box').value.trim();
    const price = parseFloat(document.getElementById('edit-car-price').value) || 0;

    if (!carType || !plateNumber) {
      showToast('يرجى ملء نوع السيارة ورقم اللوحة', 'warning');
      return;
    }

    await db.cars.update(id, { carType, plateNumber, boxNumber, price });
    editCarModal.style.display = 'none';
    showToast('تم تحديث بيانات السيارة بنجاح');
    renderCarDetailsView(container, carId, onBack);
  };

  const checkoutBtn = container.querySelector('#detail-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      showConfirmDialog({
        title: 'تسجيل خروج السيارة',
        message: `تأكيد خروج السيارة وإضافة مبلغ ${car.price || 0} ريال إلى الصندوق؟`,
        onConfirm: async () => {
          await db.cars.update(carId, { status: 'خرجت' });
          if (car.price > 0) {
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            await db.transactions.add({
              type: 'دخل',
              subType: 'سيارات',
              amount: car.price,
              date: dateStr,
              carId: car.id
            });
          }
          showToast('تم تسجيل خروج السيارة وإيداع المبلغ');
          renderCarDetailsView(container, carId, onBack);
        }
      });
    });
  }

  container.querySelector('#delete-car-btn').addEventListener('click', () => {
    showConfirmDialog({
      title: 'حذف سجل السيارة',
      message: 'هل أنت متأكد من حذف هذه السيارة وصورتها نهائياً؟',
      onConfirm: async () => {
        await db.cars.delete(carId);
        await db.car_images.delete(carId);
        showToast('تم حذف السجل بنجاح');
        onBack();
      }
    });
  });
}
