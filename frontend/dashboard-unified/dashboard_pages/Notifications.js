import {
  apiGet,
  apiPut,
  apiDelete,
  escapeHtml,
  formatDateTime,
  formatNumber,
  Icons,
  renderInlineState,
  toTitleCase,
} from "../utils.js";

export default class Notifications {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
  }

  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
    }
  }

  render() {
    const element = document.createElement("div");
    element.innerHTML = `
      <section id="notificationSummary" class="dashboard-grid cols-3">
        <article class="metric-card"><h3>Total Notifications</h3><p>-</p><div class="metric-note">Recent alerts</div></article>
        <article class="metric-card"><h3>Unread</h3><p>-</p><div class="metric-note">Needs acknowledgement</div></article>
        <article class="metric-card"><h3>Read</h3><p>-</p><div class="metric-note">Already reviewed</div></article>
      </section>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">Notification Feed</h2>
            <p class="dashboard-panel-subtitle">Latest operational notifications from your account channel.</p>
          </div>
          <div class="dashboard-actions">
            <button type="button" class="dashboard-button-ghost" id="markAllReadBtn">Mark all as read</button>
            <button type="button" class="dashboard-button-ghost" class="text-red-500 border-red-200" id="clearAllBtn">Clear all</button>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div id="notificationsFeedback" class="mb-2.5"></div>
          <div id="notificationList" class="list-stack">
            <div class="dashboard-inline-state">Loading notifications...</div>
          </div>
        </div>
      </article>
    `;

    return element;
  }

  renderSummary(total, unread) {
    const read = Math.max(total - unread, 0);
    return `
      <article class="metric-card border-t-4 border-t-[#059669]">
        <h3 class="flex justify-between items-center">
          Total Notifications
          <span class="flex dashboard-text-muted opacity-80">${Icons.bell}</span>
        </h3>
        <p>${formatNumber(total)}</p>
        <div class="metric-note">Recent alerts</div>
      </article>
      <article class="metric-card border-t-4 border-t-[#ef4444]">
        <h3 class="flex justify-between items-center">
          Unread
          <span class="flex dashboard-text-muted opacity-80">${Icons.alertCircle}</span>
        </h3>
        <p>${formatNumber(unread)}</p>
        <div class="metric-note">Needs acknowledgement</div>
      </article>
      <article class="metric-card border-t-4 border-t-[#64748b]">
        <h3 class="flex justify-between items-center">
          Read
          <span class="flex dashboard-text-muted opacity-80">${Icons.inbox}</span>
        </h3>
        <p>${formatNumber(read)}</p>
        <div class="metric-note">Already reviewed</div>
      </article>
    `;
  }

  renderList(notifications = []) {
    if (!notifications.length) {
      return renderInlineState("No notifications found yet.", "info");
    }

    return notifications
      .map((notification) => {
        const label = notification.isRead ? "Read" : "Unread";
        const tone = notification.isRead ? "status-neutral" : "status-info";

        return `
          <article class="list-item">
            <div>
              <strong>${escapeHtml(notification.title || "Notification")}</strong>
              <small>${escapeHtml(notification.message || "")}</small><br>
              <small>${escapeHtml(formatDateTime(notification.createdAt))}</small>
            </div>
            <span class="status-badge ${tone}">${escapeHtml(label)} ${escapeHtml(toTitleCase(notification.type || "Info"))}</span>
          </article>
        `;
      })
      .join("");
  }

  async loadNotifications() {
    const summaryEl = document.getElementById("notificationSummary");
    const listEl = document.getElementById("notificationList");

    try {
      const response = await apiGet("/notifications");
      this.notifications = Array.isArray(response?.data?.notifications)
        ? response.data.notifications
        : [];
      this.unreadCount = Number(response?.data?.unreadCount || 0);

      summaryEl.innerHTML = this.renderSummary(
        this.notifications.length,
        this.unreadCount,
      );
      listEl.innerHTML = this.renderList(this.notifications);
    } catch (error) {
      summaryEl.innerHTML = `
        <article class="dashboard-panel col-span-full">
          <div class="dashboard-panel-body">
            ${renderInlineState(`Unable to load notification summary: ${error.message}`, "error")}
          </div>
        </article>
      `;
      listEl.innerHTML = renderInlineState(
        `Unable to load notifications: ${error.message}`,
        "error",
      );
    }
  }

  setupSocketListener() {
    // Clean up previous listeners if re-entering this page
    if (this._socketCleanup) {
      this._socketCleanup();
    }

    const handlers = [];

    if (window.socketService) {
      const handleNotification = () => {
        // When a new real-time notification arrives, re-fetch from DB
        // so the page stays in sync with the bell icon dropdown
        this.loadNotifications();
      };
      window.socketService.on("notification", handleNotification);
      handlers.push(() => window.socketService.off("notification", handleNotification));
    }

    // Listen for changes made by the Navbar bell (mark-all-read, etc.)
    const handleChanged = () => {
      this.loadNotifications();
    };
    window.addEventListener("notificationsChanged", handleChanged);
    handlers.push(() => window.removeEventListener("notificationsChanged", handleChanged));

    this._socketCleanup = () => {
      handlers.forEach(fn => fn());
      this._socketCleanup = null;
    };
  }

  bindActions() {
    const button = document.getElementById("markAllReadBtn");
    const feedback = document.getElementById("notificationsFeedback");
    if (!button || !feedback) return;

    button.addEventListener("click", async () => {
      const unreadIds = this.notifications
        .filter((item) => !item.isRead)
        .map((item) => item._id)
        .filter(Boolean);
      if (!unreadIds.length) {
        feedback.innerHTML = renderInlineState(
          "No unread notifications to update.",
          "info",
        );
        return;
      }

      button.disabled = true;
      button.textContent = "Updating...";

      try {
        await apiPut("/notifications/read", { notificationIds: unreadIds });
        feedback.innerHTML = renderInlineState(
          "All notifications marked as read.",
          "info",
        );
        await this.loadNotifications();

        // Notify the Navbar bell to refresh so badge count updates
        window.dispatchEvent(new CustomEvent("notificationsChanged"));
      } catch (error) {
        feedback.innerHTML = renderInlineState(
          `Update failed: ${error.message}`,
          "error",
        );
      } finally {
        button.disabled = false;
        button.textContent = "Mark all as read";
      }
    });

    const clearButton = document.getElementById("clearAllBtn");
    if (clearButton) {
      clearButton.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete all notifications?")) return;
        
        clearButton.disabled = true;
        clearButton.textContent = "Clearing...";

        try {
          await apiDelete("/notifications");
          feedback.innerHTML = renderInlineState(
            "All notifications cleared.",
            "info",
          );
          await this.loadNotifications();
          window.dispatchEvent(new CustomEvent("notificationsChanged"));
        } catch (error) {
          feedback.innerHTML = renderInlineState(
            `Clear failed: ${error.message}`,
            "error",
          );
        } finally {
          clearButton.disabled = false;
          clearButton.textContent = "Clear all";
        }
      });
    }
  }

  async afterRender() {
    this.bindActions();
    this.setupSocketListener();
    await this.loadNotifications();
  }
}
