import {
  apiGet,
  apiPut,
  escapeHtml,
  formatDateTime,
  formatNumber,
  getStatusBadge,
  getUserRole,
  Icons,
  renderInlineState,
} from "../utils.js";

export default class Volunteers {
  constructor() {
    this.role = getUserRole();
  }

  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
    }
  }

  canViewVolunteerQueue() {
    return this.role === "volunteer" || this.role === "admin";
  }

  render() {
    const element = document.createElement("div");
    element.innerHTML = `
      <section id="volunteerSummary" class="dashboard-grid cols-3">
        <article class="metric-card"><h3>Queue Size</h3><p>-</p><div class="metric-note">Pending pickups</div></article>
        <article class="metric-card"><h3>High Priority</h3><p>-</p><div class="metric-note">Urgent actions</div></article>
        <article class="metric-card"><h3>Today Pickups</h3><p>-</p><div class="metric-note">Scheduled for today</div></article>
      </section>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">Volunteer Dispatch Queue</h2>
            <p class="dashboard-panel-subtitle">Live list of donation pickups available for field assignment.</p>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div id="volunteerAccessState" class="dashboard-section-state"></div>
          <div class="dashboard-table-wrap">
            <table class="dashboard-table" aria-label="Volunteer queue table">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Items</th>
                  <th>Pickup Time</th>
                  <th>City</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Dispatch</th>
                </tr>
              </thead>
              <tbody id="volunteerTableBody">
                <tr>
                  <td colspan="8"><div class="dashboard-inline-state">Loading volunteer queue...</div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      ${
        this.role === "admin"
          ? `
            <article class="dashboard-panel">
              <div class="dashboard-panel-header">
                <div>
                  <h2 class="dashboard-panel-title">Volunteer Applications</h2>
                  <p class="dashboard-panel-subtitle">Applications submitted from the public volunteer form.</p>
                </div>
              </div>
              <div class="dashboard-panel-body">
                <div class="dashboard-table-wrap">
                  <table class="dashboard-table" aria-label="Volunteer applications table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody id="volunteerApplicationsBody">
                      <tr>
                        <td colspan="5"><div class="dashboard-inline-state">Loading volunteer applications...</div></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          `
          : ""
      }
    `;

    return element;
  }

  normalizeRecords(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.donations)) return payload.data.donations;
    return [];
  }

  getItemSummary(items = []) {
    if (!Array.isArray(items) || items.length === 0) return "-";
    return items
      .map((item) => `${item.itemName || "Item"} (${item.quantity || "-"})`)
      .join(", ");
  }

  getAssignedVolunteerId(record = {}) {
    return (
      record.assignedVolunteer?._id ||
      record.assignedVolunteer ||
      record.assigned_volunteer?._id ||
      record.assigned_volunteer ||
      ""
    );
  }

  isVolunteerQueueRecord(record = {}) {
    const status = String(record.status || "").toLowerCase();
    return status === "claimed" && !this.getAssignedVolunteerId(record);
  }

  isActiveVolunteerTask(record = {}, userId = "") {
    const status = String(record.status || "").toLowerCase();
    const assignedId = this.getAssignedVolunteerId(record);
    return (
      assignedId === userId &&
      ["accepted", "picked_up", "in_transit"].includes(status)
    );
  }

  isCompletedVolunteerTask(record = {}, userId = "") {
    const status = String(record.status || "").toLowerCase();
    const assignedId = this.getAssignedVolunteerId(record);
    const isCompleted = ["delivered", "closed", "completed"].includes(status);
    return this.role === "admin" ? isCompleted : assignedId === userId && isCompleted;
  }

  renderSummary(records = []) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts = records.reduce(
      (acc, record) => {
        const priority = String(record.priority || "").toLowerCase();
        const pickupValue = record.pickupTime || record.pickupDatetime || record.pickup_datetime;
        const pickup = pickupValue
          ? new Date(pickupValue)
          : null;

        if (this.isVolunteerQueueRecord(record)) {
          acc.queue += 1;
        }

        if (priority === "high" || priority === "critical") {
          acc.highPriority += 1;
        }

        if (pickup && !Number.isNaN(pickup.getTime())) {
          const pickupDay = new Date(pickup);
          pickupDay.setHours(0, 0, 0, 0);
          if (pickupDay.getTime() === today.getTime()) {
            acc.today += 1;
          }
        }

        return acc;
      },
      { queue: 0, highPriority: 0, today: 0 },
    );

    return `
      <article class="metric-card" style="border-top-color: #059669;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Queue Size
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.clipboard}</span>
        </h3>
        <p>${formatNumber(counts.queue)}</p>
        <div class="metric-note">Pending pickups</div>
      </article>
      <article class="metric-card" style="border-top-color: #ef4444;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          High Priority
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.alertTriangle}</span>
        </h3>
        <p>${formatNumber(counts.highPriority)}</p>
        <div class="metric-note">Urgent actions</div>
      </article>
      <article class="metric-card" style="border-top-color: #3b82f6;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Today Pickups
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.calendar}</span>
        </h3>
        <p>${formatNumber(counts.today)}</p>
        <div class="metric-note">Scheduled for today</div>
      </article>
    `;
  }

  renderRows(records = []) {
    if (!Array.isArray(records) || records.length === 0) {
      return `
        <tr>
          <td colspan="8">${renderInlineState("No pickup tasks are currently queued.", "warning")}</td>
        </tr>
      `;
    }

    return records
      .slice(0, 50)
      .map((record) => {
        const donationId = record._id || record.id;
        let actions = "-";
        if (this.role === "volunteer") {
          if (this.isVolunteerQueueRecord(record)) {
            actions = `<button class="dashboard-button primary sm action-accept-btn" data-id="${donationId}">Accept</button>`;
          } else if (record.status === "accepted") {
            actions = `<button class="dashboard-button primary sm action-pickup-btn" data-id="${donationId}">Mark Picked Up</button>`;
          } else if (record.status === "picked_up" || record.status === "in_transit") {
            actions = `<button class="dashboard-button primary sm action-deliver-btn" data-id="${donationId}">Mark Delivered</button>`;
          }
        }
        const donorName =
          record.donorName ||
          record.donor_id?.name ||
          `${record.donor_id?.firstName || ""} ${record.donor_id?.lastName || ""}`.trim() ||
          "Unknown";

        return `
          <tr class="expandable-row volunteer-record-row">
            <td>${escapeHtml(donorName)}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(this.getItemSummary(record.items || []))}</td>
            <td>${escapeHtml(formatDateTime(record.pickupTime || record.pickupDatetime || record.pickup_datetime))}</td>
            <td>${escapeHtml(record.city || "-")}</td>
            <td>${escapeHtml(record.priority || "-")}</td>
            <td>${getStatusBadge(record.status)}</td>
            <td class="truncate-cell dashboard-muted-small" title="Click to expand">${escapeHtml(record.notes || '-')}</td>
            <td>${actions}</td>
          </tr>
        `;
      })
      .join("");
  }

  renderApplicationRows(applications = []) {
    if (!Array.isArray(applications) || applications.length === 0) {
      return `
        <tr>
          <td colspan="5">${renderInlineState("No volunteer applications have been submitted yet.", "warning")}</td>
        </tr>
      `;
    }

    return applications
      .map(
        (application) => `
          <tr class="expandable-row volunteer-record-row">
            <td>${escapeHtml(application.name || "Unknown")}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(application.email || "-")}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(application.subject || "-")}</td>
            <td>${getStatusBadge(application.status || "new")}</td>
            <td>${escapeHtml(formatDateTime(application.createdAt))}</td>
          </tr>
        `,
      )
      .join("");
  }

  async loadVolunteerApplications() {
    if (this.role !== "admin") return;
    const applicationsBody = document.getElementById(
      "volunteerApplicationsBody",
    );
    if (!applicationsBody) return;

    try {
      const response = await apiGet(
        "/contact?type=volunteer_inquiry&page=1&limit=25",
      );
      applicationsBody.innerHTML = this.renderApplicationRows(
        response?.data?.contacts || [],
      );
    } catch (error) {
      applicationsBody.innerHTML = `
        <tr>
          <td colspan="5">${renderInlineState(`Unable to load volunteer applications: ${error.message}`, "error")}</td>
        </tr>
      `;
    }
  }

  bindActions() {
    document.querySelectorAll(".action-accept-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "Accepting...";
        try {
          await apiPut(`/donations/${id}/status`, { status: "accepted" });
          if (typeof window.ui !== "undefined")
            window.ui.showAlert("Pickup accepted", "success");
          this.afterRender();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Accept";
          if (typeof window.ui !== "undefined")
            window.ui.showAlert(e.message, "error");
        }
      };
    });

    document.querySelectorAll(".action-pickup-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "Updating...";
        try {
          await apiPut(`/donations/${id}/status`, { status: "picked_up" });
          if (typeof window.ui !== "undefined")
            window.ui.showAlert("Donation marked as picked up", "success");
          this.afterRender();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Mark Picked Up";
          if (typeof window.ui !== "undefined")
            window.ui.showAlert(e.message, "error");
        }
      };
    });

    document.querySelectorAll(".action-deliver-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "Updating...";
        try {
          await apiPut(`/donations/${id}/status`, { status: "delivered" });
          if (typeof window.ui !== "undefined")
            window.ui.showAlert("Donation marked as delivered", "success");
          this.afterRender();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Mark Delivered";
          if (typeof window.ui !== "undefined")
            window.ui.showAlert(e.message, "error");
        }
      };
    });
  }

  async afterRender() {
    const summaryEl = document.getElementById("volunteerSummary");
    const stateEl = document.getElementById("volunteerAccessState");
    const bodyEl = document.getElementById("volunteerTableBody");

    if (!this.canViewVolunteerQueue()) {
      summaryEl.innerHTML = `
        <article class="dashboard-panel" style="grid-column: 1 / -1;">
          <div class="dashboard-panel-body">
            ${renderInlineState("Volunteer queue visibility is available for volunteer/admin roles only.", "warning")}
          </div>
        </article>
      `;
      stateEl.innerHTML = renderInlineState(
        "You can continue using donations and requests modules for your role.",
        "info",
      );
      bodyEl.innerHTML = `
        <tr>
          <td colspan="8">${renderInlineState("Queue data is restricted for your current role.", "warning")}</td>
        </tr>
      `;
      return;
    }

    try {
      const response = await apiGet("/donations");
      const records = this.normalizeRecords(response);
      
      const userId = window.dashboardContext.user.id || window.dashboardContext.user._id;
      const available = records.filter((record) =>
        this.isVolunteerQueueRecord(record),
      );
      const activeTasks =
        this.role === "volunteer"
          ? records.filter((record) => this.isActiveVolunteerTask(record, userId))
          : [];
      const completedTasks = records.filter((record) =>
        this.isCompletedVolunteerTask(record, userId),
      );

      summaryEl.innerHTML = this.renderSummary(records);
      stateEl.innerHTML = renderInlineState(
        "Queue synced with latest donation submissions.",
        "info",
      );
      
      const mainRecords = [...new Map([...available, ...activeTasks].map(item => [item._id || item.id, item])).values()];
      bodyEl.innerHTML = this.renderRows(mainRecords);
      
      const existingCompleted = document.getElementById("volunteerCompletedSection");
      if (existingCompleted) existingCompleted.remove();

      if (completedTasks.length > 0) {
        const completedSection = document.createElement("article");
        completedSection.id = "volunteerCompletedSection";
        completedSection.className = "dashboard-panel";
        completedSection.style.marginTop = "2rem";
        completedSection.innerHTML = `
          <div class="dashboard-panel-header">
            <div>
              <h2 class="dashboard-panel-title">My Completed Tasks</h2>
              <p class="dashboard-panel-subtitle">History of donations you have successfully delivered.</p>
            </div>
          </div>
          <div class="dashboard-panel-body">
            <div class="dashboard-table-wrap">
              <table class="dashboard-table">
                <thead>
                  <tr>
                    <th>Donor</th>
                    <th>Items</th>
                    <th>Pickup Time</th>
                    <th>City</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${completedTasks.map(record => `
                    <tr class="expandable-row volunteer-record-row">
                      <td>${escapeHtml(record.donorName || "Unknown")}</td>
                      <td class="truncate-cell" title="Click to expand">${escapeHtml(this.getItemSummary(record.items || []))}</td>
                      <td>${escapeHtml(formatDateTime(record.pickupTime || record.pickupDatetime || record.pickup_datetime))}</td>
                      <td>${escapeHtml(record.city || "-")}</td>
                      <td>${getStatusBadge(record.status)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
        bodyEl.closest(".dashboard-panel").after(completedSection);
      }

      this.bindActions();
      this.bindRowExpansion();
      await this.loadVolunteerApplications();
    } catch (error) {
      summaryEl.innerHTML = `
        <article class="dashboard-panel" style="grid-column: 1 / -1;">
          <div class="dashboard-panel-body">
            ${renderInlineState(`Unable to load volunteer queue: ${error.message}`, "error")}
          </div>
        </article>
      `;
      stateEl.innerHTML = renderInlineState(
        "Queue service unavailable right now.",
        "error",
      );
      bodyEl.innerHTML = `
        <tr>
          <td colspan="8">${renderInlineState(`Unable to fetch tasks: ${error.message}`, "error")}</td>
        </tr>
      `;
      this.bindActions();
      this.bindRowExpansion();
      await this.loadVolunteerApplications();
    }

    // ── Real-time Socket.io updates ──
    if (this._socketCleanup) {
      this._socketCleanup();
    }

    if (window.socketService) {
      let refreshTimer = null;
      const debouncedRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          console.log("[Volunteers] Live update detected, refreshing queue...");
          this.afterRender();
        }, 500);
      };

      window.socketService.on("donationStatusUpdated", debouncedRefresh);
      window.socketService.on("donationClaimed", debouncedRefresh);
      window.socketService.on("newDonation", debouncedRefresh);
      window.socketService.on("donationCreated", debouncedRefresh);

      this._socketCleanup = () => {
        window.socketService.off("donationStatusUpdated", debouncedRefresh);
        window.socketService.off("donationClaimed", debouncedRefresh);
        window.socketService.off("newDonation", debouncedRefresh);
        window.socketService.off("donationCreated", debouncedRefresh);
        if (refreshTimer) clearTimeout(refreshTimer);
        this._socketCleanup = null;
      };
    }
  }

  bindRowExpansion() {
    document.querySelectorAll(".volunteer-record-row").forEach((row) => {
      if (row.dataset.expandBound === "true") return;
      row.dataset.expandBound = "true";

      row.addEventListener("click", (event) => {
        if (event.target.closest("button") || event.target.closest("a")) return;
        row.classList.toggle("expanded");
      });
    });
  }
}
