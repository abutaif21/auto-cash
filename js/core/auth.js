import { db } from './db.js';

// تجزئة النصوص المشفرة SHA-256 باستخدام Web Crypto API
async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// حفظ الرمز وسؤال الأمان لأول مرة
export async function setupInitialSecurity(pin, question, answer) {
  const hashedPin = await hashText(pin);
  const hashedAnswer = await hashText(answer);

  await db.settings.put({ key: 'user_pin', value: hashedPin });
  await db.settings.put({ key: 'security_question', value: question });
  await db.settings.put({ key: 'security_answer', value: hashedAnswer });
  await recordLoginSession();
  return true;
}

// التحقق من صحة الـ PIN
export async function verifyPin(inputPin) {
  const setting = await db.settings.get('user_pin');
  if (!setting || !setting.value) return true;
  
  const hashedInput = await hashText(inputPin);
  const isValid = hashedInput === setting.value;
  if (isValid) {
    await recordLoginSession();
  }
  return isValid;
}

// ==========================================
// 🔒 إدارة قفل النمط (Pattern Lock)
// ==========================================

// حفظ أو تحديث نمط القفل الجديد
export async function savePattern(patternString) {
  if (!patternString || patternString.length < 4) {
    return { success: false, message: 'يجب أن يتكون النمط من 4 نقاط على الأقل' };
  }
  const hashedPattern = await hashText(patternString);
  await db.settings.put({ key: 'user_pattern', value: hashedPattern });
  await recordLoginSession();
  return { success: true, message: 'تم حفظ نمط القفل بنجاح' };
}

// التحقق من صحة النمط المرسوم
export async function verifyPattern(inputPattern) {
  const setting = await db.settings.get('user_pattern');
  if (!setting || !setting.value) return false;

  const hashedInput = await hashText(inputPattern);
  const isValid = hashedInput === setting.value;
  if (isValid) {
    await recordLoginSession();
  }
  return isValid;
}

// فحص هل تم تعيين نمط من قبل
export async function hasPatternSetup() {
  const setting = await db.settings.get('user_pattern');
  return !!(setting && setting.value);
}

// ==========================================
// ⏳ إدارة صلاحية وزمن الجلسة (Session Timeout)
// ==========================================

// حفظ خيار مدة الجلسة بالساعات (0 = إغلاق فوري عند كل فتح)
export async function setSessionTimeoutHours(hours) {
  await db.settings.put({ key: 'session_timeout_hours', value: Number(hours) });
  return true;
}

// جلب مدة الجلسة المحددة (القيمة الافتراضية 0 = طلب الرمز دائماً)
export async function getSessionTimeoutHours() {
  const record = await db.settings.get('session_timeout_hours');
  return record ? Number(record.value) : 0;
}

// تسجيل توقيت تسجيل الدخول النشط
export async function recordLoginSession() {
  const now = Date.now();
  await db.settings.put({ key: 'last_login_timestamp', value: now });
  try {
    localStorage.setItem('autocash_last_session', now.toString());
  } catch (e) {}
}

// فحص هل الجلسة الحالية ما زالت نشطة
export async function isSessionValid() {
  const timeoutHours = await getSessionTimeoutHours();
  // إذا كان الإعداد 0 يعني يطلب الرمز في كل مرة
  if (timeoutHours === 0) return false;

  let lastLogin = null;
  const record = await db.settings.get('last_login_timestamp');
  if (record && record.value) {
    lastLogin = Number(record.value);
  } else {
    const local = localStorage.getItem('autocash_last_session');
    if (local) lastLogin = Number(local);
  }

  if (!lastLogin) return false;

  const now = Date.now();
  const maxDiffMs = timeoutHours * 60 * 60 * 1000;
  return (now - lastLogin) < maxDiffMs;
}

// مسح الجلسة عند تسجيل الخروج
export async function clearSession() {
  await db.settings.put({ key: 'last_login_timestamp', value: 0 });
  try {
    localStorage.removeItem('autocash_last_session');
  } catch (e) {}
}

// ==========================================
// 🛡️ استعادة وتحديث البيانات
// ==========================================

// جلب سؤال الأمان المسجل
export async function getSecurityQuestion() {
  const q = await db.settings.get('security_question');
  return q ? q.value : 'ما هو اسم سيارتك المفضلة؟';
}

// تحديث سؤال الأمان والإجابة
export async function updateSecurityQuestion(question, newAnswer) {
  const hashedAnswer = await hashText(newAnswer);
  await db.settings.put({ key: 'security_question', value: question });
  await db.settings.put({ key: 'security_answer', value: hashedAnswer });
  return { success: true, message: 'تم تحديث سؤال الأمان بنجاح' };
}

// التحقق من إجابة الأمان وتعيين رمز جديد
export async function resetPinWithSecurityAnswer(answer, newPin) {
  const setting = await db.settings.get('security_answer');
  if (!setting || !setting.value) {
    return { success: false, message: 'لم يتم تعيين سؤال أمان مسبقاً' };
  }

  const hashedInputAnswer = await hashText(answer);
  if (hashedInputAnswer !== setting.value) {
    return { success: false, message: 'إجابة سؤال الأمان غير صحيحة' };
  }

  const newHashedPin = await hashText(newPin);
  await db.settings.put({ key: 'user_pin', value: newHashedPin });
  await recordLoginSession();
  return { success: true, message: 'تم إعادة تعيين رمز الدخول بنجاح' };
}

// تغيير الـ PIN من شاشة الإعدادات أو الملف الشخصي
export async function changePin(oldPin, newPin) {
  const isValid = await verifyPin(oldPin);
  if (!isValid) {
    return { success: false, message: 'الرمز السري الحالي غير صحيح' };
  }
  const newHashedPin = await hashText(newPin);
  await db.settings.put({ key: 'user_pin', value: newHashedPin });
  await recordLoginSession();
  return { success: true, message: 'تم تحديث رمز الدخول بنجاح' };
}
