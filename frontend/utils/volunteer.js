/**
 * FoodBridge — Volunteer Page Controller
 * Handles the volunteer application form and related UI logic.
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("volunteerForm");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = new FormData(form);
      const data = {
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        role: formData.get("role"),
        city: formData.get("city"),
        days: Array.from(formData.getAll("days")),
      };

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        if (typeof window.contactService !== "undefined") {
          await window.contactService.submitVolunteer(data);
          
          // Show success message
          if (typeof window.ui !== "undefined") {
            window.ui.showAlert("Your application has been submitted successfully! We will contact you soon.", "success");
          } else {
            window.toast.show("Your application has been submitted successfully!", "success");
          }
          
          form.reset();
        } else {
          throw new Error("Contact service not available.");
        }
      } catch (error) {
        console.error("[Volunteer] Submission error:", error);
        if (typeof window.ui !== "undefined") {
          window.ui.showAlert(error.message || "Failed to submit application. Please try again.", "error");
        } else {
          window.toast.show("Failed to submit application.", "error");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });

    // Animate numbers if they exist
    if (typeof window.ui !== "undefined" && typeof window.ui.animateCounter === "function") {
      const stats = document.querySelectorAll('.text-3xl.font-bold');
      stats.forEach(stat => {
        const target = parseInt(stat.textContent.replace(/[^0-9]/g, ''));
        if (!isNaN(target)) {
          window.ui.animateCounter(stat, target);
        }
      });
    }
  });
})();
