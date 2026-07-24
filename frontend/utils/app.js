/**
 * FoodBridge - Main Application JavaScript
 * Handles API calls, authentication, and UI interactions
 */

const AUTH_STORAGE_KEYS = {
  token: "foodbridge_token",
  user: "foodbridge_user",
  legacyToken: "token",
  legacyUser: "user",
};

// API Service

const apiService = {
  resolveErrorMessage(data, statusCode) {
    if (data?.message) {
      return data.message;
    }
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors.map((err) => err.msg).join(", ");
    }
    switch (statusCode) {
      case 400:
        return "Bad request. Please check your input.";
      case 401:
        return "Unauthorized. Please log in again.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 500:
        return "A server error occurred. Please try again later.";
      default:
        return `Request failed with status ${statusCode}`;
    }
  },

  _activeRequests: new Map(),

  /**
   * Make API request with authentication
   */
  async request(endpoint, options = {}) {
    const isMutation = options.method && options.method !== "GET";
    const requestKey = isMutation
      ? `${options.method}:${endpoint}:${options.body || ""}`
      : null;

    if (isMutation) {
      if (this._activeRequests.has(requestKey)) {
        throw new Error(
          "Duplicate request prevented. Our servers are processing your previous submission.",
        );
      }
      this._activeRequests.set(requestKey, true);
    }

    const url = `${window.appConfig.API_BASE_URL}${endpoint}`;

    const headers = {
      ...options.headers,
    };
    if (!options.isFormData) {
      headers["Content-Type"] = "application/json";
    }

    // CSRF Protection Integration
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.split("=")[1];

    if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(options.method)) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    try {
      const response = await fetch(url, { ...options, headers, credentials: "include" });

      let data = {};
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (e) {
          // Handle cases where JSON parsing fails on an error response
          throw new Error(
            `Server returned a malformed response with status ${response.status}`,
          );
        }
      }

      if (!response.ok) {
        if (
          response.status === 401 &&
          typeof authService !== "undefined" &&
          !endpoint.includes("/auth/login") &&
          !endpoint.includes("/auth/register") &&
          !endpoint.includes("/auth/logout")
        ) {
          authService.logout("../pages/login.html?error=session_expired");
          return; // Stop further execution
        }

        const errorMessage = this.resolveErrorMessage(data, response.status);
        const error = new Error(errorMessage);
        error.status = response.status;
        error.details = data.errors || [];
        throw error;
      }

      return data;
    } catch (error) {
      if (isMutation) this._activeRequests.delete(requestKey);

      // Handle network errors or other fetch-related issues
      if (error.name === "TypeError" && error.message === "Failed to fetch") {
        const netMsg = "Network timeout. Check your connection.";
        if (typeof ui !== "undefined" && ui.showRetryToast) {
          ui.showRetryToast(netMsg, () => {
            // The user can't magically reconnect the promise sequence here,
            // but reloading the page natively acts as a safe universal retry block for global SPA.
            window.location.reload();
          });
        }
        throw new Error(netMsg);
      }
      throw error; // Re-throw other errors
    } finally {
      if (isMutation) {
        // Unlock safely after 3 seconds for retry mechanisms
        setTimeout(() => this._activeRequests.delete(requestKey), 3000);
      }
    }
  },

  // GET request
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  // POST request
  post(endpoint, body) {
    const isFormData = body instanceof FormData;
    const options = { method: "POST", body: isFormData ? body : JSON.stringify(body) };
    if (isFormData) {
      options.isFormData = true; // flag to skip JSON content-type
    }
    return this.request(endpoint, options);
  },

  // PUT request
  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${window.appConfig.API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("[API] Health check failed:", error);
      throw error;
    }
  },
};

// Authentication Service

