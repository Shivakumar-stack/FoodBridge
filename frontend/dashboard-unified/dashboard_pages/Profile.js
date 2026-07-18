import {
  apiGet,
  apiPut,
  escapeHtml,
  formatNumber,
  getCurrentUser,
  getUserRole,
  Icons,
  renderInlineState,
  toTitleCase,
  updateCurrentUser,
} from "../utils.js";

export default class Profile {
  constructor() {
    this.user = getCurrentUser() || {};
    this.role = getUserRole();
  }

  getInitials() {
    const first = (this.user.firstName || "").charAt(0).toUpperCase();
    const last = (this.user.lastName || "").charAt(0).toUpperCase();
    return first + last || "?";
  }

  render() {
    const element = document.createElement("div");
    element.className = "profile-container";

    element.innerHTML = `
      <!-- Hero Banner -->
      <section class="profile-hero">
        <div class="profile-avatar">${this.getInitials()}</div>
        <div class="profile-meta">
          <h1 class="profile-name">${escapeHtml(this.user.firstName || "Unknown")} ${escapeHtml(this.user.lastName || "User")}</h1>
          <div class="profile-meta-tags">
            <span class="profile-role-badge">${escapeHtml(this.role)}</span>
            <span class="profile-email">${escapeHtml(this.user.email || "No Email")}</span>
          </div>
        </div>
      </section>

      <!-- Tabs Navigation -->
      <nav class="profile-tabs-nav" aria-label="Profile Tabs">
        <button type="button" class="profile-tab-btn active" data-target="tab-general">
          ${Icons.user} General Info
        </button>
        <button type="button" class="profile-tab-btn" data-target="tab-security">
          ${Icons.shield} Security
        </button>
        <button type="button" class="profile-tab-btn" data-target="tab-operational">
          ${Icons.truck} Operational Info
        </button>
        <button type="button" class="profile-tab-btn" data-target="tab-impact">
          ${Icons.megaphone} My Impact
        </button>
      </nav>

      <!-- Tab Panes -->
      <div class="profile-tab-content">
        
        <!-- General Tab -->
        <div id="tab-general" class="profile-tab-pane active">
          <article class="dashboard-panel" style="max-width: 800px;">
            <div class="dashboard-panel-header">
              <div>
                <h2 class="dashboard-panel-title">Personal Information</h2>
                <p class="dashboard-panel-subtitle">Manage your basic identity and operational region.</p>
              </div>
            </div>
            <div class="dashboard-panel-body">
              <form id="profileUpdateForm" novalidate>
                <div class="dashboard-form-grid">
                  <div class="dashboard-form-group">
                    <label class="dashboard-form-label" for="profileFirstName">First Name</label>
                    <input id="profileFirstName" name="firstName" class="dashboard-input" value="${escapeHtml(this.user.firstName || "")}" required placeholder="John">
                  </div>
                  <div class="dashboard-form-group">
                    <label class="dashboard-form-label" for="profileLastName">Last Name</label>
                    <input id="profileLastName" name="lastName" class="dashboard-input" value="${escapeHtml(this.user.lastName || "")}" required placeholder="Doe">
                  </div>
                  <div class="dashboard-form-group">
                    <label class="dashboard-form-label" for="profilePhone">Phone</label>
                    <input id="profilePhone" name="phone" type="tel" class="dashboard-input" value="${escapeHtml(this.user.phone || "")}" placeholder="+1 234 567 890">
                  </div>
                  <div class="dashboard-form-group">
                    <label class="dashboard-form-label" for="profileCity">City</label>
                    <input id="profileCity" name="city" class="dashboard-input" value="${escapeHtml(this.user.city || this.user.address?.city || "")}" placeholder="Operational Region">
                  </div>
                </div>
                <div class="dashboard-actions" style="margin-top: 16px;">
                  <button type="submit" id="profileSubmitBtn" class="dashboard-button">Save Changes</button>
                  <span id="profileFeedback"></span>
                </div>
              </form>
            </div>
          </article>
        </div>

        <!-- Security Tab -->
        <div id="tab-security" class="profile-tab-pane">
          <article class="dashboard-panel" style="max-width: 800px;">
            <div class="dashboard-panel-header">
              <div>
                <h2 class="dashboard-panel-title">Update Password</h2>
                <p class="dashboard-panel-subtitle">Ensure your account uses a strong, secure password.</p>
              </div>
            </div>
            <div class="dashboard-panel-body">
              <form id="passwordUpdateForm" novalidate>
                <div class="dashboard-form-grid">
                  <div class="dashboard-form-group full">
                    <label class="dashboard-form-label" for="currentPassword">Current Password</label>
                    <input id="currentPassword" name="currentPassword" type="password" class="dashboard-input" required>
                  </div>
                  <div class="dashboard-form-group">
                    <label class="dashboard-form-label" for="newPassword">New Password</label>
                    <input id="newPassword" name="newPassword" type="password" class="dashboard-input" required minlength="8">
                  </div>
                  <div class="dashboard-form-group">
                    <label class="dashboard-form-label" for="confirmPassword">Confirm Password</label>
                    <input id="confirmPassword" name="confirmPassword" type="password" class="dashboard-input" required minlength="8">
                  </div>
                </div>
                <div class="dashboard-actions" style="margin-top: 16px;">
                  <button type="submit" id="passwordSubmitBtn" class="dashboard-button">Update Password</button>
                  <span id="passwordFeedback"></span>
                </div>
              </form>
            </div>
          </article>
        </div>

        <!-- Operational Tab -->
        <div id="tab-operational" class="profile-tab-pane">
          <article class="dashboard-panel" style="max-width: 800px;">
            <div class="dashboard-panel-header">
              <div>
                <h2 class="dashboard-panel-title">Operational Details</h2>
                <p class="dashboard-panel-subtitle">Manage your role-specific settings and preferences.</p>
              </div>
            </div>
            <div class="dashboard-panel-body">
              <form id="operationalUpdateForm" novalidate>
                <div class="dashboard-form-grid">
                  ${this.renderRoleFields()}
                </div>
                <div class="dashboard-actions" style="margin-top: 16px;">
                  <button type="submit" id="operationalSubmitBtn" class="dashboard-button">Save Operational Info</button>
                  <span id="operationalFeedback"></span>
                </div>
              </form>
            </div>
          </article>
        </div>

        <!-- Impact Tab -->
        <div id="tab-impact" class="profile-tab-pane">
          <div id="profileImpactPanel">
            <div class="dashboard-inline-state">Loading impact metrics...</div>
          </div>
        </div>
        
      </div>
    `;
    return element;
  }

