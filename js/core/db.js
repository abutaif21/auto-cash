// تهيئة قاعدة البيانات المحلية عبر Dexie
export const db = new Dexie('AutoCashDB');

// تعريف هيكل الجداول مع الترقية للإصدار 4 لتمكين الأرشيف وعزل حركة السيارات عن الكاش
db.version(4).stores({
  // 1. جدول السيارات (سجل تشغيلي مستمر لحركة الحجز غير مقيد بالإقفال المالي)
  cars: '++id, plateNumber, carType, status, entryDate, exitDate, boxNumber, price',
  
  // 2. جدول العمليات المالية النقدية (حساب الصندوق والكاش المقيد بالدورات المالية)
  transactions: '++id, type, subType, subtype, amount, date, carId, periodId',
  
  // 3. جدول منفصل لتخزين صور السيارات (Blobs) لتسريع استعلامات الجداول النصية
  car_images: 'carId',
  
  // 4. جدول الإعدادات والحماية (PIN، سؤال الأمان، إعدادات النسخ، زمن الجلسة)
  settings: 'key',

  // 5. جدول مخصص لحفظ مقبض مجلد النسخ الاحتياطي (FileSystemDirectoryHandle) لضمان ثباته
  system_handles: 'id',

  // 6. جدول الأرشيف المالي للدورات المقفلة (سجل تاريخي كامل لكل دورة مقفلة مع الاسم والتفاصيل)
  financial_periods: '++id, periodName, startDate, endDate, closureDate, closureType, totalIncome, totalExpense, surplus, finalBalance'
});