const authService = {
  _isLoggingOut: false,

  clearSession() {
    const keys = [
      AUTH_STORAGE_KEYS.token,
      AUTH_STORAGE_KEYS.user,
      AUTH_STORAGE_KEYS.legacyToken,
      AUTH_STORAGE_KEYS.legacyUser,
    ];

    keys.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });

    // Clear deprecated fallback token keys if they exist from older builds.
    sessionStorage.removeItem("foodbridge_jwt");
    localStorage.removeItem("foodbridge_jwt");
  },

  decodeTokenPayload(token) {
    try {
      const base64 = token.split(".")[1];
      if (!base64) return null;
      const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch (error) {
      return null;
    }
  },

  isTokenExpired(token) {
    const payload = this.decodeTokenPayload(token);
    if (!payload || typeof payload.exp !== "number") {
      return true;
    }
    // Add 10 second buffer to prevent edge cases
    return Date.now() >= payload.exp * 1000 - 10000;
  },

  getToken() {
    // Auth is cookie-first. Tokens are not read from browser storage.
    return null;
  },

  isLoggedIn() {
    // Auth state is determined by user profile presence.
    // The actual JWT lives in an HttpOnly cookie managed by the browser.
    const user = this.getUser();
    if (!user) {
      return false;
    }
    return true;
  },

  getUser() {
    const user =
      sessionStorage.getItem(AUTH_STORAGE_KEYS.user) ||
      localStorage.getItem(AUTH_STORAGE_KEYS.user) ||
      sessionStorage.getItem(AUTH_STORAGE_KEYS.legacyUser) ||
      localStorage.getItem(AUTH_STORAGE_KEYS.legacyUser);

    try {
      if (!user) return null;
      return JSON.parse(user);
    } catch (error) {
      this.clearSession();
      return null;
    }
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  async register(userData) {
    try {
      const data = await apiService.post("/auth/register", userData);
      if (data.success) {
        this.setSession(data.data.token, data.data.user);
      }
      return data;
    } catch (error) {
      console.error("[Auth] Registration error:", error);
      throw error;
    }
  },

  async login(email, password) {
    try {
      const data = await apiService.post("/auth/login", {
        email,
        password,
      });
      if (data && data.success) {
        this.setSession(data.data.token, data.data.user);
        return data;
      }
      throw new Error(data?.message || "Login failed due to an unknown error");
    } catch (error) {
      console.error("[Auth] Login error:", error);
      throw error;
    }
  },

  async socialAuth(provider, options = {}) {
    try {
      const payload = { provider, ...options };
      const data = await apiService.post("/auth/social", payload);
      if (data.success) {
        this.setSession(data.data.token, data.data.user);
        return data;
      }
      throw new Error(data.message || "Social authentication failed");
    } catch (error) {
      console.error("[Auth] Social auth error:", error);
      throw error;
    }
  },

  async logout(redirectTo = "index.html") {
    if (this._isLoggingOut) return;
    this._isLoggingOut = true;

    let overlay = null;
    if (typeof document !== "undefined") {
      overlay = document.createElement("div");
      overlay.className = "loading-overlay";
      overlay.style.position = "fixed";
      overlay.innerHTML = '<div class="flex items-center"><span class="spinner spinner-sm"></span><span class="ml-3 font-medium">Logging out safely...</span></div>';
      document.body.appendChild(overlay);
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );
      await Promise.race([
        apiService.post("/auth/logout", {}),
        timeoutPromise
      ]);
    } catch (e) {
      console.warn("Backend logout failed or timed out:", e);
    }

    try {
      this.clearSession();
    } catch (e) {
      console.warn("Local session clear failed:", e);
    } finally {
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        this._isLoggingOut = false;
        if (overlay) overlay.remove();
      }
    }
  },

  setSession(token, user) {
    this.clearSession();
    // JWT is stored in HttpOnly cookie by the server response.
    // User profile (non-sensitive) is kept in browser storage for UI.
    // Always store in BOTH to prevent role/session loss on navigation or new tabs.
    const userJson = JSON.stringify(user);
    localStorage.setItem(AUTH_STORAGE_KEYS.user, userJson);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.user, userJson);
  },

  updateUser(userData) {
    const userJson = JSON.stringify(userData);
    // Sync to both to ensure consistency across tabs/session types
    localStorage.setItem(AUTH_STORAGE_KEYS.user, userJson);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.user, userJson);

    // Dispatch event for components to listen
    window.dispatchEvent(new CustomEvent('userUpdate', { detail: { user: userData } }));
  },

  // ROLE-BASED DASHBOARD ROUTING — All roles go to unified dashboard
  redirectByRole() {
    const user = this.getUser();
    if (!user) {
      window.location.href = "../pages/login.html";
      return;
    }

    // Unified dashboard for ALL roles
    window.location.href = "../pages/dashboard-unified.html";
  },

  redirectAfterLogin() {
    // Check if there's a stored redirect URL
    const redirectUrl = sessionStorage.getItem("redirectAfterLogin");
    if (redirectUrl) {
      sessionStorage.removeItem("redirectAfterLogin");
      window.location.href = redirectUrl;
    } else {
      this.redirectByRole();
    }
  },

  async getDashboard() {
    return await apiService.get("/auth/dashboard");
  },

  async updateProfile(profileData) {
    const data = await apiService.put("/auth/profile", profileData);
    if (data.success) {
      this.updateUser(data.data.user);
    }
    return data;
  },

  async changePassword(currentPassword, newPassword) {
    return await apiService.put("/auth/change-password", {
      currentPassword,
      newPassword,
    });
  },
};

