/**
 * Tailwind-based Toast Notification Utility
 * Replaces native alert() calls across the application
 */

const toast = {
  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - 'success', 'error', 'info', 'warning'
   * @param {number} duration - Duration in ms before hiding (default: 3000)
   */
  show(message, type = 'info', duration = 3000) {
    // Prevent duplicate toasts with same message
    const existingToasts = document.querySelectorAll('.toast-notification');
    for (const existing of existingToasts) {
      if (existing.innerText.includes(message)) {
        return; // Don't show duplicate
      }
    }

    const toastEl = document.createElement('div');
    toastEl.className = `toast-notification fixed top-5 right-5 z-[9999] max-w-sm px-6 py-4 rounded-xl shadow-2xl transition-all duration-300 transform translate-x-full opacity-0 flex items-start gap-3 backdrop-blur-md`;
    
    // Style based on type
    let icon = '';
    switch (type) {
      case 'success':
        toastEl.classList.add('bg-emerald-50/90', 'border', 'border-emerald-200', 'text-emerald-800');
        icon = '<i class="fas fa-check-circle text-emerald-500 mt-0.5 text-lg"></i>';
        break;
      case 'error':
        toastEl.classList.add('bg-red-50/90', 'border', 'border-red-200', 'text-red-800');
        icon = '<i class="fas fa-exclamation-circle text-red-500 mt-0.5 text-lg"></i>';
        break;
      case 'warning':
        toastEl.classList.add('bg-amber-50/90', 'border', 'border-amber-200', 'text-amber-800');
        icon = '<i class="fas fa-exclamation-triangle text-amber-500 mt-0.5 text-lg"></i>';
        break;
      case 'info':
      default:
        toastEl.classList.add('bg-blue-50/90', 'border', 'border-blue-200', 'text-blue-800');
        icon = '<i class="fas fa-info-circle text-blue-500 mt-0.5 text-lg"></i>';
        break;
    }

    toastEl.innerHTML = `
      <div class="shrink-0">${icon}</div>
      <div class="flex-1 font-medium text-sm pt-0.5">${message}</div>
      <button class="shrink-0 ml-2 text-current opacity-50 hover:opacity-100 transition-opacity" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    document.body.appendChild(toastEl);

    // Trigger animation
    requestAnimationFrame(() => {
      toastEl.classList.remove('translate-x-full', 'opacity-0');
    });

    // Auto remove
    setTimeout(() => {
      toastEl.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => {
        if (document.body.contains(toastEl)) {
          toastEl.remove();
        }
      }, 300);
    }, duration);
  }
};

window.toast = toast;
