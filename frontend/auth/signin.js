/**
 * FoodBridge — Sign In Page Controller
 * Handles the login form, validation, social auth, and session checks.
 * Depends on: authValidation, authApi, ui (from app.js)
 */

(function () {
  "use strict";

  // SECURITY: Safe text escaping to prevent XSS
  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* ── Redirect if already logged in ── */
    /* ── DOM References ── */
    var form = document.getElementById("loginForm");
    var alertContainer = document.getElementById("auth-alert");
    var submitBtn = document.getElementById("loginSubmitBtn");
    var emailField = document.getElementById("login-email");
    var passwordField = document.getElementById("login-password");
    var toggleBtn = document.getElementById("togglePassword");
    var toggleIcon = document.getElementById("togglePasswordIcon");

    if (!form || !emailField || !passwordField) {
      console.error("[SignIn] Required form elements not found.");
      return;
    }

    setupSocialComingSoon("socialLoginStatus", "sign-in");

    var authApi = window.authApi;
    var authValidation = window.authValidation;

    if (!authApi || !authValidation || !window.authService) {
      if (alertContainer) {
        var errorMsg = "Authentication tools failed to load. Refresh the page and try again.";
        alertContainer.innerHTML =
          '<div class="auth-alert auth-alert--error"><i class="fas fa-exclamation-circle"></i><span>' +
          escapeHtml(errorMsg) +
          '</span></div>';
      }
      submitBtn.disabled = true;
      return;
    }

    if (authApi.isLoggedIn()) {
      authApi.redirectAfterLogin();
      return;
    }

    /* ── Real-time validation + button enable ── */

    function setupSocialComingSoon(statusId, actionLabel) {
      var status = document.getElementById(statusId);
      var buttons = document.querySelectorAll("[data-social-provider]");

      buttons.forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();

          buttons.forEach(function (item) {
            item.classList.remove("auth-social-provider--active");
          });
          button.classList.add("auth-social-provider--active");

          if (status) {
            var provider =
              button.getAttribute("data-social-provider") || "Social";
            status.hidden = false;
            status.textContent =
              provider +
              " " +
              actionLabel +
              " is coming soon. Use email and password for now.";
          }
        });
      });
    }

    function updateSubmitState() {
      var emailOk = authValidation.isValidEmail(emailField.value);
      var passwordOk = authValidation.isRequired(passwordField.value);
      submitBtn.disabled = !(emailOk && passwordOk);
    }

    emailField.addEventListener("input", function () {
      authValidation.clearFieldError(emailField);
      clearAlert();
      updateSubmitState();
    });

    passwordField.addEventListener("input", function () {
      authValidation.clearFieldError(passwordField);
      clearAlert();
      updateSubmitState();
    });

    /* ── Password toggle ── */

    if (toggleBtn && toggleIcon) {
      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var isPassword = passwordField.type === "password";
        passwordField.type = isPassword ? "text" : "password";
        toggleIcon.className = isPassword ? "fas fa-eye-slash" : "fas fa-eye";
        toggleBtn.setAttribute("aria-pressed", isPassword ? "true" : "false");
      });
    }

    /* ── Validate form ── */

    function validateForm() {
      clearAlert();
      var valid = true;

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

      if (!authValidation.isRequired(passwordField.value)) {
        authValidation.showFieldError(
          passwordField,
          "Please enter your password",
        );
        valid = false;
      }

      return valid;
    }

    /* ── Alerts ── */

    function showAlert(message, type) {
      if (!alertContainer) return;
      var iconMap = {
        error: "fa-exclamation-circle",
        success: "fa-check-circle",
        info: "fa-info-circle",
        warning: "fa-exclamation-triangle",
      };
      // SECURITY: Escape message to prevent XSS
      var escapedMessage = escapeHtml(message);
      alertContainer.innerHTML =
        '<div class="auth-alert auth-alert--' +
        type +
        '">' +
        '<i class="fas ' +
        (iconMap[type] || iconMap.info) +
        '"></i>' +
        "<span>" +
        escapedMessage +
        "</span>" +
        "</div>";
    }

    function clearAlert() {
      if (alertContainer) alertContainer.innerHTML = "";
    }

    /* ── Submit handler ── */

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!validateForm()) return;

      var email = emailField.value.trim();
      var password = passwordField.value;

      setLoading(true);

      try {
        var result = await authApi.login(email, password);

        if (result && result.success) {
          showAlert("Login successful! Redirecting...", "success");
          
          // Clear any stale local data first
          localStorage.removeItem("redirectAfterLogin");
          
          setTimeout(function () {
            authApi.redirectAfterLogin();
          }, 800);
        } else {
          throw new Error(
            result?.message || "Login failed. Please check your credentials.",
          );
        }
      } catch (error) {
        let message = "Invalid email or password";
        if (error.status === 401) {
          message = "Invalid credentials. Please try again.";
        } else if (error.status === 500 || error.status === 503) {
          message = "Server error. Please try again later.";
        } else if (error.message) {
          message = error.message;
        }
        
        showAlert(message, "error");
        authValidation.clearFieldError(emailField);
        authValidation.clearFieldError(passwordField);
      } finally {
        setLoading(false);
      }
    });

    /* ── Loading state ── */
    var originalBtnText = null;

    function setLoading(loading) {
      if (loading) {
        originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;
      } else {
        submitBtn.innerHTML = originalBtnText || submitBtn.innerHTML;
        updateSubmitState();
      }
    }


    /* ── URL params (session_expired, redirect) ── */

    var urlParams = new URLSearchParams(window.location.search);
    var errorParam = urlParams.get("error");
    var messageParam = urlParams.get("message");

    if (errorParam === "session_expired") {
      showAlert("Your session has expired. Please log in again.", "warning");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (messageParam) {
      showAlert(messageParam, "info");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Store redirect target if present
    var redirect = urlParams.get("redirect");
    if (redirect) {
      sessionStorage.setItem(
        "redirectAfterLogin",
        decodeURIComponent(redirect),
      );
    }
  });
})();