// Donation Service

const donationService = {
  /**
   * Create new donation
   */
  async create(donationData) {
    return await apiService.post("/donations", donationData);
  },

  /**
   * Get all donations
   */
  async getAll(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = queryParams ? `/donations?${queryParams}` : "/donations";
    return await apiService.get(endpoint);
  },

  async getPublicMap(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = queryParams
      ? `/donations/public-map?${queryParams}`
      : "/donations/public-map";
    return await apiService.get(endpoint);
  },

  /**
   * Get donation by ID
   */
  async getById(id) {
    return await apiService.get(`/donations/${id}`);
  },

  /**
   * Update donation status
   */
  async updateStatus(id, status, notes = "") {
    return await apiService.put(`/donations/${id}/status`, { status, notes });
  },

  /**
   * Get donation statistics
   */
  async getStats() {
    return await apiService.get("/donations/stats/overview");
  },

  /**
   * Get weekly donation trend (last 7 days)
   */
  async getWeeklyStats() {
    return await apiService.get("/donations/stats/weekly");
  },

  // Backward-compatible alias
  async getStatsWeekly() {
    return await this.getWeeklyStats();
  },

  async getVolunteerAvailable() {
    return await apiService.get("/donations/volunteer/available");
  },

  async acceptVolunteerPickup(id, notes = "") {
    return await apiService.put(`/donations/${id}/status`, {
      status: "accepted",
      notes,
    });
  },

  async getNgoAvailable() {
    return await apiService.get("/donations/ngo/available");
  },

  async claimDonation(id) {
    return await apiService.put(`/donations/${id}/claim`, {});
  },

  async getAdminStats() {
    return await apiService.get("/donations/stats/admin");
  },

  async autoExpireDonations() {
    return await apiService.put("/donations/auto-expire", {});
  },

  async backfillDonationCoordinates(limit = 50) {
    return await apiService.put("/donations/geocode/backfill", { limit });
  },
};

// Contact Service

const contactService = {
  /**
   * Submit contact form
   */
  async submit(formData) {
    return await apiService.post("/contact", formData);
  },

  /**
   * Subscribe to newsletter
   */
  async subscribeNewsletter(email) {
    return await apiService.post("/contact/newsletter", { email });
  },

  /**
   * Submit volunteer application
   */
  async submitVolunteer(volunteerData) {
    const formData = {
      name: `${volunteerData.firstName} ${volunteerData.lastName}`,
      email: volunteerData.email,
      subject: `Volunteer Application - ${volunteerData.role}`,
      message: `New volunteer application:
        
Name: ${volunteerData.firstName} ${volunteerData.lastName}
Email: ${volunteerData.email}
Phone: ${volunteerData.phone}
Role: ${volunteerData.role}
City: ${volunteerData.city}
Availability: ${volunteerData.days.join(", ")}
      `,
      type: "volunteer_inquiry",
    };
    return await apiService.post("/contact", formData);
  },

  /**
   * Get volunteer applications (Admin only)
   */
  async getVolunteerApplications(page = 1, limit = 10) {
    return await apiService.get(
      `/contact?type=volunteer_inquiry&page=${page}&limit=${limit}`,
    );
  },
};

// UI Helpers

