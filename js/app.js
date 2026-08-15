import { db } from './core/db.js';
import { enablePersistentStorage } from './core/storage-manager.js';
import { LicenseManager } from './core/license-manager.js';
import { 
  verifyPin, 
  setupInitialSecurity, 
  getSecurityQuestion, 
  resetPinWithSecurityAnswer, 
  changePin, 
  updateSecurityQuestion,
  savePattern,
  verifyPattern,
  hasPatternSetup,
  setSessionTimeoutHours,
  getSessionTimeoutHours,
  recordLoginSession,
  isSessionValid,
  clearSession
} from './core/auth.js';
import { renderCarsView } from './views/cars-view.js';
import { renderTransactionsView } from './views/transactions-view.js';
import { renderDashboardView } from './views/dashboard-view.js';
import { renderReportsView } from './views/reports-view.js';
import { showToast } from './utils/ui-feedback.js';

// ========================================================
// 🔑 دالة عرض شاشة القفل وتفعيل الترخيص الدائم
// ========================================================
function showActivationOverlay(onActivatedCallback) {
  const existingOverlay = document.getElementById('activation-lock-overlay');
  if (existingOverlay) existingOverlay.remove();

  const deviceId = LicenseManager.getDeviceId();

  const modalHtml = `
    <div id="activation-lock-overlay" style="position: fixed; inset: 0; background: #090d16; z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 16px; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="background: #161f30; border: 1px solid #283548; border-radius: 20px; padding: 24px; width: 100%; max-width: 410px; text-align: center; color: #f8fafc; box-shadow: 0 25px 40px -10px rgba(0,0,0,0.7);">
        
        <div style="width: 58px; height: 58px; background: rgba(56, 189, 248, 0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25);">
          <i data-lucide="shield-check" style="width: 30px; height: 30px;"></i>
        </div>

        <h3 style="margin: 0 0 6px; font-size: 19px; font-weight: 700; color: #fff;">تفعيل نسخة Auto Cash</h3>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0 0 16px;">
          النسخة غير مفعلة. زوّد البائع برمز الجهاز التالي لاستلام مفتاح التفعيل الدائم:
        </p>

        <div style="background: #0b1329; padding: 12px; border-radius: 12px; border: 1px dashed #38bdf8; margin-bottom: 12px;">
          <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">رمز الجهاز الخاص بك (Device ID):</span>
          <strong id="display-activation-device-id" style="font-size: 16px; color: #38bdf8; font-family: monospace; letter-spacing: 1.5px;">${deviceId}</strong>
        </div>

        <button id="copy-activation-device-id-btn" type="button" style="background: #1e293b; color: #f8fafc; border: 1px solid #334155; padding: 9px; border-radius: 8px; font-size: 13px; cursor: pointer; width: 100%; margin-bottom: 18px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i data-lucide="copy" style="width: 15px; height: 15px;"></i> نسخ رمز الجهاز
        </button>

        <div style="text-align: right; margin-bottom: 16px;">
          <label style="font-size: 12px; color: #cbd5e1; display: block; margin-bottom: 6px;">مفتاح التفعيل الدائم:</label>
          <input type="text" id="activation-key-field" placeholder="ACT-XXXX-XXXX" style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; background: #0b1329; border: 1px solid #334155; color: #fff; font-size: 15px; text-align: center; font-family: monospace; letter-spacing: 2px; text-transform: uppercase;">
        </div>

        <button id="submit-activation-btn" type="button" style="background: #2563eb; color: #fff; border: none; padding: 12px; border-radius: 10px; font-size: 15px; font-weight: 700; width: 100%; cursor: pointer;">
          تفعيل النسخة نهائياً
        </button>
        <div id="activation-error-label" style="color: #ef4444; font-size: 12px; margin-top: 10px; display: none;"></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('copy-activation-device-id-btn').onclick = () => {
    navigator.clipboard.writeText(deviceId).then(() => {
      showToast('تم نسخ رمز الجهاز بنجاح');
    });
  };

  document.getElementById('submit-activation-btn').onclick = () => {
    const key = document.getElementById('activation-key-field').value;
    const result = LicenseManager.activate(key);
    const errBox = document.getElementById('activation-error-label');

    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('activation-lock-overlay').remove();
      if (onActivatedCallback) onActivatedCallback();
    } else {
      errBox.textContent = result.message;
      errBox.style.display = 'block';
    }
  };
}

// ========================================================
// 📱 متغير تخزين حدث التثبيت للـ PWA للشاشة الرئيسية
// ========================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('✅ [PWA] تم التقاط حدث التثبيت للشاشة الرئيسية');

  const drawerInstallBtn = document.getElementById('drawer-install-pwa-btn');
  const profileInstallBtn = document.getElementById('profile-install-pwa-btn');
  if (drawerInstallBtn) drawerInstallBtn.style.display = 'flex';
  if (profileInstallBtn) profileInstallBtn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast('تم تثبيت تطبيق Auto Cash بنجاح على الشاشة الرئيسية!');
  const drawerInstallBtn = document.getElementById('drawer-install-pwa-btn');
  const profileInstallBtn = document.getElementById('profile-install-pwa-btn');
  if (drawerInstallBtn) drawerInstallBtn.style.display = 'none';
  if (profileInstallBtn) profileInstallBtn.style.display = 'none';
});

// دالة طلب التثبيت البرمجي
export async function triggerPWAInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('تمت الموافقة على تثبيت التطبيق');
    }
    deferredInstallPrompt = null;
  } else {
    showCustomAlert('تثبيت التطبيق', 'التطبيق مثبت بالفعل أو يمكنك إضافته يدوياً من قائمة المتصفح (⋮) -> "إضافة إلى الشاشة الرئيسية".', 'info');
  }
}

// ========================================================
// 🔔 دالة عرض نافذة التنبيهات المخصصة
// ========================================================
export function showCustomAlert(title, message, type = 'warning') {
  const modal = document.getElementById('custom-alert-modal');
  if (!modal) return;

  const titleEl = document.getElementById('alert-title');
  const msgEl = document.getElementById('alert-message');
  const iconBox = document.getElementById('alert-icon-box');
  const closeBtn = document.getElementById('alert-close-btn');

  if (titleEl) titleEl.textContent = title || 'تنبيه';
  if (msgEl) msgEl.textContent = message || '';

  if (iconBox) {
    if (type === 'error') {
      iconBox.style.background = 'var(--danger-light)';
      iconBox.style.color = 'var(--danger)';
      iconBox.innerHTML = '<i data-lucide="alert-octagon" style="width: 28px; height: 28px;"></i>';
    } else if (type === 'success') {
      iconBox.style.background = 'var(--primary-light)';
      iconBox.style.color = 'var(--primary)';
      iconBox.innerHTML = '<i data-lucide="check-circle" style="width: 28px; height: 28px;"></i>';
    } else if (type === 'info') {
      iconBox.style.background = 'rgba(56, 189, 248, 0.15)';
      iconBox.style.color = '#0284c7';
      iconBox.innerHTML = '<i data-lucide="download" style="width: 28px; height: 28px;"></i>';
    } else {
      iconBox.style.background = 'var(--warning-light)';
      iconBox.style.color = 'var(--warning)';
      iconBox.innerHTML = '<i data-lucide="alert-circle" style="width: 28px; height: 28px;"></i>';
    }
  }

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
}

// ========================================================
// 🛡️ 1. موديول النسخ الاحتياطي التلقائي
// ========================================================
class AutoBackupManager {
  static async getDirectoryHandle() {
    try {
      const record = await db.system_handles.get('backup_dir');
      return record ? record.handle : null;
    } catch (e) {
      console.warn('تعذر قراءة مقبض المجلد:', e);
      return null;
    }
  }

  static async setDirectoryHandle(handle) {
    try {
      await db.system_handles.put({ id: 'backup_dir', handle: handle, name: handle.name });
      await db.settings.put({ key: 'backup_dir_name', value: handle.name });
    } catch (e) {
      console.error('خطأ في حفظ مقبض المجلد:', e);
    }
  }

  static async getDirectoryName() {
    const record = await db.settings.get('backup_dir_name');
    return record ? record.value : null;
  }

  static async getBackupConfig() {
    const config = await db.settings.get('backup_config');
    return config ? config.value : { enabled: false, frequency: 1, times: ['20:00'], lastRun: null };
  }

  static async saveBackupConfig(config) {
    await db.settings.put({ key: 'backup_config', value: config });
  }

  static async exportFullDatabase() {
    const exportData = {
      version: 4,
      timestamp: new Date().toISOString(),
      tables: {}
    };
    for (const table of db.tables) {
      if (table.name !== 'system_handles') {
        const records = await table.toArray();
        if (table.name === 'settings') {
          exportData.tables[table.name] = records.filter(s => s.key !== 'user_pin' && s.key !== 'security_answer' && s.key !== 'user_pattern');
        } else {
          exportData.tables[table.name] = records;
        }
      }
    }
    return JSON.stringify(exportData, null, 2);
  }

  static async performBackup(dirHandle, triggerType = 'تلقائي', isUserInitiated = false) {
    try {
      const opts = { mode: 'readwrite' };
      let permissionState = await dirHandle.queryPermission(opts);

      if (permissionState !== 'granted') {
        if (isUserInitiated) {
          permissionState = await dirHandle.requestPermission(opts);
        } else {
          console.warn('⚠️ تتطلب صلاحية المجلد تفاعلاً من المستخدم؛ تم حفظ تنبيه في الإشعارات.');
          await this.queuePendingBackup();
          return false;
        }
      }

      if (permissionState !== 'granted') {
        return false;
      }

      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `autocash_backup_${dateStr}.json`;
      
      const jsonData = await this.exportFullDatabase();
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonData);
      await writable.close();

      const backupFiles = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('autocash_backup_') && entry.name.endsWith('.json')) {
          backupFiles.push(entry);
        }
      }

      backupFiles.sort((a, b) => b.name.localeCompare(a.name));

      if (backupFiles.length > 2) {
        for (let i = 2; i < backupFiles.length; i++) {
          await dirHandle.removeEntry(backupFiles[i].name);
        }
      }

      const backupLog = await db.settings.get('backup_logs') || { key: 'backup_logs', value: [] };
      const currentLogs = [
        { date: now.toLocaleString('ar-EG'), file: fileName, type: triggerType },
        ...(backupLog.value || [])
      ].slice(0, 2);
      
      await db.settings.put({ key: 'backup_logs', value: currentLogs });
      await db.settings.put({ key: 'pending_backup_alert', value: false });

      const config = await this.getBackupConfig();
      config.lastRun = now.toISOString();
      await this.saveBackupConfig(config);

      return true;
    } catch (err) {
      console.error('فشل إنشاء النسخة الاحتياطية:', err);
      return false;
    }
  }

  static async queuePendingBackup() {
    await db.settings.put({ key: 'pending_backup_alert', value: true });
  }

  static async checkAndRunMissedBackups() {
    const config = await this.getBackupConfig();
    const dirHandle = await this.getDirectoryHandle();
    if (!config.enabled || !dirHandle) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastRun = config.lastRun ? new Date(config.lastRun) : null;
    const lastRunDateStr = lastRun ? lastRun.toISOString().slice(0, 10) : null;

    let shouldRun = false;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const scheduleTime of (config.times || ['20:00'])) {
      if (currentTimeStr >= scheduleTime) {
        if (!lastRun || lastRunDateStr !== todayStr || (lastRun && lastRun.getHours() < parseInt(scheduleTime.split(':')[0]))) {
          shouldRun = true;
          break;
        }
      }
    }

    if (shouldRun) {
      const success = await this.performBackup(dirHandle, 'استدراك بعد التشغيل', false);
      if (success) showToast('تم إنشاء نسخة احتياطية تلقائية بنجاح');
    }
  }
}
// ========================================================
// 🔒 2. محرك قفل النمط (Canvas Pattern Lock Engine)
// ========================================================
class PatternLockEngine {
  constructor(canvasId, onComplete) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.onComplete = onComplete;
    this.points = [];
    this.selectedPoints = [];
    this.isDrawing = false;
    this.initPoints();
    this.attachEvents();
    this.draw();
  }

  initPoints() {
    const size = this.canvas.width;
    const padding = size * 0.18;
    const spacing = (size - 2 * padding) / 2;
    this.points = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.points.push({
          id: r * 3 + c + 1,
          x: padding + c * spacing,
          y: padding + r * spacing,
          radius: 12
        });
      }
    }
  }

  attachEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (this.canvas.width / rect.width),
        y: (clientY - rect.top) * (this.canvas.height / rect.height)
      };
    };

    const start = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      this.selectedPoints = [];
      const pos = getPos(e);
      this.checkCollision(pos);
      this.draw(pos);
    };

    const move = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.checkCollision(pos);
      this.draw(pos);
    };

    const end = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.draw();
      if (this.selectedPoints.length > 0) {
        const patternStr = this.selectedPoints.map(p => p.id).join('');
        if (this.onComplete) this.onComplete(patternStr);
      }
    };

    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end, { passive: false });
  }

  checkCollision(pos) {
    for (const p of this.points) {
      const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (dist < 25 && !this.selectedPoints.includes(p)) {
        this.selectedPoints.push(p);
      }
    }
  }

  draw(currentPos = null) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.selectedPoints.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.selectedPoints[0].x, this.selectedPoints[0].y);
      for (let i = 1; i < this.selectedPoints.length; i++) {
        this.ctx.lineTo(this.selectedPoints[i].x, this.selectedPoints[i].y);
      }
      if (currentPos && this.isDrawing) {
        this.ctx.lineTo(currentPos.x, currentPos.y);
      }
      this.ctx.strokeStyle = '#10B981';
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    }

    for (const p of this.points) {
      const isSelected = this.selectedPoints.includes(p);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = isSelected ? '#10B981' : 'rgba(255, 255, 255, 0.2)';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      this.ctx.fill();
    }
  }

  reset() {
    this.selectedPoints = [];
    this.draw();
  }
}

// ========================================================
// 👆 3. موديول المصادقة بالبصمة (WebAuthn API)
// ========================================================
class BiometricAuth {
  static isAvailable() {
    return window.PublicKeyCredential !== undefined && typeof window.PublicKeyCredential === 'function';
  }

  static async registerBiometrics() {
    if (!this.isAvailable()) {
      showCustomAlert('غير مدعوم', 'جهازك أو متصفحك الحالي لا يدعم بصمة الإصبع عبر الويب.', 'error');
      return false;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const host = window.location.hostname || 'localhost';

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Auto Cash System', id: host === 'localhost' || host === '127.0.0.1' ? undefined : host },
          user: {
            id: Uint8Array.from('autocash_admin', c => c.charCodeAt(0)),
            name: 'admin@autocash.local',
            displayName: 'مدير النظام'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      });

      if (credential) {
        await db.settings.put({ key: 'biometrics_enabled', value: true });
        return true;
      }
    } catch (e) {
      console.warn('تنبيه البصمة:', e);
      if (e.name === 'NotAllowedError') {
        showCustomAlert('إلغاء العملية', 'تم إلغاء المصادقة بالبصمة أو انتهت المهلة المحددة.', 'warning');
      } else {
        showCustomAlert('خطأ في البصمة', 'تعذر ربط البصمة: ' + (e.message || 'خطأ غير معروف'), 'error');
      }
      return false;
    }
    return false;
  }

  static async verifyBiometrics() {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: 'required',
          timeout: 60000
        }
      });
      return !!assertion;
    } catch (e) {
      console.warn('فشل التحقق بالبصمة:', e);
      return false;
    }
  }
}

// ========================================================
// 🚀 4. دورة حياة التطبيق والواجهات
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();

  // 1. فحص التفعيل التجاري أولاً كحارس للنظام بالكامل
  if (!LicenseManager.isActivated()) {
    showActivationOverlay(async () => {
      await bootstrapApplication();
    });
    return;
  }

  // 2. إذا كان مفعلاً نبدأ تشغيل النظام
  await bootstrapApplication();
});

// دالة الإقلاع والربط الشامل
async function bootstrapApplication() {
  // تسجيل Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');
      console.log('✅ [PWA] Service Worker مسجل بالنطاق:', reg.scope);
    } catch (e) {
      console.log('وضع التشغيل المحلي النشط:', e);
    }
  }

  // تفعيل التخزين الدائم والتأكد من فتح IndexedDB
  await enablePersistentStorage();
  if (!db.isOpen()) {
    await db.open();
  }

  // فحص النسخ الاحتياطي الفائت
  await AutoBackupManager.checkAndRunMissedBackups();
  setInterval(() => AutoBackupManager.checkAndRunMissedBackups(), 15 * 60 * 1000);

  const authScreen = document.getElementById('auth-screen');
  const mainApp = document.getElementById('main-app');
  const onboardingModal = document.getElementById('onboarding-modal');
  const recoveryModal = document.getElementById('recovery-modal');
  const userProfileModal = document.getElementById('user-profile-modal');
  const setupPatternModal = document.getElementById('setup-pattern-modal');
  const dots = document.querySelectorAll('.pin-dot');

  // عناصر التبديل بين PIN والنمط
  const pinKeypad = document.getElementById('pin-keypad-container');
  const pinDots = document.getElementById('pin-dots-container');
  const patternContainer = document.getElementById('pattern-container');
  const toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
  const toggleAuthModeLabel = document.getElementById('toggle-auth-mode-label');
  const authSubtitle = document.getElementById('auth-screen-subtitle');
  let currentAuthMode = 'pin';

  // شريط التنقل السفلي ومحتوى الشاشة
  const navTabs = document.querySelectorAll('.bottom-nav .nav-tab');
  const appContent = document.getElementById('app-content');
  const topbarTitle = document.getElementById('topbar-title');

  // دالة توجيه وعرض الشاشات مع التزامن الكامل
  async function renderView(view) {
    if (!appContent) return;

    navTabs.forEach(tab => {
      if (tab.getAttribute('data-view') === view) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    const titles = {
      dashboard: 'الرئيسية',
      cars: 'السيارات',
      transactions: 'الكاش والمصروفات',
      reports: 'الكشف والتقارير'
    };
    if (topbarTitle) topbarTitle.textContent = titles[view] || 'Auto Cash';

    switch (view) {
      case 'dashboard':
        await renderDashboardView(appContent, renderView);
        break;
      case 'cars':
        await renderCarsView(appContent);
        break;
      case 'transactions':
        await renderTransactionsView(appContent);
        break;
      case 'reports':
        await renderReportsView(appContent);
        break;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // دالة الدخول الناجح للتطبيق
  async function loginSuccess() {
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    showToast('مرحباً بك مجدداً');
    await renderView('dashboard');
    checkLongParkingAndBackupNotifs();
  }

  // التحقق من صلاحية الجلسة الحالية
  const sessionActive = await isSessionValid();
  if (sessionActive) {
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    await renderView('dashboard');
    checkLongParkingAndBackupNotifs();
  } else {
    const existingPin = await db.settings.get('user_pin');
    if (!existingPin || !existingPin.value) {
      if (onboardingModal) onboardingModal.style.display = 'flex';
    }
  }

  // تهيئة محرك رسم النمط
  const loginPatternEngine = new PatternLockEngine('pattern-canvas', async (drawnPattern) => {
    const isValid = await verifyPattern(drawnPattern);
    if (isValid) {
      await recordLoginSession();
      await loginSuccess();
    } else {
      showToast('نمط المرور غير صحيح', 'error');
      setTimeout(() => loginPatternEngine.reset(), 500);
    }
  });

  // التبديل بين وضع الـ PIN ووضع النمط
  if (toggleAuthModeBtn) {
    const patternExists = await hasPatternSetup();
    if (!patternExists) {
      toggleAuthModeBtn.style.display = 'none';
    } else {
      toggleAuthModeBtn.onclick = () => {
        if (currentAuthMode === 'pin') {
          currentAuthMode = 'pattern';
          if (pinKeypad) pinKeypad.style.display = 'none';
          if (pinDots) pinDots.style.display = 'none';
          if (patternContainer) patternContainer.style.display = 'flex';
          if (toggleAuthModeLabel) toggleAuthModeLabel.textContent = 'التبديل إلى رمز PIN';
          if (authSubtitle) authSubtitle.textContent = 'ارسم نمط المرور السري';
          loginPatternEngine.reset();
        } else {
          currentAuthMode = 'pin';
          if (pinKeypad) pinKeypad.style.display = 'block';
          if (pinDots) pinDots.style.display = 'flex';
          if (patternContainer) patternContainer.style.display = 'none';
          if (toggleAuthModeLabel) toggleAuthModeLabel.textContent = 'التبديل إلى النمط';
          if (authSubtitle) authSubtitle.textContent = 'أدخل رمز المرور السري';
        }
      };
    }
  }

  // زر الدخول بالبصمة
  const bioBtn = document.getElementById('biometric-login-btn');
  const isBioActive = await db.settings.get('biometrics_enabled');
  if (bioBtn) {
    if (isBioActive && isBioActive.value && BiometricAuth.isAvailable()) {
      bioBtn.style.display = 'flex';
      bioBtn.onclick = async () => {
        const verified = await BiometricAuth.verifyBiometrics();
        if (verified) {
          await recordLoginSession();
          await loginSuccess();
        } else {
          showToast('فشل التحقق بالبصمة', 'error');
        }
      };
    }
  }

  // إعداد الحماية لأول مرة
  const obSaveBtn = document.getElementById('ob-save-btn');
  if (obSaveBtn) {
    obSaveBtn.addEventListener('click', async () => {
      const pin = document.getElementById('ob-pin').value.trim();
      const confirmPin = document.getElementById('ob-confirm-pin').value.trim();
      const question = document.getElementById('ob-question').value;
      const answer = document.getElementById('ob-answer').value.trim();

      if (pin.length < 4 || confirmPin.length < 4) {
        showCustomAlert('تنبيه الإدخال', 'يجب أن يتكون رمز الدخول من 4 أرقام على الأقل.', 'warning');
        return;
      }
      if (pin !== confirmPin) {
        showCustomAlert('عدم تطابق', 'رمز المرور وتأكيد الرمز غير متطابقين، يرجى إعادة التحقق.', 'error');
        return;
      }
      if (!answer) {
        showCustomAlert('بيانات ناقصة', 'يرجى كتابة إجابة سؤال الأمان لاستعادة الرمز مستقبلاً.', 'warning');
        return;
      }

      await setupInitialSecurity(pin, question, answer);
      if (onboardingModal) onboardingModal.style.display = 'none';
      await loginSuccess();
    });
  }

  // إدخال PIN من لوحة الأرقام
  let enteredPin = '';
  function updateDots() {
    dots.forEach((dot, index) => {
      if (index < enteredPin.length) dot.classList.add('filled');
      else dot.classList.remove('filled');
    });
  }

  document.querySelectorAll('.key-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (enteredPin.length < 4) {
        enteredPin += btn.getAttribute('data-key');
        updateDots();

        if (enteredPin.length === 4) {
          setTimeout(async () => {
            const isValid = await verifyPin(enteredPin);
            if (isValid) {
              await recordLoginSession();
              await loginSuccess();
            } else {
              showToast('رمز الدخول غير صحيح', 'error');
              enteredPin = '';
              updateDots();
            }
          }, 150);
        }
      }
    });
  });

  const clearBtn = document.getElementById('key-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      enteredPin = '';
      updateDots();
    });
  }

  const bspBtn = document.getElementById('key-backspace');
  if (bspBtn) {
    bspBtn.addEventListener('click', () => {
      enteredPin = enteredPin.slice(0, -1);
      updateDots();
    });
  }

  // استعادة الرمز المفقود
  const forgotPinBtn = document.getElementById('forgot-pin-btn');
  if (forgotPinBtn) {
    forgotPinBtn.addEventListener('click', async () => {
      const question = await getSecurityQuestion();
      document.getElementById('recovery-question-label').textContent = question;
      recoveryModal.style.display = 'flex';
    });
  }

  const recCancelBtn = document.getElementById('rec-cancel-btn');
  if (recCancelBtn) {
    recCancelBtn.onclick = () => {
      recoveryModal.style.display = 'none';
    };
  }

  const recSubmitBtn = document.getElementById('rec-submit-btn');
  if (recSubmitBtn) {
    recSubmitBtn.addEventListener('click', async () => {
      const ans = document.getElementById('rec-answer').value.trim();
      const newPin = document.getElementById('rec-new-pin').value.trim();
      const confirmNewPin = document.getElementById('rec-confirm-new-pin').value.trim();

      if (!ans) {
        showCustomAlert('حقل مطلوب', 'يرجى إدخال إجابة سؤال الأمان المسجلة.', 'warning');
        return;
      }
      if (newPin.length < 4 || newPin !== confirmNewPin) {
        showCustomAlert('خطأ في الرمز', 'الرمز الجديد غير صالح أو غير متطابق (يجب 4 أرقام).', 'error');
        return;
      }

      const res = await resetPinWithSecurityAnswer(ans, newPin);
      if (res.success) {
        showCustomAlert('نجاح العملية', res.message, 'success');
        recoveryModal.style.display = 'none';
        await recordLoginSession();
        await loginSuccess();
      } else {
        showCustomAlert('فشل الاستعادة', res.message, 'error');
      }
    });
  }

  // ----------------------------------------------------
  // نافذة بيانات المستخدم وإدارة التبويبات (Tabs)
  // ----------------------------------------------------
  const tabSecurityBtn = document.getElementById('tab-security-btn');
  const tabBackupBtn = document.getElementById('tab-backup-btn');
  const tabSecurityContent = document.getElementById('profile-tab-security-content');
  const tabBackupContent = document.getElementById('profile-tab-backup-content');

  if (tabSecurityBtn && tabBackupBtn) {
    tabSecurityBtn.onclick = () => {
      tabSecurityBtn.classList.add('active');
      tabBackupBtn.classList.remove('active');
      tabSecurityContent.style.display = 'block';
      tabBackupContent.style.display = 'none';
    };

    tabBackupBtn.onclick = () => {
      tabBackupBtn.classList.add('active');
      tabSecurityBtn.classList.remove('active');
      tabBackupContent.style.display = 'block';
      tabSecurityContent.style.display = 'none';
    };
  }

  const openUserProfileBtn = document.getElementById('open-user-profile-btn');
  if (openUserProfileBtn) {
    openUserProfileBtn.onclick = async (e) => {
      e.stopPropagation();
      const currentQ = await getSecurityQuestion();
      const secSelect = document.getElementById('profile-sec-question');
      if (secSelect) secSelect.value = currentQ;

      const currentTimeout = await getSessionTimeoutHours();
      const sessionSelect = document.getElementById('profile-session-timeout');
      if (sessionSelect) {
        sessionSelect.value = currentTimeout.toString();
        sessionSelect.onchange = async () => {
          await setSessionTimeoutHours(sessionSelect.value);
          showToast('تم تحديث مدة الجلسة بنجاح');
        };
      }

      const backupCfg = await AutoBackupManager.getBackupConfig();
      const savedDirName = await AutoBackupManager.getDirectoryName();

      const autoBackupToggle = document.getElementById('profile-auto-backup-toggle');
      const backupFreq = document.getElementById('profile-backup-frequency');
      const backupTime = document.getElementById('profile-backup-time');
      const dirLabel = document.getElementById('profile-backup-dir-label');

      if (autoBackupToggle) {
        autoBackupToggle.checked = !!backupCfg.enabled;
        autoBackupToggle.onchange = async () => {
          backupCfg.enabled = autoBackupToggle.checked;
          await AutoBackupManager.saveBackupConfig(backupCfg);
          showToast(backupCfg.enabled ? 'تم تفعيل التصدير التلقائي' : 'تم إيقاف التصدير التلقائي');
        };
      }

      if (backupFreq) backupFreq.value = backupCfg.frequency || 1;
      if (backupTime) backupTime.value = (backupCfg.times && backupCfg.times[0]) || '20:00';
      if (dirLabel) dirLabel.textContent = savedDirName ? `📁 المجلد: ${savedDirName}` : 'لم يتم تحديد مجلد بعد';

      // عرض معلومات الترخيص الدائم في البروفايل
      const licenseDevIdEl = document.getElementById('profile-license-device-id');
      if (licenseDevIdEl) {
        licenseDevIdEl.textContent = LicenseManager.getDeviceId();
      }

      const profileInstallBtn = document.getElementById('profile-install-pwa-btn');
      if (profileInstallBtn) {
        profileInstallBtn.onclick = () => triggerPWAInstall();
      }

      userProfileModal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    };
  }

  const closeUserProfileBtn = document.getElementById('close-user-profile-btn');
  if (closeUserProfileBtn) {
    closeUserProfileBtn.onclick = () => {
      userProfileModal.style.display = 'none';
    };
  }

  if (userProfileModal) {
    userProfileModal.onclick = (e) => {
      if (e.target === userProfileModal) userProfileModal.style.display = 'none';
    };
  }

  // تعيين وتحديث نمط القفل من البروفايل
  let setupPatternEngine = null;
  const setupPatternBtn = document.getElementById('profile-setup-pattern-btn');
  if (setupPatternBtn) {
    setupPatternBtn.onclick = () => {
      userProfileModal.style.display = 'none';
      setupPatternModal.style.display = 'flex';
      
      if (!setupPatternEngine) {
        setupPatternEngine = new PatternLockEngine('setup-pattern-canvas', async (patternStr) => {
          const res = await savePattern(patternStr);
          if (res.success) {
            showCustomAlert('تم الحفظ', 'تم تعيين نمط القفل بنجاح.', 'success');
            setupPatternModal.style.display = 'none';
            if (toggleAuthModeBtn) toggleAuthModeBtn.style.display = 'inline-flex';
          } else {
            showToast(res.message, 'warning');
            setTimeout(() => setupPatternEngine.reset(), 600);
          }
        });
      } else {
        setupPatternEngine.reset();
      }
    };
  }

  const setupPatternCancelBtn = document.getElementById('setup-pattern-cancel-btn');
  if (setupPatternCancelBtn) {
    setupPatternCancelBtn.onclick = () => {
      setupPatternModal.style.display = 'none';
    };
  }

  // اختيار مجلد النسخ الاحتياطي
  const chooseDirBtn = document.getElementById('profile-choose-backup-dir-btn');
  if (chooseDirBtn) {
    chooseDirBtn.onclick = async () => {
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          await AutoBackupManager.setDirectoryHandle(dirHandle);
          document.getElementById('profile-backup-dir-label').textContent = `📁 المجلد: ${dirHandle.name}`;
          showToast('تم تحديد وحفظ مسار المجلد بنجاح');
        } catch (err) {
          if (err.name !== 'AbortError') showToast('تعذر اختيار المجلد', 'error');
        }
      } else {
        showCustomAlert('غير مدعوم', 'المتصفح الحالي لا يدعم الوصول المباشر للمجلدات.', 'warning');
      }
    };
  }

  // حفظ إعدادات النسخ الاحتياطي
  const saveBackupCfgBtn = document.getElementById('profile-save-backup-cfg-btn');
  if (saveBackupCfgBtn) {
    saveBackupCfgBtn.onclick = async () => {
      const enabled = document.getElementById('profile-auto-backup-toggle').checked;
      const frequency = parseInt(document.getElementById('profile-backup-frequency').value);
      const time = document.getElementById('profile-backup-time').value;

      const currentConfig = await AutoBackupManager.getBackupConfig();
      currentConfig.enabled = enabled;
      currentConfig.frequency = frequency;
      currentConfig.times = [time];

      await AutoBackupManager.saveBackupConfig(currentConfig);
      showToast('تم حفظ إعدادات النسخ الاحتياطي بنجاح');
    };
  }

  // تفعيل البصمة
  const toggleBioBtn = document.getElementById('profile-toggle-biometrics-btn');
  if (toggleBioBtn) {
    toggleBioBtn.onclick = async () => {
      const success = await BiometricAuth.registerBiometrics();
      if (success) {
        showToast('تم تفعيل الدخول بالبصمة بنجاح');
        if (bioBtn) bioBtn.style.display = 'flex';
      }
    };
  }

  // تحديث الـ PIN
  const profileUpdatePinBtn = document.getElementById('profile-update-pin-btn');
  if (profileUpdatePinBtn) {
    profileUpdatePinBtn.onclick = async () => {
      const oldPin = document.getElementById('profile-old-pin').value.trim();
      const newPin = document.getElementById('profile-new-pin').value.trim();

      if (!oldPin || !newPin) {
        showCustomAlert('حقول فارغة', 'يرجى إدخال الرمز الحالي والرمز الجديد أولاً.', 'warning');
        return;
      }

      const res = await changePin(oldPin, newPin);
      if (res.success) {
        showCustomAlert('تم التحديث', res.message, 'success');
        document.getElementById('profile-old-pin').value = '';
        document.getElementById('profile-new-pin').value = '';
      } else {
        showCustomAlert('فشل التحديث', res.message, 'error');
      }
    };
  }

  // تحديث سؤال الأمان
  const profileUpdateSecBtn = document.getElementById('profile-update-sec-btn');
  if (profileUpdateSecBtn) {
    profileUpdateSecBtn.onclick = async () => {
      const question = document.getElementById('profile-sec-question').value;
      const answer = document.getElementById('profile-sec-answer').value.trim();

      if (!answer) {
        showCustomAlert('حقل مطلوب', 'يرجى كتابة الإجابة السرية الجديدة لحفظها.', 'warning');
        return;
      }

      const res = await updateSecurityQuestion(question, answer);
      showCustomAlert('تم الحفظ', res.message, 'success');
      document.getElementById('profile-sec-answer').value = '';
    };
  }

  // القائمة الجانبية (Drawer)
  const drawer = document.getElementById('sidebar-drawer');
  const openDrawerBtn = document.getElementById('open-drawer-btn');
  if (openDrawerBtn) {
    openDrawerBtn.onclick = (e) => {
      e.stopPropagation();
      drawer.style.display = 'block';
    };
  }

  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  if (closeDrawerBtn) {
    closeDrawerBtn.onclick = () => {
      drawer.style.display = 'none';
    };
  }

  if (drawer) {
    drawer.onclick = (e) => {
      if (e.target === drawer) drawer.style.display = 'none';
    };
  }

  const drawerInstallBtn = document.getElementById('drawer-install-pwa-btn');
  if (drawerInstallBtn) {
    drawerInstallBtn.onclick = () => {
      drawer.style.display = 'none';
      triggerPWAInstall();
    };
  }

  document.querySelectorAll('.drawer-nav-btn').forEach(btn => {
    btn.onclick = async () => {
      const view = btn.getAttribute('data-view');
      drawer.style.display = 'none';
      await renderView(view);
    };
  });

  // تسجيل الخروج
  async function logoutApp() {
    await clearSession();
    if (drawer) drawer.style.display = 'none';
    if (userProfileModal) userProfileModal.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (authScreen) authScreen.style.display = 'flex';
    enteredPin = '';
    updateDots();
    showToast('تم تسجيل الخروج وقفل التطبيق بنجاح');
  }

  const drawerLogoutBtn = document.getElementById('drawer-logout-btn');
  if (drawerLogoutBtn) drawerLogoutBtn.onclick = logoutApp;

  const profileLogoutBtn = document.getElementById('profile-logout-btn');
  if (profileLogoutBtn) profileLogoutBtn.onclick = logoutApp;

  // مركز التنبيهات
  const notifModal = document.getElementById('notification-modal');
  const notifDot = document.getElementById('nav-notif-dot');
  const notifList = document.getElementById('notifications-list');

  const openNotifBtn = document.getElementById('open-notifications-btn');
  if (openNotifBtn) {
    openNotifBtn.onclick = (e) => {
      e.stopPropagation();
      notifModal.style.display = 'flex';
      if (notifDot) notifDot.style.display = 'none';
    };
  }

  const closeNotifBtn = document.getElementById('close-notifications-btn');
  if (closeNotifBtn) {
    closeNotifBtn.onclick = () => {
      notifModal.style.display = 'none';
    };
  }

  if (notifModal) {
    notifModal.onclick = (e) => {
      if (e.target === notifModal) notifModal.style.display = 'none';
    };
  }

  async function checkLongParkingAndBackupNotifs() {
    const cars = await db.cars.where('status').equals('موجودة').toArray();
    const now = new Date();
    let notifications = [];

    cars.forEach(car => {
      if (car.entryDate) {
        const entry = new Date(car.entryDate);
        const diffHours = Math.abs(now - entry) / 36e5;
        if (diffHours >= 24) {
          notifications.push({
            type: 'car',
            icon: 'clock',
            color: 'var(--warning)',
            bg: 'var(--warning-light)',
            text: `السيارة <b>${car.carType}</b> (${car.plateNumber}) متواجدة منذ أكثر من 24 ساعة في الموقف ${car.boxNumber || '-'}.`
          });
        }
      }
    });

    const pendingAlert = await db.settings.get('pending_backup_alert');
    if (pendingAlert && pendingAlert.value) {
      notifications.push({
        type: 'permission_request',
        icon: 'folder-sync',
        color: 'var(--warning)',
        bg: 'var(--warning-light)',
        text: `يرجى تأكيد إذن حفظ النسخة الاحتياطية في المجلد المختار.<br><button id="btn-grant-backup-permission" style="margin-top: 6px; background: var(--primary); color: white; border: none; padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer;">تأكيد وتصدير الآن</button>`
      });
    }

    const backupLogs = await db.settings.get('backup_logs');
    if (backupLogs && backupLogs.value && backupLogs.value.length > 0) {
      backupLogs.value.forEach((log, idx) => {
        notifications.push({
          type: 'backup',
          icon: 'database',
          color: 'var(--primary)',
          bg: 'rgba(59, 130, 246, 0.1)',
          text: `نسخة قاعدة البيانات (${idx === 0 ? 'الأخيرة' : 'السابقة'}): تم التصدير بتاريخ <b>${log.date}</b><br><small style="color: var(--text-muted);">الملف: ${log.file} [${log.type}]</small>`
        });
      });
    }

    if (notifications.length > 0) {
      if (notifDot) notifDot.style.display = 'block';
      if (notifList) {
        notifList.innerHTML = notifications.map(n => `
          <div style="background: ${n.bg}; color: ${n.color}; padding: 12px; border-radius: 10px; font-size: 12px; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px;">
            <i data-lucide="${n.icon}" style="width: 18px; min-width: 18px; margin-top: 2px;"></i>
            <div style="width: 100%;">${n.text}</div>
          </div>
        `).join('');

        const grantBtn = document.getElementById('btn-grant-backup-permission');
        if (grantBtn) {
          grantBtn.onclick = async () => {
            const handle = await AutoBackupManager.getDirectoryHandle();
            if (handle) {
              const ok = await AutoBackupManager.performBackup(handle, 'تأكيد يدوي', true);
              if (ok) {
                showToast('تم تصدير النسخة وحفظها في المجلد بنجاح');
                checkLongParkingAndBackupNotifs();
              }
            }
          };
        }
      }
    } else {
      if (notifList) {
        notifList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">لا توجد تنبيهات حالياً</div>`;
      }
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // شريط التنقل السفلي
  navTabs.forEach(tab => {
    tab.onclick = async () => {
      const view = tab.getAttribute('data-view');
      await renderView(view);
    };
  });

  const quickActionBtn = document.getElementById('quick-action-btn');
  if (quickActionBtn) {
    quickActionBtn.onclick = async () => {
      await renderView('cars');
      setTimeout(() => {
        if (window.openNewCarModal) window.openNewCarModal();
      }, 100);
    };
  }
}
