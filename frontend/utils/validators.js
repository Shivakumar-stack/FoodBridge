/**
 * FoodBridge - Global Form Validation Utility
 * Standardizes form checks across all portals.
 */

const Validators = {
  // Common Regex
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phoneRegex: /^\+?[\d\s-()]{10,15}$/,

  /**
   * Validate Email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    return this.emailRegex.test(email.trim());
  },

  /**
   * Validate US/IN Phone format
   * @param {string} phone
   * @returns {boolean}
   */
  isValidPhone(phone) {
    return this.phoneRegex.test(phone.trim());
  },

  /**
   * Validate Required Field
   * @param {string|number|object} value
   * @returns {boolean}
   */
  isRequired(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },

  /**
   * Validate File size (default 5MB)
   * @param {File} file
   * @param {number} maxSizeMB
   * @returns {boolean}
   */
  isValidFileSize(file, maxSizeMB = 5) {
    if (!file) return false;
    const sizeMB = file.size / (1024 * 1024);
    return sizeMB <= maxSizeMB;
  },

  /**
   * Prevent double firing on buttons
   * @param {HTMLButtonElement} btnElement
   * @param {boolean} isLoading
   */
  setLoadingState(btnElement, isLoading, loadingText = "Processing...") {
    if (!btnElement) return;
    if (isLoading) {
      btnElement.disabled = true;
      btnElement.dataset.originalText = btnElement.innerHTML;
      btnElement.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${loadingText}`;
      btnElement.classList.add("opacity-75", "cursor-not-allowed");
    } else {
      btnElement.disabled = false;
      if (btnElement.dataset.originalText) {
        btnElement.innerHTML = btnElement.dataset.originalText;
      }
      btnElement.classList.remove("opacity-75", "cursor-not-allowed");
    }
  },
};

window.Validators = Validators;