const ui = {
  /**
   * SECURITY: Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Show alert message
   */
  showAlert(message, type = "info", container = null) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type}`;
    // SECURITY: Escape message to prevent XSS
    const escapedMessage = this.escapeHtml(message);
    alertDiv.innerHTML = `
      <i class="fas ${this.getAlertIcon(type)}"></i>
      <span>${escapedMessage}</span>
    `;

    if (container) {
      container.innerHTML = "";
      container.appendChild(alertDiv);
    } else {
      // Create a toast notification
      const toast = document.createElement("div");
      toast.className = `fixed top-4 right-4 z-50 alert alert-${type} shadow-lg`;
      toast.innerHTML = alertDiv.innerHTML;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 5000);
    }
  },

  showRetryToast(message, retryCallback) {
    const toastId = "retry-toast-" + Date.now();
    const toast = document.createElement("div");
    toast.className = `fixed bottom-4 right-4 z-[9999] alert alert-error shadow-2xl flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-red-200`;
    toast.id = toastId;
    // SECURITY: Escape message to prevent XSS
    const escapedMessage = this.escapeHtml(message);
    toast.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="fas fa-wifi text-red-500 text-xl"></i>
        <span class="font-medium text-gray-800 text-sm whitespace-nowrap">${escapedMessage}</span>
      </div>
      <div class="flex gap-2 shrink-0">
        <button id="${toastId}-retry" class="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-all text-sm active:scale-95 shadow-sm">Retry</button>
        <button id="${toastId}-dismiss" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition-all text-sm active:scale-95">Dismiss</button>
      </div>
    `;
    document.body.appendChild(toast);

    document
      .getElementById(`${toastId}-retry`)
      .addEventListener("click", () => {
        toast.remove();
        if (retryCallback) retryCallback();
      });

    document
      .getElementById(`${toastId}-dismiss`)
      .addEventListener("click", () => {
        toast.remove();
      });
  },

  /**
   * Get alert icon based on type
   */
  getAlertIcon(type) {
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle",
    };
    return icons[type] || icons.info;
  },

  /**
   * Show loading state on button
   */
  setButtonLoading(button, loading = true) {
    if (loading) {
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = '<span class="spinner spinner-sm"></span> Loading...';
      button.disabled = true;
    } else {
      button.innerHTML = button.dataset.originalText || button.innerHTML;
      button.disabled = false;
    }
  },

  /**
   * Debounce function for performance
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Format date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  /**
   * Format time
   */
  formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  /**
   * Format number with commas
   */
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  /**
   * Animate counter
   */
  animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const updateCounter = () => {
      current += increment;
      if (current < target) {
        element.textContent = Math.floor(current).toLocaleString();
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = target.toLocaleString();
      }
    };

    updateCounter();
  },

  /**
   * Toggle mobile menu
   */
  toggleMobileMenu() {
    const mobileMenu = document.getElementById("mobileMenu");
    const menuIcon = document.getElementById("menuIcon");
    const menuBtn = document.getElementById("menuBtn");

    if (mobileMenu && menuBtn) {
      const isExpanded = menuBtn.getAttribute("aria-expanded") === "true";
      menuBtn.setAttribute("aria-expanded", !isExpanded);
      mobileMenu.classList.toggle("hidden");
      document.body.classList.toggle("overflow-hidden");
      if (menuIcon) {
        menuIcon.classList.toggle("fa-bars");
        menuIcon.classList.toggle("fa-times");
      }
    }
  },

  /**
   * Close mobile menu
   */
  closeMobileMenu() {
    const mobileMenu = document.getElementById("mobileMenu");
    const menuIcon = document.getElementById("menuIcon");
    const menuBtn = document.getElementById("menuBtn");

    if (mobileMenu && menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      mobileMenu.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
      if (menuIcon) {
        menuIcon.classList.add("fa-bars");
        menuIcon.classList.remove("fa-times");
      }
    }
  },
};

// Navigation