  renderImpact(stats = {}) {
    return `
      <div class="dashboard-grid cols-2">
        <article class="metric-card" style="border-top-color: #059669;">
          <h3 style="display:flex; justify-content:space-between; align-items:center;">
            Total Donations
            <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.box}</span>
          </h3>
          <p>${formatNumber(stats.totalDonations)}</p>
          <div class="metric-note">Role-scoped submissions</div>
        </article>
        <article class="metric-card" style="border-top-color: #3b82f6;">
          <h3 style="display:flex; justify-content:space-between; align-items:center;">
            Total Servings
            <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.utensils}</span>
          </h3>
          <p>${formatNumber(stats.totalServings)}</p>
          <div class="metric-note">Estimated delivered portions</div>
        </article>
        <article class="metric-card" style="border-top-color: #8b5cf6;">
          <h3 style="display:flex; justify-content:space-between; align-items:center;">
            Communities Served
            <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.building}</span>
          </h3>
          <p>${formatNumber(stats.communitiesServed)}</p>
          <div class="metric-note">Unique city clusters</div>
        </article>
        <article class="metric-card" style="border-top-color: #f59e0b;">
          <h3 style="display:flex; justify-content:space-between; align-items:center;">
            Account Status
            <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.shield}</span>
          </h3>
          <p>${escapeHtml(toTitleCase(this.user.status || "active"))}</p>
          <div class="metric-note">Current profile state</div>
        </article>
      </div>
    `;
  }

