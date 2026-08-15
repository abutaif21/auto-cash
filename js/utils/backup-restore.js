import { db } from '../core/db.js';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64) {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

// 1. تصدير كامل وشامل
export async function exportDatabaseToJson() {
  const cars = await db.cars.toArray();
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.toArray();
  const rawImages = await db.car_images.toArray();

  const car_images = [];
  for (const imgRec of rawImages) {
    if (imgRec.image) {
      const b64 = await blobToBase64(imgRec.image);
      car_images.push({ carId: imgRec.carId, image: b64 });
    }
  }

  const backupData = {
    appName: "AutoCash",
    version: 2,
    exportDate: new Date().toISOString(),
    cars,
    transactions,
    settings, // يشمل الـ PIN وسؤال الأمان
    car_images
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = `AutoCash_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// 2. استيراد معالَج ودقيق يمنع فقدان كلمة السر
export async function importDatabaseFromJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);

        if (!backupData.cars || !backupData.transactions) {
          throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف');
        }

        // استخدام Transaction شامل لمنع تلف البيانات
        await db.transaction('rw', [db.cars, db.transactions, db.settings, db.car_images], async () => {
          await db.cars.clear();
          await db.transactions.clear();
          await db.settings.clear();
          await db.car_images.clear();

          if (backupData.cars.length > 0) await db.cars.bulkAdd(backupData.cars);
          if (backupData.transactions.length > 0) await db.transactions.bulkAdd(backupData.transactions);

          // استعادة جدول الإعدادات والمفاتيح الأمنية بدقة
          if (backupData.settings && backupData.settings.length > 0) {
            for (const s of backupData.settings) {
              await db.settings.put(s);
            }
          }

          if (backupData.car_images && backupData.car_images.length > 0) {
            for (const imgRec of backupData.car_images) {
              const blob = base64ToBlob(imgRec.image);
              await db.car_images.put({ carId: imgRec.carId, image: blob });
            }
          }
        });

        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