const navigation = {
  initialized: false,
  scrollBound: false,

  /**
   * Initialize navigation
   */
  init() {
    if (!this.initialized) {
      this.initialized = true;
    }
    this.setupMobileMenu();
    this.updateNavForAuth();
    this.setupScrollBehavior();
    this.enforceRoleVisibility();
  },

  /**
   * Enforce role-based UI visibility (e.g., [data-role="admin"])
   */
  enforceRoleVisibility() {
    if (authService.isLoggedIn()) {
      const role = authService.getRole();
      document.querySelectorAll('[data-role]').forEach(el => {
        const allowedRoles = el.getAttribute('data-role').split(',');
        if (!allowedRoles.includes(role)) {
          el.classList.add('hidden');
        } else {
          el.classList.remove('hidden');
        }
      });
    } else {
      document.querySelectorAll('[data-role]').forEach(el => {
        el.classList.add('hidden');
      });
    }
  },

  /**
   * Setup mobile menu toggle
   */
  mobileMenuInitialized: false,
  mobileMenuListenersBound: false,

  setupMobileMenu() {
    const menuBtn = document.getElementById("menuBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const menuIcon = document.getElementById("menuIcon");

    if (!menuBtn || !mobileMenu) return;

    // Bind global listeners only once
    if (!this.mobileMenuListenersBound) {
      // Close menu when clicking outside.
      document.addEventListener("click", (e) => {
        if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) {
          ui.closeMobileMenu();
        }
      });

      // Keyboard accessibility for mobile nav.
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (mobileMenu.classList.contains("hidden")) return;
        ui.closeMobileMenu();
        menuBtn.focus();
      });

      this.mobileMenuListenersBound = true;
    }

    if (!this.mobileMenuInitialized) {
      menuBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ui.toggleMobileMenu();
      });

      // Dedicated close button inside the fullscreen mobile menu
      const closeBtn = document.getElementById("mobileCloseBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          ui.closeMobileMenu();
        });
      }

      // Close menu when selecting any navigation link or button (Event Delegation)
      mobileMenu.addEventListener("click", (e) => {
        if (e.target.closest("a") || (e.target.closest("button") && !e.target.closest("#mobileCloseBtn"))) {
          ui.closeMobileMenu();
        }
      });

      this.mobileMenuInitialized = true;
    }

    // Ensure deterministic initial icon state.
    menuBtn.setAttribute("aria-expanded", "false");
    mobileMenu.classList.add("hidden");
    if (menuIcon) {
      menuIcon.classList.add("fa-bars");
      menuIcon.classList.remove("fa-times");
    }
  },

  /**
   * Update navigation based on auth state
   */
  updateNavForAuth() {
    const navActions = document.getElementById("navActions");
    const mobileAuth = document.getElementById("mobileAuth");

    if (authService.isLoggedIn()) {
      const user = authService.getUser();
      const userName = user ? `${user.firstName} ${user.lastName}` : "User";

      if (navActions) {
        navActions.innerHTML = `
          <a href="../pages/dashboard-unified.html" class="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-emerald-600 font-medium transition-colors">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
              ${user?.initials || "U"}
            </div>
            <span class="hidden xl:inline">${userName}</span>
          </a>
          <button onclick="authService.logout()" class="px-4 py-2 text-gray-700 hover:text-red-600 font-medium transition-colors">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        `;
      }

      if (mobileAuth) {
        mobileAuth.innerHTML = `
          <a href="../pages/dashboard-unified.html" class="block w-full px-4 py-3 text-center bg-emerald-50 text-emerald-700 font-semibold rounded-xl">
            Dashboard
          </a>
          <button onclick="authService.logout()" class="block w-full px-4 py-3 text-center border-2 border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors">
            Log Out
          </button>
        `;
      }
    }
  },

  /**
   * Setup scroll behavior for navbar
   */
  setupScrollBehavior() {
    if (this.scrollBound) return;

    const navbar = document.getElementById("navbar");
    if (!navbar) return;
    this.scrollBound = true;

    window.addEventListener("scroll", () => {
      const currentScroll = window.pageYOffset;

      // Add shadow on scroll
      if (currentScroll > 10) {
        navbar.classList.add("shadow-md");
      } else {
        navbar.classList.remove("shadow-md");
      }
    });
  },
};

// Shared Layout

