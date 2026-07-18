import {
  escapeHtml,
  getUserRole,
  initialsFromName,
  toTitleCase,
} from "./utils.js";
const { apiService, authService } = window;

export default class Navbar {
  constructor(user) {
    this.user = user || {};
    this.notifications = [];
    this.navbar = document.getElementById("navbar-placeholder");
    this.pageTitle = "Dashboard Overview";
    this.pageSubtitle =
      "Track real-time activity, requests, and fulfillment status.";
    this.render();
    this.loadNotifications();
    this.bindEvents();
    this.setupSocketListeners();
  }

  setPageMeta(title, subtitle) {
    this.pageTitle = title || this.pageTitle;
    this.pageSubtitle = subtitle || this.pageSubtitle;

    const titleNode = this.navbar?.querySelector("[data-dashboard-title]");
    const subtitleNode = this.navbar?.querySelector(
      "[data-dashboard-subtitle]",
    );

    if (titleNode) titleNode.textContent = this.pageTitle;
    if (subtitleNode) subtitleNode.textContent = this.pageSubtitle;
  }

  getDisplayName() {
    if (this.user?.fullName) return this.user.fullName;
    if (this.user?.name) return this.user.name;

    const first = this.user?.firstName || "";
    const last = this.user?.lastName || "";
    const composed = `${first} ${last}`.trim();
    return composed || "FoodBridge User";
  }

  handleLogout() {
    authService.logout("/pages/index.html");
  }

