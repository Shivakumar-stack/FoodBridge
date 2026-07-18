import {
  apiGet,
  escapeHtml,
  formatNumber,
  getUserRole,
  renderInlineState,
  toTitleCase,
} from "../utils.js";

export default class Reports {
  constructor() {
    this.role = getUserRole();
  }

  render() {
    const element = document.createElement("div");
    element.innerHTML = `
      <article class="dashboard-panel" id="reportsAccessPanel">
        <div class="dashboard-panel-body">
          <div class="dashboard-inline-state">Loading reports...</div>
        </div>
      </article>

      <section id="reportsGrid" class="dashboard-grid cols-3"></section>
    `;
    return element;
  }

  renderListCard(title, subtitle, records = []) {
    const rows = records.length
      ? records
          .map(
            (record) => `
              <div class="list-item">
                <div>
                  <strong>${escapeHtml(toTitleCase(record._id || "Unknown"))}</strong>
                </div>
                <strong>${formatNumber(record.count)}</strong>
              </div>
            `,
          )
          .join("")
      : `<div class="dashboard-inline-state">No data available for this section.</div>`;

    return `
      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">${escapeHtml(title)}</h2>
            <p class="dashboard-panel-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div class="list-stack">${rows}</div>
        </div>
      </article>
    `;
  }

  renderContactMessages(records = []) {
    const rows = records.length
      ? records
          .slice(0, 8)
          .map(
            (record) => `
              <div class="list-item">
                <div>
                  <strong>${escapeHtml(record.subject || "Contact message")}</strong>
                  <small>${escapeHtml(record.name || "Unknown")}</small>
                </div>
                <strong>${escapeHtml(toTitleCase(record.type || "general"))}</strong>
              </div>
            `,
          )
          .join("")
      : `<div class="dashboard-inline-state">No contact messages yet.</div>`;

    return `
      <article class="dashboard-panel" style="grid-column: 1 / -1;">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">Recent Contact Messages</h2>
            <p class="dashboard-panel-subtitle">Latest public form and newsletter submissions.</p>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div class="list-stack">${rows}</div>
        </div>
      </article>
    `;
  }

  async afterRender() {
    const accessPanel = document.getElementById("reportsAccessPanel");
    const reportsGrid = document.getElementById("reportsGrid");

    if (this.role !== "admin") {
      accessPanel.innerHTML = `
        <div class="dashboard-panel-body">
          ${renderInlineState("System reports are available for admin role only.", "warning")}
        </div>
      `;
      reportsGrid.innerHTML = "";
      return;
    }

    try {
      const [reportsResponse, contactResponse] = await Promise.all([
        apiGet("/dashboard/reports"),
        apiGet("/contact?limit=8"),
      ]);
      const data = reportsResponse?.data || {};
      const contacts = (contactResponse?.data?.contacts || []).filter(
        (c) => !c.email?.includes("example.com") && !c.name?.toLowerCase().includes("qa")
      );

      accessPanel.innerHTML = `
        <div class="dashboard-panel-body">
          ${renderInlineState("Reports loaded from live dashboard aggregates.", "info")}
        </div>
      `;

      reportsGrid.innerHTML = `
        ${this.renderListCard("Donations by Status", "Distribution of lifecycle states", data.donationsByStatus || [])}
        ${this.renderListCard("Users by Role", "Current account role segmentation", data.usersByRole || [])}
        ${this.renderListCard("Deliveries by Status", "Delivery pipeline state counts", data.deliveriesByStatus || [])}
        ${this.renderContactMessages(contacts)}
      `;
    } catch (error) {
      accessPanel.innerHTML = `
        <div class="dashboard-panel-body">
          ${renderInlineState(`Unable to load reports: ${error.message}`, "error")}
        </div>
      `;
      reportsGrid.innerHTML = "";
    }
  }
}
