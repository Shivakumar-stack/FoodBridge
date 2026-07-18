/**
 * FoodBridge — Sign Up Page Controller
 * Multi-step signup form with validation, role selection, and password strength.
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
    var form = document.getElementById("signupForm");
    var alertContainer = document.getElementById("auth-alert");
    var submitBtn = document.getElementById("signupSubmitBtn");
    var totalSteps = 3;
    var currentStep = 1;

    if (!form) {
      console.error("[SignUp] Signup form not found.");
      return;
    }

    setupSocialComingSoon("socialSignupStatus", "sign-up");

    var authApi = window.authApi;
    var authValidation = window.authValidation;

    if (!authApi || !authValidation || !window.authService) {
      showAlert(alertContainer, "Authentication tools failed to load. Refresh the page and try again.", "error");
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (authApi.isLoggedIn()) {
      authApi.redirectAfterLogin();
      return;
    }

    /* ── Step Navigation ── */

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

    function showStep(step) {
      document.querySelectorAll(".auth-form-step").forEach(function (el) {
        el.classList.remove("auth-form-step--active");
      });
      var target = document.querySelector(
        '.auth-form-step[data-step="' + step + '"]',
      );
      if (target) target.classList.add("auth-form-step--active");
      currentStep = step;
      updateStepIndicators();
      clearAlert();
    }

    function updateStepIndicators() {
      document.querySelectorAll(".auth-step-indicator").forEach(function (el) {
        var step = parseInt(el.getAttribute("data-step"), 10);
        el.classList.remove(
          "auth-step-indicator--active",
          "auth-step-indicator--completed",
        );

        if (step < currentStep) {
          el.classList.add("auth-step-indicator--completed");
          el.innerHTML = '<i class="fas fa-check"></i>';
        } else if (step === currentStep) {
          el.classList.add("auth-step-indicator--active");
          el.textContent = step;
        } else {
          el.textContent = step;
        }
      });

      document.querySelectorAll(".auth-step-line").forEach(function (el) {
        var lineIndex = parseInt(el.getAttribute("data-line"), 10);
        if (lineIndex < currentStep) {
          el.classList.add("auth-step-line--active");
        } else {
          el.classList.remove("auth-step-line--active");
        }
      });

      // Update progressbar aria
      var progressbar = document.querySelector("[role='progressbar']");
      if (progressbar) progressbar.setAttribute("aria-valuenow", currentStep);
    }

    /* ── Next / Previous buttons ── */

    document
      .querySelectorAll('[data-action="next-step"]')
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (validateCurrentStep() && currentStep < totalSteps) {
            showStep(currentStep + 1);
          }
        });
      });

    document
      .querySelectorAll('[data-action="prev-step"]')
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (currentStep > 1) {
            showStep(currentStep - 1);
          }
        });
      });

    /* ── Step Validation ── */

    function validateCurrentStep() {
      authValidation.clearAllErrors(form);
      clearAlert();

      if (currentStep === 1) return validateStep1();
      if (currentStep === 2) return validateStep2();
      return validateStep3();
    }

    function validateStep1() {
      var firstName = form.querySelector('[name="firstName"]');
      var lastName = form.querySelector('[name="lastName"]');
      var email = form.querySelector('[name="email"]');
      var phone = form.querySelector('[name="phone"]');
      var errors = [];

      if (!authValidation.isRequired(firstName.value)) {
        authValidation.showFieldError(firstName, "First name is required");
        errors.push("First name is required");
      }

      if (!authValidation.isRequired(lastName.value)) {
        authValidation.showFieldError(lastName, "Last name is required");
        errors.push("Last name is required");
      }

      if (!authValidation.isRequired(email.value)) {
        authValidation.showFieldError(email, "Email is required");
        errors.push("Email is required");
      } else if (!authValidation.isValidEmail(email.value)) {
        authValidation.showFieldError(email, "Enter a valid email address");
        errors.push("Enter a valid email address");
      }

      if (!authValidation.isValidPhone(phone.value)) {
        authValidation.showFieldError(phone, "Enter a valid phone number");
        errors.push("Enter a valid phone number");
      }

      if (errors.length) {
        showAlert(errors[0], "error");
      }
      return errors.length === 0;
    }

    function validateStep2() {
      var role = form.querySelector('input[name="role"]:checked');
      if (!role) {
        showAlert("Please select a role to continue", "error");
        return false;
      }
      return true;
    }

    function validateStep3() {
      var password = form.querySelector('[name="password"]');
      var confirmPassword = form.querySelector('[name="confirmPassword"]');
      var terms = form.querySelector('[name="terms"]');
      var errors = [];

      if (!authValidation.isRequired(password.value)) {
        authValidation.showFieldError(password, "Password is required");
        errors.push("Password is required");
      } else if (!authValidation.isStrongPassword(password.value)) {
        authValidation.showFieldError(
          password,
          "Password must be at least 8 characters and contain 1 uppercase, 1 lowercase, 1 number, and 1 special character",
        );
        errors.push("Password must meet strength requirements");
      }

      if (!authValidation.isRequired(confirmPassword.value)) {
        authValidation.showFieldError(
          confirmPassword,
          "Please confirm your password",
        );
        errors.push("Please confirm your password");
      } else if (
        !authValidation.doPasswordsMatch(password.value, confirmPassword.value)
      ) {
        authValidation.showFieldError(
          confirmPassword,
          "Passwords do not match",
        );
        errors.push("Passwords do not match");
      }

      if (terms && !terms.checked) {
        authValidation.showFieldError(terms, "You must accept the Terms of Service and Privacy Policy");
        errors.push("You must accept the Terms of Service and Privacy Policy");
      }

      if (errors.length) {
        showAlert(errors[0], "error");
      }
      return errors.length === 0;
    }

    /* ── Real-time: clear errors on input ── */

    form.querySelectorAll("input, textarea, select").forEach(function (el) {
      el.addEventListener("input", function () {
        authValidation.clearFieldError(el);
        clearAlert();
      });
    });

    /* ── Role Card Selection ── */

    function syncRoleCards() {
      document.querySelectorAll(".auth-role-card").forEach(function (card) {
        var input = card.querySelector('input[type="radio"]');
        if (input && input.checked) {
          card.classList.add("auth-role-card--selected");
        } else {
          card.classList.remove("auth-role-card--selected");
        }
      });
    }

    document.querySelectorAll(".auth-role-card").forEach(function (card) {
      var input = card.querySelector('input[type="radio"]');
      if (input) {
        input.addEventListener("change", syncRoleCards);
      }
    });

    syncRoleCards();

    /* ── Password Toggle ── */

    setupPasswordToggle("togglePassword", "signup-password");
    setupPasswordToggle("toggleConfirmPassword", "signup-confirmPassword");

    function setupPasswordToggle(toggleId, inputId) {
      var toggleBtn = document.getElementById(toggleId);
      var input = document.getElementById(inputId);
      if (!toggleBtn || !input) return;

      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        var icon = toggleBtn.querySelector("i");
        if (icon) {
          icon.className = isPassword ? "fas fa-eye-slash" : "fas fa-eye";
        }
        toggleBtn.setAttribute("aria-pressed", isPassword ? "true" : "false");
      });
    }

    /* ── Password Strength Meter ── */

    var passwordInput = document.getElementById("signup-password");
    var strengthMeter = document.getElementById("passwordStrengthMeter");
    var strengthClasses = [
      "", // 0 = none
      "auth-strength-bar--weak",
      "auth-strength-bar--fair",
      "auth-strength-bar--good",
      "auth-strength-bar--strong",
    ];

    if (passwordInput && strengthMeter) {
      passwordInput.addEventListener("input", function () {
        var strength = authValidation.getPasswordStrength(this.value);
        var bars = strengthMeter.children;
        for (var i = 0; i < bars.length; i++) {
          bars[i].className = "auth-strength-bar";
          if (i < strength) {
            bars[i].classList.add(strengthClasses[strength] || "");
          }
        }
      });
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

    /* ── Loading state ── */

    function setLoading(loading) {
      if (loading) {
        submitBtn.dataset.originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="auth-spinner"></span> Creating…';
        submitBtn.disabled = true;
      } else {
        submitBtn.innerHTML =
          submitBtn.dataset.originalText || submitBtn.innerHTML;
        submitBtn.disabled = false;
      }
    }

    /* ── Form Submit ── */

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Validate all steps
      authValidation.clearAllErrors(form);
      clearAlert();

      if (!validateStep1()) {
        showStep(1);
        return;
      }
      if (!validateStep2()) {
        showStep(2);
        return;
      }
      if (!validateStep3()) {
        showStep(3);
        return;
      }

      var formData = new FormData(form);
      var data = Object.fromEntries(formData);

      setLoading(true);

      try {
        var registrationData = {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim(),
          role: data.role,
          password: data.password,
        };
        var phone = String(data.phone || "").trim();
        if (phone) registrationData.phone = phone;

        await authApi.register(registrationData);

        showAlert("Account created successfully! Redirecting...", "success");
        setTimeout(function () {
          authApi.redirectAfterLogin();
        }, 1200);
      } catch (error) {
        let message = "Failed to create account.";
        if (error.status === 400) {
          message = error.message || "Invalid registration details.";
        } else if (error.status === 409) {
          message = "An account with this email already exists.";
        } else if (error.status === 500) {
          message = "Server error during registration. Please try again.";
        }
        showAlert(message, "error");
      } finally {
        setLoading(false);
      }
    });


    /* ── URL param: pre-select role ── */

    var urlParams = new URLSearchParams(window.location.search);
    var requestedRole = urlParams.get("role");
    if (
      requestedRole &&
      ["donor", "volunteer", "ngo"].includes(requestedRole)
    ) {
      var roleInput = form.querySelector(
        'input[name="role"][value="' + requestedRole + '"]',
      );
      if (roleInput) {
        roleInput.checked = true;
        syncRoleCards();
      }
    }
  });
})();
