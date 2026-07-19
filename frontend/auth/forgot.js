/* global authValidation */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("forgotPasswordForm");
    const alertContainer = document.getElementById("auth-alert");
    const submitBtn = document.getElementById("forgotSubmitBtn");
    const emailField = document.getElementById("forgot-email");

    if (!form || !emailField) {
      console.error("[ForgotPassword] Required elements not found.");
      return;
    }

    function showAlert(message, type) {
      if (!alertContainer) return;
      const iconMap = {
        error: "fa-exclamation-circle",
        success: "fa-check-circle",
        info: "fa-info-circle",
        warning: "fa-exclamation-triangle",
      };
      alertContainer.innerHTML =
        '<div class="auth-alert auth-alert--' +
        type +
        '">' +
        '<i class="fas ' +
        (iconMap[type] || iconMap.info) +
        '"></i>' +
        "<span>" +
        message +
        "</span>" +
        "</div>";
    }

    function clearAlert() {
      if (alertContainer) alertContainer.innerHTML = "";
    }

    emailField.addEventListener("input", function () {
      authValidation.clearFieldError(emailField);
    });

    function validateForm() {
      clearAlert();
      let valid = true;

      if (
        !authValidation.isRequired(emailField.value) ||
        !authValidation.isValidEmail(emailField.value)
      ) {
        authValidation.showFieldError(
          emailField,
          "Please enter a valid email address",
        );
        valid = false;
      }
      return valid;
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!validateForm()) return;

      const email = emailField.value.trim();
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="auth-spinner"></span> Sending...';

      try {
        const response = await apiService.post("/auth/forgot-password", {
          email,
        });

        if (response.success) {
          showAlert(
            "If an account exists, a password reset link has been sent to your email.",
            "success",
          );
          form.reset();
        } else {
          throw new Error(response.message || "Request failed");
        }
      } catch (error) {
        showAlert(
          error.message || "Failed to send reset link. Please try again.",
          "error",
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i class="fas fa-paper-plane" aria-hidden="true"></i><span>Send Reset Link</span>';
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const messageParam = urlParams.get("message");
    if (messageParam) {
      showAlert(decodeURIComponent(messageParam), "info");
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      );
    }
  });
})();
