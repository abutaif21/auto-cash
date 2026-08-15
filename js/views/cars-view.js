import { db } from '../core/db.js';
import { compressImage } from '../utils/image-compressor.js';
import { renderCarDetailsView } from './car-details-view.js';

export async function renderCarsView(container) {
  let cars = await db.cars.toArray();
  let currentFilter = 'all';
  let searchQuery = '';

  const activeCount = cars.filter(c => c.status === 'موجودة').length;
  const exitedCount = cars.filter(c => c.status === 'خرجت').length;

  function updateView() {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 12px; padding: 12px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); text-align: center;">
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--warning);">${activeCount}</div>
            <div style="font-size: 11px; color: var(--text-muted);">موجودة</div>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${exitedCount}</div>
            <div style="font-size: 11px; color: var(--text-muted);">خرجت</div>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--info);">${cars.length}</div>
            <div style="font-size: 11px; color: var(--text-muted);">إجمالي الدخول</div>
          </div>
        </div>
      </div>

      <div style="position: relative; margin-bottom: 12px;">
        <i data-lucide="search" style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--text-muted);"></i>
        <input type="text" id="cars-search-input" value="${searchQuery}" placeholder="ابحث برقم اللوحة أو نوع السيارة..." style="width: 100%; padding: 12px 42px 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); outline: none; font-size: 13px; font-weight: 600;">
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 14px; background: var(--surface); padding: 4px; border-radius: 12px; border: 1px solid var(--border);">
        <button class="filter-tab ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" style="flex: 1; padding: 8px; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; background: ${currentFilter === 'all' ? 'var(--primary)' : 'transparent'}; color: ${currentFilter === 'all' ? 'white' : 'var(--text-muted)'};">الكل</button>
        <button class="filter-tab ${currentFilter === 'موجودة' ? 'active' : ''}" data-filter="موجودة" style="flex: 1; padding: 8px; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; background: ${currentFilter === 'موجودة' ? 'var(--primary)' : 'transparent'}; color: ${currentFilter === 'موجودة' ? 'white' : 'var(--text-muted)'};">موجودة</button>
        <button class="filter-tab ${currentFilter === 'خرجت' ? 'active' : ''}" data-filter="خرجت" style="flex: 1; padding: 8px; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; background: ${currentFilter === 'خرجت' ? 'var(--primary)' : 'transparent'}; color: ${currentFilter === 'خرجت' ? 'white' : 'var(--text-muted)'};">خرجت</button>
      </div>

      <div id="cars-list" style="display: flex; flex-direction: column; gap: 10px;">
        ${renderCarsList()}
      </div>

      <div id="car-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 1000; align-items: flex-end; justify-content: center;">
        <div style="background: var(--surface); border-radius: 24px 24px 0 0; padding: 24px; width: 100%; max-width: 500px; max-height: 85vh; overflow-y: auto; animation: slideUp 0.25s ease-out;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 800;">تسجيل دخول سيارة جديدة</h3>
            <button id="close-modal-btn" style="background: none; border: none; color: var(--text-muted); cursor: pointer;"><i data-lucide="x"></i></button>
          </div>
          
          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">نوع السيارة</label>
          <input type="text" id="car-type" placeholder="مثال: تويوتا كامري" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; font-size: 14px;">

          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">رقم اللوحة</label>
          <input type="text" id="car-plate" placeholder="مثال: ABC 1234" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; font-size: 14px;">

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">المربع / الموقف</label>
              <input type="number" id="car-box" placeholder="12" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 14px;">
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">المبلغ المطلوب (ريال)</label>
              <input type="number" id="car-price" placeholder="180" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 14px;">
            </div>
          </div>

          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">صورة السيارة</label>
          <input type="file" id="car-image" accept="image/*" style="width: 100%; padding: 10px; border: 1px dashed var(--border); border-radius: 10px; margin-bottom: 20px;">

          <button id="save-car-btn" style="width: 100%; background: var(--primary); color: white; padding: 14px; border: none; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer;">حفظ وتأكيد الدخول</button>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    attachEvents();
  }

  function renderCarsList() {
    let list = cars;
    if (currentFilter !== 'all') list = list.filter(c => c.status === currentFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => (c.plateNumber && c.plateNumber.toLowerCase().includes(q)) || (c.carType && c.carType.toLowerCase().includes(q)));
    }

    if (list.length === 0) {
      return `<div style="text-align: center; color: var(--text-muted); padding: 40px;"><i data-lucide="inbox" style="width: 40px; height: 40px; margin-bottom: 8px; opacity: 0.5;"></i><div>لا توجد سيارات مطابقة</div></div>`;
    }

    return list.map(car => `
      <div class="card car-item-card" data-id="${car.id}" style="margin: 0; padding: 14px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.1s;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: var(--bg-main); display: flex; align-items: center; justify-content: center; color: var(--primary);">
            <i data-lucide="car" style="width: 24px; height: 24px;"></i>
          </div>
          <div>
            <div style="font-weight: 800; font-size: 14px;">${car.carType}</div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">لوحة: ${car.plateNumber} | مربع: ${car.boxNumber || '-'}</div>
            <div style="font-size: 12px; font-weight: 700; color: var(--primary); margin-top: 2px;">${car.price || 0} ريال</div>
          </div>
        </div>
        <div style="text-align: left;">
          <span class="badge ${car.status === 'موجودة' ? 'badge-warning' : 'badge-success'}">${car.status}</span>
        </div>
      </div>
    `).join('');
  }

  function attachEvents() {
    const searchInput = container.querySelector('#cars-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      container.querySelector('#cars-list').innerHTML = renderCarsList();
      if (window.lucide) window.lucide.createIcons();
      attachCardClick();
    });

    container.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentFilter = tab.getAttribute('data-filter');
        updateView();
      });
    });

    const modal = container.querySelector('#car-modal');
    container.querySelector('#close-modal-btn').addEventListener('click', () => modal.style.display = 'none');

    // تشغيل نافذة الإضافة من الزر العائم أو الواجهة
    window.openNewCarModal = () => modal.style.display = 'flex';

    container.querySelector('#save-car-btn').addEventListener('click', async () => {
      const carType = container.querySelector('#car-type').value.trim();
      const plateNumber = container.querySelector('#car-plate').value.trim();
      const boxNumber = container.querySelector('#car-box').value.trim();
      const price = parseFloat(container.querySelector('#car-price').value) || 0;
      const imageFile = container.querySelector('#car-image').files[0];

      if (!carType || !plateNumber) {
        alert('يرجى كتابة نوع السيارة ورقم اللوحة');
        return;
      }

      const now = new Date();
      const entryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const carId = await db.cars.add({ carType, plateNumber, boxNumber, price, status: 'موجودة', entryDate });
      if (imageFile) {
        const blob = await compressImage(imageFile);
        await db.car_images.put({ carId, image: blob });
      }

      cars = await db.cars.toArray();
      modal.style.display = 'none';
      updateView();
    });

    attachCardClick();
  }

  function attachCardClick() {
    container.querySelectorAll('.car-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.getAttribute('data-id'));
        renderCarDetailsView(container, id, () => renderCarsView(container));
      });
    });
  }

  updateView();
}
