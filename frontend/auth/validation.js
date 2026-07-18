/**
 * FoodBridge — Auth Validation Module
 * Centralized form validation for sign-in and sign-up pages.
 */

(function () {
  "use strict";

  const REGEX = {
    // Better email regex following RFC 5322 (simplified)
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    // Support: 10-digit (India), +91..., +1..., etc.
    phone: /^(\+\d{1,3}[-.\s]?)?\d{7,14}$/,
  };

  const authValidation = {
    /* ── Value checks ── */

    isRequired(value) {
      return typeof value === "string" && value.trim().length > 0;
    },

    isValidEmail(email) {
      return REGEX.email.test((email || "").trim());
    },

    isValidPhone(phone) {
      const trimmed = (phone || "").trim();
      if (!trimmed) return true; // phone is optional
      return REGEX.phone.test(trimmed);
    },

    isMinLength(value, min) {
      return (value || "").length >= min;
    },

    isStrongPassword(password) {
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password || "");
    },

    doPasswordsMatch(password, confirmPassword) {
      return password === confirmPassword;
    },

    /* ── Password strength (0–4) ── */

    getPasswordStrength(password) {
      if (!password || password.length < 6) return 0;
      let score = 0;
      if (password.length >= 8) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[a-z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      // Normalize to 0–4
      return Math.min(Math.floor(score / 1.25), 4);
    },

    /* ── UI: show field error ── */

    showFieldError(field, message) {
      if (!field) return;
      
      if (field.type === "checkbox") {
        const parent = field.closest(".auth-terms") || field.closest(".auth-remember") || field.parentElement;
        parent.classList.add("auth-input--error");
      } else {
        field.classList.add("auth-input--error");
      }
      
      field.setAttribute("aria-invalid", "true");

      const errorContainerId = field.getAttribute("aria-describedby");
      const errorContainer = errorContainerId
        ? document.getElementById(errorContainerId)
        : null;

      if (errorContainer) {
        errorContainer.innerHTML =
          '<p class="auth-field-error"><i class="fas fa-exclamation-circle"></i> ' +
          this._escapeHtml(message) +
          "</p>";
      }
    },

    /* ── UI: clear field error ── */

    clearFieldError(field) {
      if (!field) return;
      
      if (field.type === "checkbox") {
        const parent = field.closest(".auth-terms") || field.closest(".auth-remember") || field.parentElement;
        parent.classList.remove("auth-input--error");
      } else {
        field.classList.remove("auth-input--error");
      }
      
      field.removeAttribute("aria-invalid");

      const errorContainerId = field.getAttribute("aria-describedby");
      const errorContainer = errorContainerId
        ? document.getElementById(errorContainerId)
        : null;

      if (errorContainer) {
        errorContainer.innerHTML = "";
      }
    },

    /* ── UI: clear all errors in a form ── */

    clearAllErrors(form) {
      if (!form) return;
      form.querySelectorAll(".auth-input--error").forEach(function (field) {
        authValidation.clearFieldError(field);
      });
    },

    /* ── Internal: HTML escape ── */

    _escapeHtml(str) {
      var div = document.createElement("div");
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    },
  };

  // Expose globally
  window.authValidation = authValidation;
})();