  bindEvents() {
    const logoutButton = this.navbar?.querySelector("[data-dashboard-logout]");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => this.handleLogout());
    }

    const notificationBtn = this.navbar?.querySelector(
      "[data-notification-trigger]",
    );
    const notificationDropdown = this.navbar?.querySelector(
      "[data-notification-dropdown]",
    );

    if (notificationBtn && notificationDropdown) {
      notificationBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle("show");
      });

      // Close dropdown on click outside
      document.addEventListener("click", (e) => {
        if (
          notificationBtn && !notificationBtn.contains(e.target) &&
          notificationDropdown && !notificationDropdown.contains(e.target)
        ) {
          notificationDropdown.classList.remove("show");
        }
      });
    }

    const markAllBtn = this.navbar?.querySelector("[data-mark-all-read]");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => this.markAllAsRead());
    }

    const clearAllBtn = this.navbar?.querySelector("[data-clear-all]");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => this.clearAllNotifications());
    }

    // Wire "See all notifications" footer button to navigate to notifications page
    const seeAllBtn = this.navbar?.querySelector(".notifications-footer button");
    if (seeAllBtn) {
      seeAllBtn.addEventListener("click", () => {
        if (notificationDropdown) notificationDropdown.classList.remove("show");
        window.location.hash = "#notifications";
      });
    }

    if (typeof window.bindDashboardSidebarToggle === "function") {
      window.bindDashboardSidebarToggle();
    }

    // Listen for real-time profile updates
    window.addEventListener("userUpdate", (e) => {
      if (e.detail?.user) {
        this.user = e.detail.user;
        this.updateUserUI();
      }
    });
  }

  setupSocketListeners() {
    if (window.socketService) {
      window.socketService.on("notification", (notification) => {
        // Show a temporary toast for the new notification
        if (window.ui && typeof window.ui.showAlert === "function") {
          window.ui.showAlert(notification.title || "New notification", "info");
        }

        // Re-fetch all notifications from the API so the bell dropdown
        // stays in sync with the Notifications page (both read from DB)
        this.loadNotifications();
      });
    }

    // Listen for changes made by the Notifications page (mark-as-read, etc.)
    window.addEventListener("notificationsChanged", () => {
      this.loadNotifications();
    });
  }

  async loadNotifications() {
    try {
      if (typeof apiService === "undefined") return;

      const response = await apiService.get("/notifications");
      if (response && response.success) {
        this.notifications = response.data.notifications || [];
        this.updateNotificationUI(response.data.unreadCount);
      }
    } catch (err) {
      console.error("[Navbar] Failed to load notifications:", err);
    }
  }

  async markAllAsRead() {
    try {
      if (this.notifications.length === 0) return;

      const unreadIds = this.notifications
        .filter((n) => !n.isRead)
        .map((n) => n._id);

      if (unreadIds.length === 0) return;

      await apiService.put("/notifications/read", {
        notificationIds: unreadIds,
      });

      // Immediately mark all local notifications as read
      this.notifications.forEach((n) => (n.isRead = true));
      this.updateNotificationUI(0);

      // Also update the dropdown list items to remove 'unread' styling instantly
      const listNode = this.navbar?.querySelector("[data-notification-list]");
      if (listNode) {
        listNode.querySelectorAll(".notification-item.unread").forEach((item) => {
          item.classList.remove("unread");
        });
      }

      // Notify other components (Notifications page) to refresh
      window.dispatchEvent(new CustomEvent("notificationsChanged"));
    } catch (err) {
      console.error("[Navbar] Failed to mark notifications as read:", err);
    }
  }

  async clearAllNotifications() {
    try {
      if (!confirm("Are you sure you want to delete all notifications?")) return;
      
      await apiService.delete("/notifications");

      this.notifications = [];
      this.updateNotificationUI(0);

      window.dispatchEvent(new CustomEvent("notificationsChanged"));
    } catch (err) {
      console.error("[Navbar] Failed to clear notifications:", err);
    }
  }

  updateNotificationUI(unreadCount) {
    const listNode = this.navbar?.querySelector("[data-notification-list]");
    const badgeNode = this.navbar?.querySelector("[data-notification-count]");

    if (!listNode) return;

    if (this.notifications.length === 0) {
      listNode.innerHTML = `
        <div class="notifications-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No new notifications</p>
        </div>
      `;
    } else {
      listNode.innerHTML = this.notifications
        .map(
          (n) => `
        <div class="notification-item ${n.isRead ? "" : "unread"}" data-notification-id="${n._id}">
          <div class="notification-icon">
            <i class="fas ${this.getNotificationIcon(n.type)}"></i>
          </div>
          <div class="notification-content">
            <strong>${escapeHtml(n.title)}</strong>
            <p>${escapeHtml(n.message)}</p>
            <span class="notification-time">${this.formatTimeAgo(n.createdAt)}</span>
          </div>
        </div>
      `,
        )
        .join("");
    }

    if (badgeNode) {
      const count =
        unreadCount !== undefined
          ? unreadCount
          : this.notifications.filter((n) => !n.isRead).length;

      if (count > 0) {
        badgeNode.textContent = count > 9 ? "9+" : count;
        badgeNode.classList.remove("hidden");
      } else {
        badgeNode.classList.add("hidden");
      }
    }
  }

  getNotificationIcon(type) {
    switch (type) {
      case "donation":
        return "fa-gift";
      case "pickup":
        return "fa-truck";
      case "delivery":
        return "fa-check-circle";
      case "alert":
        return "fa-exclamation-triangle";
      default:
        return "fa-bell";
    }
  }

  formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  updateUserUI() {
    const nameNode = this.navbar?.querySelector(".dashboard-user-meta strong");
    const avatarNode = this.navbar?.querySelector(".dashboard-avatar");
    
    if (nameNode) nameNode.textContent = this.getDisplayName();
    if (avatarNode) avatarNode.textContent = initialsFromName(this.user);
  }

  render() {
    if (!this.navbar) return;

    const role = toTitleCase(getUserRole());
    const displayName = this.getDisplayName();
    const avatarInitials = initialsFromName(this.user);

    this.navbar.innerHTML = `
      <header class="dashboard-topbar">
        <div class="dashboard-topbar-left">
          <button class="dashboard-fab-toggle" type="button" data-sidebar-toggle aria-expanded="true" aria-label="Collapse sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <a href="/pages/index.html" class="dashboard-home-chip" aria-label="Go to home page">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5M5.25 9.75V21h13.5V9.75" />
            </svg>
            <span>Home</span>
          </a>
          <div class="dashboard-topbar-copy">
            <h1 data-dashboard-title>${escapeHtml(this.pageTitle)}</h1>
            <p data-dashboard-subtitle>${escapeHtml(this.pageSubtitle)}</p>
          </div>
        </div>
        <div class="dashboard-actions">
          <div class="dashboard-notifications-wrap">
            <button type="button" class="dashboard-notifications-btn" data-notification-trigger aria-label="View notifications">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span class="notification-badge hidden" data-notification-count>0</span>
            </button>
            <div class="notifications-dropdown" data-notification-dropdown>
              <div class="notifications-header">
                <h3>Notifications</h3>
                <div style="display:flex; gap:10px;">
                  <button type="button" class="text-xs text-emerald-600 font-bold hover:underline" data-mark-all-read>Mark all read</button>
                  <button type="button" class="text-xs text-red-500 font-bold hover:underline" data-clear-all>Clear all</button>
                </div>
              </div>
              <div class="notifications-list" data-notification-list>
                <div class="notifications-empty">
                  <i class="fas fa-bell-slash"></i>
                  <p>No new notifications</p>
                </div>
              </div>
              <div class="notifications-footer">
                <button type="button">See all notifications</button>
              </div>
            </div>
          </div>

          <span class="dashboard-user-chip" aria-label="Signed in user">
            <span class="dashboard-avatar" aria-hidden="true">${escapeHtml(avatarInitials)}</span>
            <span class="dashboard-user-meta">
              <strong>${escapeHtml(displayName)}</strong>
              <span>${escapeHtml(role)}</span>
            </span>
          </span>
          <button type="button" class="dashboard-logout-btn" data-dashboard-logout>
            Logout
          </button>
        </div>
      </header>
    `;
  }
}
