/**
 * Auto Cash - نظام إدارة الترخيص والتفعيل الدائم (Offline Permanent License)
 * المسار: js/core/license-manager.js
 */

// مفتاح التوقيع السري الخاص بك (يمكنك تغيير النص بين القوسين لزيادة الأمان)
const MASTER_SALT = 'AutoCash_PERMANENT_PRO_SECURE_2026_!@#$';

/**
 * دالة التشفير والتجزئة الرياضية (32-bit Hash to Hex)
 */
function computeSignature(text) {
  let hash = 0;
  const combined = text + MASTER_SALT;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // تحويل إلى 32-bit integer
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

export const LicenseManager = {
  /**
   * 1. استخراج أو توليد معرّف الجهاز الفريد (Device ID)
   */
  getDeviceId() {
    let deviceId = localStorage.getItem('autocash_device_id');
    if (!deviceId) {
      const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const p3 = Date.now().toString(36).substring(4).toUpperCase();
      deviceId = `AC-${p1}-${p2}-${p3}`;
      localStorage.setItem('autocash_device_id', deviceId);
    }
    return deviceId;
  },

  /**
   * 2. حساب المفتاح الصحيح المطابق للجهاز
   */
  getExpectedKey(deviceId) {
    const cleanId = (deviceId || this.getDeviceId()).trim().toUpperCase();
    const hash = computeSignature(cleanId);
    return `ACT-${hash.substring(0, 4)}-${hash.substring(4, 8)}`;
  },

  /**
   * 3. التحقق من كود التفعيل وتخزينه كترخيص دائم
   */
  activate(inputKey) {
    if (!inputKey || typeof inputKey !== 'string') {
      return { success: false, message: 'يرجى إدخال مفتاح التفعيل.' };
    }

    const currentDeviceId = this.getDeviceId();
    const expected = this.getExpectedKey(currentDeviceId);
    const cleanedInput = inputKey.trim().toUpperCase();

    if (cleanedInput !== expected) {
      return { success: false, message: 'مفتاح التفعيل غير صحيح أو لا يطابق هذا الجهاز!' };
    }

    const licenseData = {
      isActivated: true,
      activatedAt: new Date().toISOString(),
      deviceId: currentDeviceId,
      key: cleanedInput,
      type: 'LIFETIME'
    };

    localStorage.setItem('autocash_license_data', JSON.stringify(licenseData));
    return { success: true, message: 'تم تفعيل النسخة بنجاح وبشكل دائم!' };
  },

  /**
   * 4. فحص حالة التفعيل عند فتح التطبيق
   */
  isActivated() {
    try {
      const raw = localStorage.getItem('autocash_license_data');
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.isActivated || data.type !== 'LIFETIME') return false;

      const currentDeviceId = this.getDeviceId();
      if (data.deviceId !== currentDeviceId) return false;

      return data.key === this.getExpectedKey(currentDeviceId);
    } catch (e) {
      return false;
    }
  }
};
