export async function enablePersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log(`حالة تفعيل التخزين الدائم: ${granted ? 'تم التفعيل' : 'تم الرفض'}`);
      return granted;
    }
    return true;
  }
  return false;
}

// دالة لمعرفة المساحة المستخدمة والمتبقية
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      usedMB: (usage / (1024 * 1024)).toFixed(2),
      totalMB: (quota / (1024 * 1024)).toFixed(2),
      percentage: ((usage / quota) * 100).toFixed(1)
    };
  }
  return null;
}