  renderRoleFields() {
    if (this.role === "ngo") {
      return `
        <div class="dashboard-form-group">
          <label class="dashboard-form-label">Organization Name</label>
          <input name="organization[name]" class="dashboard-input" value="${escapeHtml(this.user.organization?.name || "")}">
        </div>
        <div class="dashboard-form-group">
          <label class="dashboard-form-label">Website</label>
          <input name="organization[website]" type="url" class="dashboard-input" value="${escapeHtml(this.user.organization?.website || "")}">
        </div>
        <div class="dashboard-form-group">
          <label class="dashboard-form-label">Beneficiaries Count</label>
          <input name="ngoInfo[beneficiaries]" type="number" class="dashboard-input" value="${this.user.ngoInfo?.beneficiaries || 0}">
        </div>
      `;
    } else if (this.role === "volunteer") {
      return `
        <div class="dashboard-form-group">
          <label class="dashboard-form-label">Vehicle Type</label>
          <select name="volunteerInfo[vehicleType]" class="dashboard-input">
            <option value="none" ${this.user.volunteerInfo?.vehicleType === "none" ? "selected" : ""}>None (Walking)</option>
            <option value="bicycle" ${this.user.volunteerInfo?.vehicleType === "bicycle" ? "selected" : ""}>Bicycle</option>
            <option value="motorcycle" ${this.user.volunteerInfo?.vehicleType === "motorcycle" ? "selected" : ""}>Motorcycle</option>
            <option value="car" ${this.user.volunteerInfo?.vehicleType === "car" ? "selected" : ""}>Car</option>
            <option value="van" ${this.user.volunteerInfo?.vehicleType === "van" ? "selected" : ""}>Van</option>
          </select>
        </div>
        <div class="dashboard-form-group">
          <label class="dashboard-form-label">Availability</label>
          <select name="volunteerInfo[isAvailable]" class="dashboard-input">
            <option value="true" ${this.user.volunteerInfo?.isAvailable !== false ? "selected" : ""}>Available</option>
            <option value="false" ${this.user.volunteerInfo?.isAvailable === false ? "selected" : ""}>Busy / Off-duty</option>
          </select>
        </div>
      `;
    } else if (this.role === "donor") {
      return `
        <div class="dashboard-form-group">
          <label class="dashboard-form-label">Donor Type</label>
          <select name="organization[type]" class="dashboard-input">
            <option value="restaurant" ${this.user.organization?.type === "restaurant" ? "selected" : ""}>Restaurant</option>
            <option value="hotel" ${this.user.organization?.type === "hotel" ? "selected" : ""}>Hotel</option>
            <option value="corporate" ${this.user.organization?.type === "corporate" ? "selected" : ""}>Corporate</option>
            <option value="other" ${this.user.organization?.type === "other" ? "selected" : ""}>Other</option>
          </select>
        </div>
      `;
    }
    return `<p class="dashboard-panel-subtitle">No specific operational settings for your role.</p>`;
  }

  bindEvents() {
    // Tab Switching Logic
    const tabBtns = document.querySelectorAll(".profile-tab-btn");
    const tabPanes = document.querySelectorAll(".profile-tab-pane");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        
        tabBtns.forEach(b => b.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));
        
