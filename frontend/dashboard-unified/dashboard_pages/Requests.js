import {
  apiGet,
  apiPost,
  escapeHtml,
  formatDateTime,
  formatNumber,
  getStatusBadge,
  getUserRole,
  Icons,
  renderInlineState,
} from "../utils.js";

export default class Requests {
  constructor() {
    this.role = getUserRole();
  }

  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
    }
  }

  canCreateRequest() {
    return this.role === "ngo" || this.role === "admin";
  }

  render() {
    const element = document.createElement("div");
    const showForm = this.canCreateRequest();

    element.innerHTML = `
      <section class="dashboard-grid cols-3" id="requestSummary">
        <article class="metric-card"><h3>Total Requests</h3><p>-</p><div class="metric-note">Recent demand records</div></article>
        <article class="metric-card"><h3>Pending</h3><p>-</p><div class="metric-note">Awaiting allocation</div></article>
        <article class="metric-card"><h3>Fulfilled</h3><p>-</p><div class="metric-note">Completed requests</div></article>
      </section>

      ${
        showForm
          ? `
            <article class="dashboard-panel">
              <div class="dashboard-panel-header">
                <div>
                  <h2 class="dashboard-panel-title">Create Food Request</h2>
                  <p class="dashboard-panel-subtitle">Push new demand from NGOs directly into dispatch workflows.</p>
                </div>
              </div>
              <div class="dashboard-panel-body">
                <form id="requestForm" novalidate>
                  <div class="dashboard-form-grid">
                    <div class="dashboard-form-group">
                      <label class="dashboard-form-label" for="foodNeeded">Food Needed</label>
                      <input id="foodNeeded" name="foodNeeded" class="dashboard-input" required placeholder="Rice, vegetables, prepared meals">
                    </div>
                    <div class="dashboard-form-group">
                      <label class="dashboard-form-label" for="quantity">Quantity</label>
                      <input id="quantity" name="quantity" class="dashboard-input" required placeholder="e.g. 150 meal boxes">
                    </div>
                    <div class="dashboard-form-group">
                      <label class="dashboard-form-label" for="location">Location</label>
                      <input id="location" name="location" class="dashboard-input" required placeholder="Area / city">
                    </div>
                    <div class="dashboard-form-group">
                      <label class="dashboard-form-label" for="urgency">Urgency</label>
                      <select id="urgency" name="urgency" class="dashboard-select">
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div class="dashboard-form-group full">
                      <label class="dashboard-form-label" for="notes">Notes</label>
                      <textarea id="notes" name="notes" class="dashboard-textarea" placeholder="Distribution timing, dietary constraints, etc."></textarea>
                    </div>
                  </div>
                  <div class="dashboard-actions" style="margin-top: 12px;">
                    <button type="submit" id="requestSubmitBtn" class="dashboard-button">Submit Request</button>
                    <span id="requestFormFeedback"></span>
                  </div>
                </form>
              </div>
            </article>
          `
          : `
            <div class="dashboard-inline-state dashboard-inline-info">
              Request creation is available for NGO and admin accounts. You can still monitor active requests below.
            </div>
          `
      }

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">Request Feed</h2>
            <p class="dashboard-panel-subtitle">Latest request records synced from backend.</p>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div class="dashboard-table-wrap">
            <table class="dashboard-table" aria-label="Requests table">
              <thead>
                <tr>
                  <th>NGO</th>
                  <th>Food Needed</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody id="requestTableBody">
                <tr>
                  <td colspan="7">
                    <div class="dashboard-inline-state">Loading requests...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    `;

    return element;
  }

  normalizeRequests(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  renderSummary(requests = []) {
    const counts = requests.reduce(
      (acc, request) => {
        const status = String(request.status || "").toLowerCase();
        acc.total += 1;
        if (status === "pending") acc.pending += 1;
        if (status === "fulfilled" || status === "approved") acc.fulfilled += 1;
        return acc;
      },
      { total: 0, pending: 0, fulfilled: 0 },
    );

    return `
      <article class="metric-card" style="border-top-color: #059669;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Total Requests
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.megaphone}</span>
        </h3>
        <p>${formatNumber(counts.total)}</p>
        <div class="metric-note">Recent demand records</div>
      </article>
      <article class="metric-card" style="border-top-color: #f59e0b;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Pending
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.clock}</span>
        </h3>
        <p>${formatNumber(counts.pending)}</p>
        <div class="metric-note">Awaiting allocation</div>
      </article>
      <article class="metric-card" style="border-top-color: #8b5cf6;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Fulfilled
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.party}</span>
        </h3>
        <p>${formatNumber(counts.fulfilled)}</p>
        <div class="metric-note">Completed requests</div>
      </article>
    `;
  }

  renderRows(requests = []) {
    if (!Array.isArray(requests) || requests.length === 0) {
      return `
        <tr>
          <td colspan="7">
            ${renderInlineState("No request records available yet.", "warning")}
          </td>
        </tr>
      `;
    }

    return requests
      .map(
        (request) => `
          <tr class="expandable-row" onclick="if(!event.target.closest('button')) this.classList.toggle('expanded')">
            <td>${escapeHtml(request.ngoName || "NGO")}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(request.foodNeeded || "-")}</td>
            <td>${escapeHtml(request.quantity || "-")}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(request.location || "-")}</td>
            <td>${escapeHtml(request.urgency || "-")}</td>
            <td>${getStatusBadge(request.status)}</td>
            <td>${escapeHtml(formatDateTime(request.createdAt))}</td>
          </tr>
        `,
      )
      .join("");
  }

  async loadRequests() {
    const summaryEl = document.getElementById("requestSummary");
    const bodyEl = document.getElementById("requestTableBody");

    try {
      const response = await apiGet("/dashboard/requests");
      const requests = this.normalizeRequests(response);
      summaryEl.innerHTML = this.renderSummary(requests);
      bodyEl.innerHTML = this.renderRows(requests);
    } catch (error) {
      summaryEl.innerHTML = `
        <article class="dashboard-panel" style="grid-column: 1 / -1;">
          <div class="dashboard-panel-body">
            ${renderInlineState(`Unable to load request summary: ${error.message}`, "error")}
          </div>
        </article>
      `;
      bodyEl.innerHTML = `
        <tr>
          <td colspan="7">${renderInlineState(`Unable to load requests: ${error.message}`, "error")}</td>
        </tr>
      `;
    }
  }

  bindForm() {
    if (!this.canCreateRequest()) return;

    const form = document.getElementById("requestForm");
    const submitButton = document.getElementById("requestSubmitBtn");
    const feedback = document.getElementById("requestFormFeedback");

    if (!form || !submitButton || !feedback) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const payload = {
        foodNeeded: String(formData.get("foodNeeded") || "").trim(),
        quantity: String(formData.get("quantity") || "").trim(),
        location: String(formData.get("location") || "").trim(),
        urgency: String(formData.get("urgency") || "medium").trim(),
        notes: String(formData.get("notes") || "").trim(),
      };

      if (!payload.foodNeeded || !payload.quantity || !payload.location) {
        feedback.innerHTML = renderInlineState(
          "Food needed, quantity, and location are required.",
          "warning",
        );
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";

      try {
        await apiPost("/dashboard/requests", payload);
        form.reset();
        feedback.innerHTML = renderInlineState(
          "Request submitted successfully.",
          "info",
        );
        await this.loadRequests();
      } catch (error) {
        feedback.innerHTML = renderInlineState(
          `Request submission failed: ${error.message}`,
          "error",
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Request";
      }
    });
  }

  async afterRender() {
    this.bindForm();
    await this.loadRequests();

    // ── Real-time Socket.io updates ──
    if (this._socketCleanup) {
      this._socketCleanup();
    }

    if (window.socketService) {
      let refreshTimer = null;
      const debouncedRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          console.log("[Requests] Live update detected, refreshing requests...");
          this.loadRequests();
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
}