const layout = {
  footerVersion: "20260224e",
  getCurrentFileName() {
    const path = String(window.location.pathname || "");
    const fileName = path.split("/").filter(Boolean).pop();
    return (fileName || "index.html").toLowerCase();
  },

  getFileNameFromHref(href) {
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      return "";
    }

    try {
      const parsed = new URL(href, window.location.href);
      const fileName = parsed.pathname.split("/").filter(Boolean).pop();
      return String(fileName || "").toLowerCase();
    } catch (error) {
      return "";
    }
  },

  getFooterMarkup() {
    const year = new Date().getFullYear();
    return `
<footer class="site-footer bg-gray-900 border-t border-gray-800 pt-20 pb-10 text-base relative overflow-hidden" data-footer-version="${this.footerVersion}">
  <!-- Subtle dark background glow -->
  <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-3xl pointer-events-none -mt-40 -mr-40"></div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
      
      <!-- Brand & Mission -->
      <div class="lg:col-span-4">
        <a href="index.html" class="flex items-center gap-3 mb-6 text-white font-extrabold text-2xl">
          <span class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-900/50">
            <i class="fas fa-hand-holding-heart"></i>
          </span>
          <span>FoodBridge</span>
        </a>
        <p class="text-gray-400 mb-8 leading-relaxed text-base pr-4">
          A revolutionary platform connecting food donors with communities in need. Track impact, schedule reliable pickups, and join the mission to end hunger sustainably.
        </p>
        <div class="flex items-center gap-3">
          <a href="#" aria-label="Facebook" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-emerald-600 hover:text-white transition-all"><i class="fab fa-facebook-f text-lg"></i></a>
          <a href="#" aria-label="Twitter" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-emerald-600 hover:text-white transition-all"><i class="fab fa-twitter text-lg"></i></a>
          <a href="#" aria-label="Instagram" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-emerald-600 hover:text-white transition-all"><i class="fab fa-instagram text-lg"></i></a>
          <a href="#" aria-label="LinkedIn" class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-emerald-600 hover:text-white transition-all"><i class="fab fa-linkedin-in text-lg"></i></a>
        </div>
      </div>

      <!-- Links Grid -->
      <div class="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8 pt-2">
        <div>
          <h3 class="font-bold text-white mb-6 text-lg tracking-wide uppercase">Platform</h3>
          <ul class="space-y-4 text-gray-400 text-base font-medium">
            <li><a href="about.html" class="hover:text-emerald-400 transition-colors">Our Mission</a></li>
            <li><a href="how-it-works.html" class="hover:text-emerald-400 transition-colors">How It Works</a></li>
            <li><a href="donate.html" class="hover:text-emerald-400 transition-colors flex items-center gap-2">Donate <span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Urgent</span></a></li>
            <li><a href="../pages/volunteer.html" class="hover:text-emerald-400 transition-colors">Volunteer Hub</a></li>
            <li><a href="live-map.html" class="hover:text-emerald-400 transition-colors">Live Operations Grid</a></li>
          </ul>
        </div>

        <div>
           <h3 class="font-bold text-white mb-6 text-lg tracking-wide uppercase">Resources</h3>
          <ul class="space-y-4 text-gray-400 text-base font-medium">
            <li><a href="how-it-works.html" class="hover:text-emerald-400 transition-colors">Safety Guidelines</a></li>
            <li><a href="about.html" class="hover:text-emerald-400 transition-colors">Tax Certificates</a></li>
            <li><a href="../pages/dashboard-unified.html" class="hover:text-emerald-400 transition-colors">Verified NGOs List</a></li>
            <li><a href="index.html#testimonials" class="hover:text-emerald-400 transition-colors">Impact Stories</a></li>
            <li><a href="contact.html" class="hover:text-emerald-400 transition-colors">FAQs & Support</a></li>
          </ul>
        </div>

        <div>
          <h3 class="font-bold text-white mb-6 text-lg tracking-wide uppercase">Contact</h3>
          <ul class="space-y-4 text-gray-400 text-base font-medium">
            <li class="flex items-start gap-3">
              <i class="fas fa-location-dot mt-1 w-5 text-emerald-500 text-lg"></i>
              <span>123 Harmony Street<br>Bengaluru, KA 560001</span>
            </li>
            <li class="flex items-center gap-3">
              <i class="fas fa-envelope w-5 text-emerald-500 text-lg"></i>
              <a href="mailto:hello@foodbridge.org" class="hover:text-emerald-400 transition-colors">hello@foodbridge.org</a>
            </li>
            <li class="flex items-center gap-3">
              <i class="fas fa-phone w-5 text-emerald-500 text-lg"></i>
              <a href="tel:+18003663274" class="hover:text-emerald-400 transition-colors">1-800-BRIDGE</a>
            </li>
          </ul>
        </div>
      </div>

    </div>

    <!-- Bottom Bar -->
    <div class="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-800">
      <p class="text-base text-gray-500 font-medium mb-4 md:mb-0">&copy; ${year} FoodBridge Operations. All rights reserved.</p>
      <div class="flex flex-wrap justify-center gap-6 text-base text-gray-500 font-medium">
        <a href="privacy-policy.html" class="hover:text-gray-300 transition-colors">Privacy</a>
        <a href="terms.html" class="hover:text-gray-300 transition-colors">Terms of Use</a>
        <a href="sitemap.html" class="hover:text-gray-300 transition-colors">Sitemap</a>
        <a href="#" class="hover:text-gray-300 transition-colors">Cookie Settings</a>
      </div>
    </div>
    
  </div>
</footer>
    `;
  },

  shouldRenderFooter() {
    const body = document.body;
    const fileName = this.getCurrentFileName();
    const blockedFiles = new Set(["../pages/login.html", "signup.html"]);

    if (blockedFiles.has(fileName)) {
      return false;
    }

    if (!body) {
      return true;
    }

    return !(
      body.classList.contains("no-footer") ||
      body.classList.contains("auth-page") ||
      body.classList.contains("dashboard-page") ||
      body.dataset.footer === "off"
    );
  },

  mountGlobalFooter() {
    if (!this.shouldRenderFooter()) {
      const managedFooter = document.querySelector(
        "footer.site-footer, footer[data-footer-version]",
      );
      if (managedFooter) {
        managedFooter.remove();
      }
      return;
    }

    const existingFooter = document.querySelector("footer");
    if (existingFooter?.dataset?.footerVersion === this.footerVersion) {
      return;
    }

    const footerTemplate = document.createElement("template");
    footerTemplate.innerHTML = this.getFooterMarkup().trim();
    const nextFooter = footerTemplate.content.firstElementChild;
    if (!nextFooter) return;

    if (existingFooter) {
      existingFooter.replaceWith(nextFooter);
    } else {
      document.body.appendChild(nextFooter);
    }
  },

  syncActiveLinks() {
    const currentPage = this.getCurrentFileName();

    document
      .querySelectorAll(
        ".nav-link[href], #mobileMenu a[href], .footer-link-list a[href], .footer-legal-links a[href]",
      )
      .forEach((link) => {
        const linkFile = this.getFileNameFromHref(link.getAttribute("href"));
        const isActive = Boolean(linkFile) && linkFile === currentPage;

        if (link.classList.contains("nav-link")) {
          link.classList.toggle("active", isActive);
        }

        if (link.closest("#mobileMenu")) {
          link.classList.toggle("bg-emerald-50", isActive);
          link.classList.toggle("text-emerald-700", isActive);
        }

        if (
          link.closest(".footer-link-list") ||
          link.closest(".footer-legal-links")
        ) {
          link.classList.toggle("footer-link-active", isActive);
        }
      });
  },

  init() {
    this.mountGlobalFooter();
    this.syncActiveLinks();
  },
};

