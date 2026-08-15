// عرض إشعار عائم Toast
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-msg';

  let iconName = 'check-circle-2';
  let color = 'var(--primary)';

  if (type === 'error') {
    iconName = 'alert-circle';
    color = 'var(--danger)';
  } else if (type === 'warning') {
    iconName = 'alert-triangle';
    color = 'var(--warning)';
  }

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 20px; height: 20px; color: ${color};"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// عرض نافذة تأكيد الإجراء Custom Confirm Dialog
export function showConfirmDialog({ title, message, onConfirm }) {
  const modal = document.getElementById('custom-dialog-modal');
  const titleEl = document.getElementById('dialog-title');
  const msgEl = document.getElementById('dialog-message');
  const confirmBtn = document.getElementById('dialog-confirm-btn');
  const cancelBtn = document.getElementById('dialog-cancel-btn');

  if (!modal) return;

  titleEl.textContent = title || 'تأكيد الإجراء';
  msgEl.textContent = message || 'هل أنت متأكد؟';

  modal.style.display = 'flex';

  const cleanup = () => {
    modal.style.display = 'none';
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = () => {
    cleanup();
    if (onConfirm) onConfirm();
  };

  cancelBtn.onclick = () => {
    cleanup();
  };
}