        btn.classList.add("active");
        document.getElementById(targetId)?.classList.add("active");
      });
    });

    const profileForm = document.getElementById("profileUpdateForm");
    const pwdForm = document.getElementById("passwordUpdateForm");
    
    // Profile Update Handling
    if (profileForm) {
      profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("profileSubmitBtn");
        const feedback = document.getElementById("profileFeedback");
        
        const firstName = profileForm.elements.firstName.value.trim();
        const lastName = profileForm.elements.lastName.value.trim();
        
        if (!firstName || !lastName) {
            feedback.innerHTML = renderInlineState("First Name and Last Name are required.", "warning");
            return;
        }

        const formData = new FormData(profileForm);
        const payload = Object.fromEntries(formData);
        
        btn.disabled = true;
        btn.textContent = "Saving...";
        feedback.innerHTML = "";

        try {
          // Backend call to update profile
          const res = await apiPut("/auth/profile", payload);
          if (res.data?.user) {
            updateCurrentUser(res.data.user);
            this.user = res.data.user;
            
            // UI Sync
            const avatar = document.querySelector(".profile-avatar");
            const nameH1 = document.querySelector(".profile-name");
            if(avatar) avatar.textContent = this.getInitials();
            if(nameH1) nameH1.textContent = `${this.user.firstName} ${this.user.lastName}`;
          }
          feedback.innerHTML = renderInlineState("Profile updated successfully.", "success");
        } catch (error) {
          feedback.innerHTML = renderInlineState(error.message || "Failed to update profile", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Save Changes";
        }
      });
    }

    const operationalForm = document.getElementById("operationalUpdateForm");
    if (operationalForm) {
      operationalForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("operationalSubmitBtn");
        const feedback = document.getElementById("operationalFeedback");
        
        const formData = new FormData(operationalForm);
        const rawData = Object.fromEntries(formData);
        
        // Handle nested objects from flat form names (e.g. ngoInfo[beneficiaries])
        const payload = {};
        Object.keys(rawData).forEach(key => {
          const match = key.match(/^(\w+)\[(\w+)\]$/);
          if (match) {
            const [, parent, child] = match;
            if (!payload[parent]) payload[parent] = {};
            payload[parent][child] = rawData[key];
          } else {
            payload[key] = rawData[key];
          }
        });

        btn.disabled = true;
        btn.textContent = "Saving...";
        feedback.innerHTML = "";

        try {
          const res = await apiPut("/auth/profile", payload);
          if (res.data?.user) {
            updateCurrentUser(res.data.user);
            this.user = res.data.user;
          }
          feedback.innerHTML = renderInlineState("Operational details updated.", "success");
        } catch (error) {
          feedback.innerHTML = renderInlineState(error.message || "Failed to update details", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Save Operational Info";
        }
      });
    }

    // Password Update Handling
    if (pwdForm) {
      pwdForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("passwordSubmitBtn");
        const feedback = document.getElementById("passwordFeedback");
        
        const currentPassword = pwdForm.elements.currentPassword.value;
        const newPassword = pwdForm.elements.newPassword.value;
        const confirmPassword = pwdForm.elements.confirmPassword.value;

        if (newPassword.length < 8) {
             feedback.innerHTML = renderInlineState("New Password must be at least 8 characters.", "warning");
             return;
        }
        const strongPwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
        if (!strongPwdRegex.test(newPassword)) {
             feedback.innerHTML = renderInlineState("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).", "warning");
             return;
        }
        if (newPassword !== confirmPassword) {
            feedback.innerHTML = renderInlineState("New passwords do not match.", "warning");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Updating...";
        feedback.innerHTML = "";

        try {
          await apiPut("/auth/change-password", { currentPassword, newPassword });
          feedback.innerHTML = renderInlineState("Password updated securely.", "success");
          pwdForm.reset();
        } catch (error) {
          feedback.innerHTML = renderInlineState(error.message || "Failed to update password", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Update Password";
        }
      });
    }
  }

  async afterRender() {
    this.bindEvents();

    const impactPanel = document.getElementById("profileImpactPanel");
    if (!impactPanel) return;

    try {
      const response = await apiGet("/donations/stats/overview");
      const rawStats = response?.data;
      let aggregated = {
        totalDonations: 0,
        totalServings: 0,
        communitiesServed: 0,
      };

      if (Array.isArray(rawStats)) {
        const statusCounts = rawStats.reduce((acc, row) => {
          const status = String(row?._id || "").toLowerCase();
          const count = Number(row?.count) || 0;
          acc[status] = (acc[status] || 0) + count;
          return acc;
        }, {});

        const completedCount =
          (statusCounts.completed || 0) +
          (statusCounts.closed || 0) +
          (statusCounts.delivered || 0);

        aggregated = {
          totalDonations: rawStats.reduce(
            (sum, row) => sum + (Number(row?.count) || 0),
            0,
          ),
          totalServings: rawStats.reduce(
            (sum, row) => sum + (Number(row?.totalServings) || 0),
            0,
          ),
          communitiesServed: completedCount,
        };
      } else if (rawStats && typeof rawStats === "object") {
        aggregated = {
          totalDonations: Number(rawStats.totalDonations) || 0,
          totalServings:
            Number(rawStats.totalServings || rawStats.foodSaved) || 0,
          communitiesServed: Number(rawStats.communitiesServed) || 0,
        };
      }

      impactPanel.innerHTML = this.renderImpact(aggregated);
    } catch (error) {
      impactPanel.innerHTML = renderInlineState(
        `Unable to load impact metrics: ${error.message}`,
        "error",
      );
    }
  }
}