// Counter Animation

const counterAnimation = {
  init() {
    const counters = document.querySelectorAll(".counter");
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counter = entry.target;
            const target = parseInt(counter.dataset.target);
            ui.animateCounter(counter, target);
            observer.unobserve(counter);
          }
        });
      },
      { threshold: 0.5 },
    );

    counters.forEach((counter) => observer.observe(counter));
  },
};

// Testimonial Slider

const testimonialSlider = {
  currentSlide: 0,
  slides: [],
  dots: [],
  autoplayInterval: null,
  touchStartX: 0,
  touchEndX: 0,

  init() {
    this.slides = document.querySelectorAll(".testimonial-slide");
    this.dots = document.querySelectorAll("#testimonialDots button");

    if (!this.slides.length) return;

    this.setupControls();
    this.startAutoplay();
    this.updateSlide();
  },

  setupControls() {
    const prevBtn = document.getElementById("prevTestimonial");
    const nextBtn = document.getElementById("nextTestimonial");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        this.prev();
        this.resetAutoplay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.next();
        this.resetAutoplay();
      });
    }

    this.dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        this.goTo(index);
        this.resetAutoplay();
      });
    });

    // Add touch swipe functionality
    const sliderContainer = this.slides[0]?.parentElement;
    if (sliderContainer) {
      sliderContainer.addEventListener("touchstart", (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      sliderContainer.addEventListener("touchend", (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      }, { passive: true });
    }
  },

  handleSwipe() {
    const swipeThreshold = 50; // Minimum distance (px) to register as a swipe
    if (this.touchStartX - this.touchEndX > swipeThreshold) {
      this.next(); // Swiped left
      this.resetAutoplay();
    } else if (this.touchEndX - this.touchStartX > swipeThreshold) {
      this.prev(); // Swiped right
      this.resetAutoplay();
    }
  },

  updateSlide() {
    this.slides.forEach((slide, index) => {
      slide.classList.toggle("active", index === this.currentSlide);
    });

    this.dots.forEach((dot, index) => {
      dot.classList.toggle("bg-emerald-600", index === this.currentSlide);
      dot.classList.toggle("bg-emerald-200", index !== this.currentSlide);
    });
  },

  next() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    this.updateSlide();
  },

  prev() {
    this.currentSlide =
      (this.currentSlide - 1 + this.slides.length) % this.slides.length;
    this.updateSlide();
  },

  goTo(index) {
    this.currentSlide = index;
    this.updateSlide();
  },

  startAutoplay() {
    this.autoplayInterval = setInterval(() => this.next(), 5000);
  },

  resetAutoplay() {
    clearInterval(this.autoplayInterval);
    this.startAutoplay();
  },
};

