/* global authValidation */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("resetPasswordForm");
    const alertContainer = document.getElementById("auth-alert");
    const submitBtn = document.getElementById("resetSubmitBtn");
    const newPasswordField = document.getElementById("new-password");
    const confirmPasswordField =
      document.getElementById("confirm-password");

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      if (alertContainer) {
        alertContainer.innerHTML =
          '<div class="auth-alert auth-alert--error"><i class="fas fa-exclamation-circle"></i><span>Invalid or missing reset token. Please request a new password reset.</span></div>';
      }
      submitBtn.disabled = true;
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

    function setupPasswordToggle(toggleBtn, toggleIcon, passwordField) {
      if (toggleBtn && toggleIcon && passwordField) {
        toggleBtn.addEventListener("click", function (e) {
          e.preventDefault();
          const isPassword = passwordField.type === "password";
          passwordField.type = isPassword ? "text" : "password";
          toggleIcon.className = isPassword
            ? "fas fa-eye-slash"
            : "fas fa-eye";
        });
      }
    }

    setupPasswordToggle(
      document.getElementById("toggleNewPassword"),
      document.getElementById("toggleNewPasswordIcon"),
      newPasswordField,
    );
    setupPasswordToggle(
      document.getElementById("toggleConfirmPassword"),
      document.getElementById("toggleConfirmPasswordIcon"),
      confirmPasswordField,
    );

    [newPasswordField, confirmPasswordField].forEach(function (field) {
      field.addEventListener("input", function () {
        authValidation.clearFieldError(field);
      });
    });

    function validateForm() {
      clearAlert();
      let valid = true;

      if (!authValidation.isRequired(newPasswordField.value)) {
        authValidation.showFieldError(
          newPasswordField,
          "Please enter a new password",
        );
        valid = false;
      } else if (newPasswordField.value.length < 6) {
        authValidation.showFieldError(
          newPasswordField,
          "Password must be at least 6 characters",
        );
        valid = false;
      }

      if (!authValidation.isRequired(confirmPasswordField.value)) {
        authValidation.showFieldError(
          confirmPasswordField,
          "Please confirm your password",
        );
        valid = false;
      } else if (
        !authValidation.doPasswordsMatch(
          newPasswordField.value,
          confirmPasswordField.value,
        )
      ) {
        authValidation.showFieldError(
          confirmPasswordField,
          "Passwords do not match",
        );
        valid = false;
      }

      return valid;
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!validateForm()) return;

      const password = newPasswordField.value;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="auth-spinner"></span> Resetting...';

      try {
        const response = await apiService.post("/auth/reset-password", {
          token: token,
          password: password,
        });

        if (response.success) {
          showAlert(
            "Password reset successful! Redirecting to login...",
            "success",
          );
          setTimeout(function () {
            window.location.href =
              "login.html?message=Password%20reset%20successfully.%20Please%20log%20in.";
          }, 2000);
        } else {
          throw new Error(response.message || "Reset failed");
        }
      } catch (error) {
        showAlert(
          error.message ||
            "Failed to reset password. The token may have expired.",
          "error",
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i class="fas fa-save" aria-hidden="true"></i><span>Reset Password</span>';
      }
    });
  });
})();
