import SevenDayGraph from "../charts/SevenDayGraph.js";
import {
  apiGet,
  escapeHtml,
  formatDate,
  formatNumber,
  getStatusBadge,
  Icons,
  renderInlineState,
} from "../utils.js";

export default class Overview {
  constructor() {
    this.sevenDayGraph = new SevenDayGraph();
  }

  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
    }
  }

  getImageUrl(record = {}) {
    let raw = String(record.image || record.imageUrl || "").trim();
    if (!raw) {
      const itemsArr = record.foodItems || record.items;
      if (itemsArr && itemsArr.length > 0 && itemsArr[0].image) {
        raw = String(itemsArr[0].image).trim();
      }
    }
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (raw.startsWith("/")) return raw;
    return `/${raw}`;
  }

  render() {
    const element = document.createElement("div");
    element.innerHTML = `

      <div class="dashboard-hero-note">
        Metrics below are synced from live donation and request submissions. Refresh this page after new form submissions to verify end-to-end updates.
      </div>

      <section id="overviewStatCards" class="dashboard-grid cols-4">
        <article class="metric-card"><h3>Total Donations</h3><p>-</p><div class="metric-note">All recorded submissions</div></article>
        <article class="metric-card"><h3>Active Pickups</h3><p>-</p><div class="metric-note">Assignments in progress</div></article>
        <article class="metric-card"><h3>Meals Saved</h3><p>-</p><div class="metric-note">Estimated fulfilled impact</div></article>
        <article class="metric-card"><h3>Active Volunteers</h3><p>-</p><div class="metric-note">Available field capacity</div></article>
      </section>

      <section class="dashboard-grid cols-2">
        <article class="dashboard-panel">
          <div class="dashboard-panel-header">
            <div>
              <h2 class="dashboard-panel-title">Weekly Donation Trend</h2>
              <p class="dashboard-panel-subtitle">Last seven days of dashboard activity.</p>
            </div>
          </div>
          <div class="dashboard-panel-body" style="height: 280px;">
            <canvas id="sevenDayChart" aria-label="Weekly donation chart"></canvas>
          </div>
        </article>

        <article class="dashboard-panel">
          <div class="dashboard-panel-header">
            <div>
              <h2 class="dashboard-panel-title">Impact Snapshot</h2>
              <p class="dashboard-panel-subtitle">Operational counters for quick decision-making.</p>
            </div>
          </div>
          <div class="dashboard-panel-body">
            <div id="overviewImpactList" class="list-stack">
              <div class="dashboard-inline-state">Loading impact metrics...</div>
            </div>
          </div>
        </article>
      </section>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <div>
            <h2 class="dashboard-panel-title">Recent Donations</h2>
            <p class="dashboard-panel-subtitle">Latest submissions flowing into pickup operations.</p>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div class="dashboard-table-wrap">
            <table class="dashboard-table" aria-label="Recent donations table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Donor</th>
                  <th>Items</th>
                  <th>Quantity</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody id="recentDonationsBody">
                <tr>
                  <td colspan="8">
                    <div class="dashboard-inline-state">Loading recent donations...</div>
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

  renderStatCards(stats = {}) {
    const cards = [
      {
        label: "Total Donations",
        value: formatNumber(stats.totalDonations),
        note: "All recorded submissions",
        icon: Icons.box,
      },
      {
        label: "Active Pickups",
        value: formatNumber(stats.activePickups),
        note: "Assignments in progress",
        icon: Icons.truck,
      },
      {
        label: "Meals Saved",
        value: formatNumber(stats.foodSaved),
        note: "Estimated fulfilled impact",
        icon: Icons.utensils,
      },
      {
        label: "Active Volunteers",
        value: formatNumber(stats.activeVolunteers),
        note: "Available field capacity",
        icon: Icons.user,
      },
    ];

    return cards
      .map(
        (card) => `
          <article class="metric-card">
            <h3 style="display:flex; justify-content:space-between; align-items:center;">
              ${escapeHtml(card.label)}
              <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${card.icon}</span>
            </h3>
            <p>${escapeHtml(card.value)}</p>
            <div class="metric-note">${escapeHtml(card.note)}</div>
          </article>
        `,
      )
      .join("");
  }

  renderImpactList(stats = {}) {
    const items = [
      {
        label: "Pending Donations",
        value: formatNumber(stats.pendingDonations),
      },
      {
        label: "Completed Donations",
        value: formatNumber(stats.completedDonations),
      },
      {
        label: "Pending Requests",
        value: formatNumber(stats.pendingRequests),
      },
      {
        label: "Partner NGOs",
        value: formatNumber(stats.partnerNgos),
      },
    ];

    return items
      .map(
        (item) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <small>Live count</small>
            </div>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `,
      )
      .join("");
  }

  renderRecentRows(records = []) {
    if (!Array.isArray(records) || records.length === 0) {
      return `
        <tr>
          <td colspan="8">
            ${renderInlineState("No donations yet. Submit your first donation form to populate this table.", "warning")}
          </td>
        </tr>
      `;
    }

    return records
      .map((record) => {
        const imageUrl = this.getImageUrl(record);
        const imageCell = imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="Donation item" loading="lazy" class="zoomable-img" data-zoom-url="${escapeHtml(imageUrl)}" style="width:44px;height:44px;object-fit:cover;border-radius:10px;border:1px solid var(--dash-border);cursor:pointer;transition:transform 0.2s;">`
          : `<span style="color:var(--dash-text-muted);font-size:12px;">No image</span>`;
        return `
          <tr class="expandable-row" onclick="if(!event.target.closest('button') && !event.target.classList.contains('zoomable-img')) this.classList.toggle('expanded')">
            <td>${imageCell}</td>
            <td>${escapeHtml(record.donorName || "Unknown")}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(record.items || "-")}</td>
            <td>${escapeHtml(record.quantity || "-")}</td>
            <td>${escapeHtml(record.city || "-")}</td>
            <td>${getStatusBadge(record.status)}</td>
            <td>${escapeHtml(formatDate(record.createdAt))}</td>
            <td class="truncate-cell" style="font-size:12px;color:var(--dash-text-muted);" title="Click to expand">${escapeHtml(record.notes || '-')}</td>
          </tr>
        `;
      })
      .join("");
  }

  async afterRender() {
    const statCardsEl = document.getElementById("overviewStatCards");
    const impactListEl = document.getElementById("overviewImpactList");
    const recentTableBody = document.getElementById("recentDonationsBody");

    const refreshData = async () => {
      const [statsResult, weeklyResult, recentResult] = await Promise.allSettled(
        [
          apiGet("/dashboard/stats"),
          apiGet("/dashboard/weekly-donations"),
          apiGet("/dashboard/recent-donations"),
        ],
      );

      if (statsResult.status === "fulfilled") {
        const stats = statsResult.value?.data || {};
        statCardsEl.innerHTML = this.renderStatCards(stats);
        impactListEl.innerHTML = this.renderImpactList(stats);
      } else {
        statCardsEl.innerHTML = `
        <article class="dashboard-panel" style="grid-column: 1 / -1;">
          <div class="dashboard-panel-body">
            ${renderInlineState(`Unable to load dashboard stats: ${statsResult.reason?.message || "Unknown error"}`, "error")}
          </div>
        </article>
      `;
        impactListEl.innerHTML = renderInlineState(
          "Impact metrics unavailable right now.",
          "error",
        );
      }

      if (weeklyResult.status === "fulfilled") {
        const chartData = weeklyResult.value?.data || {};
        const labels = Array.isArray(chartData.labels) ? chartData.labels : [];
        const values = Array.isArray(chartData.donations)
          ? chartData.donations
          : [];
        this.sevenDayGraph.render({ labels, values });
      } else {
        this.sevenDayGraph.render({
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          values: [0, 0, 0, 0, 0, 0, 0],
        });
      }

      if (recentResult.status === "fulfilled") {
        recentTableBody.innerHTML = this.renderRecentRows(
          recentResult.value?.data || [],
        );
      } else {
        recentTableBody.innerHTML = `
        <tr>
          <td colspan="8">
            ${renderInlineState(`Unable to load recent donations: ${recentResult.reason?.message || "Unknown error"}`, "error")}
          </td>
        </tr>
      `;
      }

      // Bind image zoom click handlers (NOT inline to avoid escapeHtml breaking onclick)
      this.bindImageZoom();
    };

    // Initial fetch
    await refreshData();

    // ── Real-time Socket.io updates ──
    // Clean up previous listeners to prevent duplicates on re-render
    if (this._socketCleanup) {
      this._socketCleanup();
    }

    if (window.socketService) {
      let refreshTimer = null;
      const debouncedRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          console.log("[Overview] Live update detected, refreshing metrics...");
          refreshData();
        }, 500);
      };

      window.socketService.on("newDonation", debouncedRefresh);
      window.socketService.on("donationCreated", debouncedRefresh);
      window.socketService.on("donationStatusUpdated", debouncedRefresh);
      window.socketService.on("donationClaimed", debouncedRefresh);

      this._socketCleanup = () => {
        window.socketService.off("newDonation", debouncedRefresh);
        window.socketService.off("donationCreated", debouncedRefresh);
        window.socketService.off("donationStatusUpdated", debouncedRefresh);
        window.socketService.off("donationClaimed", debouncedRefresh);
        if (refreshTimer) clearTimeout(refreshTimer);
        this._socketCleanup = null;
      };
    }

    // Bind initial image zoom handlers
    this.bindImageZoom();
  }

  /**
   * Binds click/hover handlers to all .zoomable-img elements.
   * Uses data-zoom-url attribute instead of inline onclick to avoid
   * escapeHtml breaking single quotes inside JS event attributes.
   */
  bindImageZoom() {
    document.querySelectorAll(".zoomable-img").forEach((img) => {
      // Prevent duplicate binding
      if (img.dataset.zoomBound) return;
      img.dataset.zoomBound = "true";

      img.addEventListener("mouseover", () => { img.style.transform = "scale(1.1)"; });
      img.addEventListener("mouseout", () => { img.style.transform = "scale(1)"; });
      img.addEventListener("click", () => {
        const rawUrl = img.dataset.zoomUrl;
        if (!rawUrl || rawUrl === "undefined") return;
        const fullUrl = rawUrl.includes("res.cloudinary.com")
          ? rawUrl.replace("/upload/w_100,c_fill,q_auto,f_auto/", "/upload/")
          : rawUrl;

        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;";
        overlay.addEventListener("click", () => overlay.remove());

        const zoomedImg = document.createElement("img");
        zoomedImg.src = fullUrl;
        zoomedImg.style.cssText = "max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 20px 40px -5px rgba(0,0,0,0.6);";

        overlay.appendChild(zoomedImg);
        document.body.appendChild(overlay);
      });
    });
  }
}