// Form Validation

const formValidation = {
  /**
   * Validate email
   */
  isValidEmail(email) {
    return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
  },

  /**
   * Validate phone
   */
  isValidPhone(phone) {
    return /^\+?[\d\s-()]+$/.test(phone);
  },

  /**
   * Validate required field
   */
  isRequired(value) {
    return value.trim().length > 0;
  },

  /**
   * Validate min length
   */
  minLength(value, min) {
    return value.length >= min;
  },

  /**
   * Show field error
   */
  showError(field, message) {
    if (!field) return;
    field.classList.add("form-input-error");
    field.setAttribute("aria-invalid", "true");

    let errorEl = field.parentElement.querySelector(".form-error");
    if (!errorEl) {
      errorEl = document.createElement("p");
      errorEl.className = "form-error text-xs text-red-600 mt-2";
      errorEl.setAttribute("role", "alert");
      errorEl.setAttribute("aria-live", "assertive");
      field.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    try {
      field.focus();
    } catch (e) {
      /* ignore */
    }
  },

  /**
   * Clear field error
   */
  clearError(field) {
    if (!field) return;
    field.classList.remove("form-input-error");
    field.removeAttribute("aria-invalid");
    const errorEl = field.parentElement.querySelector(".form-error");
    if (errorEl) {
      errorEl.remove();
    }
  },

  /**
   * Clear all errors in form
   */
  clearAllErrors(form) {
    form.querySelectorAll(".form-input-error").forEach((field) => {
      this.clearError(field);
    });
    // Remove any alert boxes inside form
    form.querySelectorAll(".form-error").forEach((el) => el.remove());
  },
};

const newsletterForms = {
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    document.addEventListener(
      "submit",
      async (event) => {
        const form = event.target;
        if (!form || form.id !== "newsletterFormGlobal") return;

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        const emailInput = form.querySelector(
          'input[type="email"], input[name="email"]',
        );
        const button = form.querySelector('button[type="submit"], button');
        const email = String(emailInput?.value || "").trim();

        if (!formValidation.isValidEmail(email)) {
          ui.showAlert("Enter a valid email address.", "warning");
          emailInput?.focus();
          return;
        }

        const originalButtonHtml = button?.innerHTML;
        if (button) {
          button.disabled = true;
          button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing';
        }

        try {
          await contactService.subscribeNewsletter(email);
          form.reset();
          if (button) {
            button.innerHTML = '<i class="fas fa-check"></i> Subscribed';
            button.classList.add("bg-emerald-700");
          }
          ui.showAlert("Newsletter subscription confirmed.", "success");
        } catch (error) {
          if (button) {
            button.innerHTML = originalButtonHtml || "Subscribe";
          }
          ui.showAlert(
            error?.message || "Unable to subscribe right now.",
            "error",
          );
        } finally {
          if (button) {
            window.setTimeout(() => {
              button.disabled = false;
              if (originalButtonHtml) button.innerHTML = originalButtonHtml;
            }, 1800);
          }
        }
      },
      true,
    );
  },
};

// Initialize on DOM Ready

// Initialize navigation after partials (header/footer) are loaded
document.addEventListener("partialsLoaded", () => {
  navigation.init();
  layout.init();
});

document.addEventListener("DOMContentLoaded", () => {
  // Most pages use static nav markup and never dispatch "partialsLoaded".
  navigation.init();
  layout.init();

  // Initialize non-header/footer dependent components
  newsletterForms.init();
  counterAnimation.init();
  testimonialSlider.init();

  // Check for URL errors
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get("error");
  if (error === "session_expired") {
    ui.showAlert("Your session has expired. Please log in again.", "warning");
  }

  // Check for success messages
  const success = urlParams.get("success");
  if (success) {
    ui.showAlert(decodeURIComponent(success), "success");
  }
});

// Expose to global scope

window.apiService = apiService;
window.authService = authService;
window.authApi = authService; // Compatibility alias
window.authValidation = formValidation; // Compatibility alias
window.donationService = donationService;

window.apiService = apiService;
window.authService = authService;
window.contactService = contactService;
window.ui = ui;
window.navigation = navigation;
window.layout = layout;
window.formValidation = formValidation;
window.newsletterForms = newsletterForms;
