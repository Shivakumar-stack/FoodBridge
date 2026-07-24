import {
  apiGet,
  escapeHtml,
  formatDate,
  formatNumber,
  getStatusBadge,
  getUserRole,
  renderInlineState,
} from "../utils.js";

export default class Users {
  constructor() {
    this.role = getUserRole();
  }

  render() {
    const element = document.createElement("div");
    element.innerHTML = `
      <section id="usersSummary" class="dashboard-grid cols-4"></section>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">User Directory</h2>
            <p class="dashboard-panel-subtitle">Recent user records from the main account service.</p>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div id="usersAccessState" class="mb-3"></div>
          <div class="dashboard-table-wrap">
            <table class="dashboard-table" aria-label="Users table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>City</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody id="usersTableBody">
                <tr>
                  <td colspan="6"><div class="dashboard-inline-state">Loading users...</div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    `;

    return element;
  }

  renderSummary(users = []) {
    const roleCounts = users.reduce((acc, user) => {
      const role = String(user.role || "unknown").toLowerCase();
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const cards = [
      {
        label: "Total Users",
        value: users.length,
        note: "Current page total",
      },
      {
        label: "Donors",
        value: roleCounts.donor || 0,
        note: "Active donor accounts",
      },
      {
        label: "Volunteers",
        value: roleCounts.volunteer || 0,
        note: "Pickup workforce",
      },
      {
        label: "NGOs",
        value: roleCounts.ngo || 0,
        note: "Partner organizations",
      },
    ];

    return cards
      .map(
        (card) => `
          <article class="metric-card">
            <h3>${escapeHtml(card.label)}</h3>
            <p>${formatNumber(card.value)}</p>
            <div class="metric-note">${escapeHtml(card.note)}</div>
          </article>
        `,
      )
      .join("");
  }

  renderRows(users = []) {
    if (!Array.isArray(users) || users.length === 0) {
      return `
        <tr>
          <td colspan="6">${renderInlineState("No user records found.", "warning")}</td>
        </tr>
      `;
    }

    return users
      .map((user) => {
        const name =
          user.fullName ||
          user.name ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          "Unknown";
        return `
          <tr class="expandable-row">
            <td class="truncate-cell" title="Click to expand">${escapeHtml(name)}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(user.email || "-")}</td>
            <td>${escapeHtml(user.role || "-")}</td>
            <td>${getStatusBadge(user.status || "active")}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(user.city || user.address?.city || "-")}</td>
            <td>${escapeHtml(formatDate(user.createdAt))}</td>
          </tr>
        `;
      })
      .join("");
  }

  async afterRender() {
    const summaryEl = document.getElementById("usersSummary");
    const accessState = document.getElementById("usersAccessState");
    const tableBody = document.getElementById("usersTableBody");

    if (this.role !== "admin") {
      summaryEl.innerHTML = `
        <article class="dashboard-panel col-span-full">
          <div class="dashboard-panel-body">
            ${renderInlineState("User directory is restricted to admin role.", "warning")}
          </div>
        </article>
      `;
      accessState.innerHTML = renderInlineState(
        "Switch to an admin account to view user management data.",
        "info",
      );
      tableBody.innerHTML = `
        <tr><td colspan="6">${renderInlineState("Access denied for this module.", "warning")}</td></tr>
      `;
      return;
    }

    try {
      const response = await apiGet("/dashboard/users?limit=25");
      const users = Array.isArray(response?.data) ? response.data : [];
      const total = response?.pagination?.total;

      summaryEl.innerHTML = this.renderSummary(users);
      accessState.innerHTML = renderInlineState(
        total
          ? `Showing ${users.length} of ${formatNumber(total)} users.`
          : `Showing ${users.length} users.`,
        "info",
      );
      tableBody.innerHTML = this.renderRows(users);
    } catch (error) {
      summaryEl.innerHTML = `
        <article class="dashboard-panel col-span-full">
          <div class="dashboard-panel-body">
            ${renderInlineState(`Unable to load user summary: ${error.message}`, "error")}
          </div>
        </article>
      `;
      accessState.innerHTML = renderInlineState(
        "User service unavailable.",
        "error",
      );
      tableBody.innerHTML = `
        <tr><td colspan="6">${renderInlineState(`Unable to load users: ${error.message}`, "error")}</td></tr>
      `;
    }
  }
}

