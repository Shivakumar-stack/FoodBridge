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

export default class Donations {
  destroy() {
    if (this._socketCleanup) {
      this._socketCleanup();
    }
  }

  getImageUrl(donation = {}) {
    const raw = String(donation.image || donation.imageUrl || "").trim();
    if (!raw) return "";

    // Cloudinary optimization: Load small, compressed thumbnails instead of full 4K images
    if (raw.includes("res.cloudinary.com") && !raw.includes("/upload/w_")) {
      return raw.replace("/upload/", "/upload/w_100,c_fill,q_auto,f_auto/");
    }

    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (raw.startsWith("/")) return raw;
    return `/${raw}`;
  }

  render() {
    const element = document.createElement("div");
    element.innerHTML = `
      <section id="donationSummary" class="dashboard-grid cols-4">
        <article class="metric-card"><h3>Total</h3><p>-</p><div class="metric-note">All accessible donations</div></article>
        <article class="metric-card"><h3>Pending</h3><p>-</p><div class="metric-note">Waiting for action</div></article>
        <article class="metric-card"><h3>Claimed</h3><p>-</p><div class="metric-note">Reserved for dispatch</div></article>
        <article class="metric-card"><h3>Closed</h3><p>-</p><div class="metric-note">Completed handoff</div></article>
      </section>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header dashboard-table-header-row">
          <div>
            <h2 class="dashboard-panel-title">Donation Registry</h2>
            <p class="dashboard-panel-subtitle">Records pulled directly from live donation submissions.</p>
          </div>
          <div class="dashboard-filter-row">
            <select id="donationCategoryFilter" class="dashboard-select sm">
              <option value="all">All Categories</option>
              <option value="Cooked Food">Cooked Food</option>
              <option value="Raw Ingredients">Raw Ingredients</option>
              <option value="Packaged">Packaged</option>
              <option value="Baked Goods">Baked Goods</option>
              <option value="Beverages">Beverages</option>
              <option value="Dairy">Dairy</option>
              <option value="Fruits">Fruits</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Other">Other</option>
            </select>
            <select id="donationStatusFilter" class="dashboard-select sm">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="broadcasted">Broadcasted</option>
              <option value="claimed">Claimed</option>
              <option value="accepted">Accepted</option>
              <option value="picked_up">Picked Up</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div class="dashboard-panel-body">
          <div class="dashboard-table-wrap">
            <table class="dashboard-table" aria-label="Donations table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Donor</th>
                  <th>Items</th>
                  <th>Pickup</th>
                  <th>City</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="donationTableBody">
                <tr>
                  <td colspan="9">
                    <div class="dashboard-inline-state">Loading donations...</div>
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

  normalizeDonations(payload) {
    if (Array.isArray(payload?.data?.donations)) return payload.data.donations;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  getItemSummary(items = []) {
    if (!Array.isArray(items) || items.length === 0) return "-";
    return items
      .map(
        (item) =>
          `${item.itemName || "Item"} (${item.quantity || "-"} ${item.unit || ""})${item.category ? ` [${item.category}]` : ""}`,
      )
      .join(", ");
  }

  renderSummary(donations = []) {
    const counts = donations.reduce(
      (acc, donation) => {
        const status = String(donation.status || "").toLowerCase();
        acc.total += 1;
        if (
          status === "pending" ||
          status === "broadcasted" ||
          status === "assigned"
        )
          acc.pending += 1;
        if (status === "claimed" || status === "approved") acc.claimed += 1;
        if (["closed", "completed", "delivered", "fulfilled"].includes(status))
          acc.closed += 1;
        return acc;
      },
      { total: 0, pending: 0, claimed: 0, closed: 0 },
    );

    return `
      <article class="metric-card" style="border-top-color: #059669;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Total
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.box}</span>
        </h3>
        <p>${formatNumber(counts.total)}</p>
        <div class="metric-note">All accessible donations</div>
      </article>
      <article class="metric-card" style="border-top-color: #f59e0b;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Pending
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.clock}</span>
        </h3>
        <p>${formatNumber(counts.pending)}</p>
        <div class="metric-note">Waiting for action</div>
      </article>
      <article class="metric-card" style="border-top-color: #3b82f6;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Claimed
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.truck}</span>
        </h3>
        <p>${formatNumber(counts.claimed)}</p>
        <div class="metric-note">Reserved for dispatch</div>
      </article>
      <article class="metric-card" style="border-top-color: #64748b;">
        <h3 style="display:flex; justify-content:space-between; align-items:center;">
          Closed
          <span style="display:flex; color: var(--dash-text-muted); opacity: 0.8;">${Icons.checkCircle}</span>
        </h3>
        <p>${formatNumber(counts.closed)}</p>
        <div class="metric-note">Completed handoff</div>
      </article>
    `;
  }

  renderRows(donations = []) {
    if (!Array.isArray(donations) || donations.length === 0) {
      return `
        <tr>
          <td colspan="9">
            ${renderInlineState("No donation records available for this role yet.", "warning")}
          </td>
        </tr>
      `;
    }

    return donations
      .map((donation) => {
        const role = getUserRole();
        const donationId = donation._id || donation.id;
        const donorName =
          donation.donorName ||
          donation.donor_id?.organization?.name ||
          donation.donor_id?.name ||
          `${donation.donor_id?.firstName || ""} ${donation.donor_id?.lastName || ""}`.trim() ||
          "Donor";

        let actions = "-";
        let cancelBtn = "";
        let imageUrl = this.getImageUrl(donation);
        if (!imageUrl && (donation.foodItems || donation.items)) {
          const itemsArr = donation.foodItems || donation.items;
          if (itemsArr[0] && itemsArr[0].image) {
            imageUrl = this.getImageUrl(itemsArr[0]);
          }
        }
        const imageCell = imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="Donation item" loading="lazy" class="donation-thumbnail zoomable-img" data-zoom-url="${escapeHtml(imageUrl)}">`
          : `<span class="dashboard-muted-small">No image</span>`;

        // Cancel button logic: admin can cancel any non-terminal donation,
        // donor can cancel their own pending/broadcasted, volunteer can cancel if accepted by them
        const terminalStatuses = ["closed", "completed", "cancelled", "delivered"];
        if (role === "admin" && !terminalStatuses.includes(donation.status)) {
          cancelBtn = `<button class="dashboard-button danger sm action-cancel-btn" data-id="${donationId}" style="margin-left:4px;">Cancel</button>`;
        } else if (role === "donor" && (donation.status === "pending" || donation.status === "broadcasted")) {
          cancelBtn = `<button class="dashboard-button danger sm action-cancel-btn" data-id="${donationId}" style="margin-left:4px;">Cancel</button>`;
        } else if (role === "volunteer" && donation.status === "accepted") {
          cancelBtn = `<button class="dashboard-button danger sm action-cancel-btn" data-id="${donationId}" style="margin-left:4px;">Cancel</button>`;
        }

        if (role === "ngo" && (donation.status === "pending" || donation.status === "broadcasted") && !donation.claimedBy) {
          actions = `<button class="dashboard-button primary sm action-claim-btn" data-id="${donationId}">Claim</button>`;
        } else if (role === "ngo" && donation.status === "delivered" && donation.claimedBy) {
          actions = `<button class="dashboard-button primary sm action-confirm-btn" data-id="${donationId}">Confirm Receipt</button>`;
        } else if (role === "volunteer" && donation.status === "claimed" && !donation.assignedVolunteer) {
          actions = `<button class="dashboard-button primary sm action-accept-btn" data-id="${donationId}">Accept</button>`;
        } else if (role === "volunteer" && donation.status === "accepted") {
          actions = `<button class="dashboard-button primary sm action-pickup-btn" data-id="${donationId}">Mark Picked Up</button>`;
        } else if (role === "volunteer" && (donation.status === "picked_up" || donation.status === "in_transit")) {
          actions = `<button class="dashboard-button primary sm action-deliver-btn" data-id="${donationId}">Mark Delivered</button>`;
        }

        // Append cancel button after the primary action
        if (cancelBtn) actions = (actions === "-" ? "" : actions) + cancelBtn;

        const detailsId = `donation-details-${donationId}`;

        return `
          <tr class="expandable-row donation-record-row" data-donation-id="${donationId}" data-detail-row="${detailsId}" aria-expanded="false">
            <td>${imageCell}</td>
            <td>${escapeHtml(donorName)}</td>
            <td class="truncate-cell" title="Click to expand">${escapeHtml(this.getItemSummary(donation.foodItems || donation.items || []))}</td>
            <td>${escapeHtml(formatDateTime(donation.pickupTime || donation.pickupDatetime || donation.pickup_datetime))}</td>
            <td>${escapeHtml(donation.city || "Karnataka")}</td>
            <td>${escapeHtml(donation.priority || "Medium")}</td>
            <td>${getStatusBadge(donation.status)}</td>
            <td class="truncate-cell dashboard-muted-small" title="Click to expand">${escapeHtml(donation.notes || '-')}</td>
            <td>${actions}</td>
          </tr>
          <tr id="${detailsId}" class="donation-detail-row" hidden>
            <td colspan="9">
              ${this.renderDonationDetails(donation, donorName)}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  renderDonationDetails(donation = {}, donorName = "Donor") {
    const items = donation.foodItems || donation.items || [];
    const itemList = Array.isArray(items) && items.length
      ? items
          .map(
            (item) => {
              const itemImgUrl = item.image || item.imageUrl;
              const itemImg = itemImgUrl ? `<img src="${escapeHtml(this.getImageUrl(item))}" alt="Item image" class="w-20 h-20 rounded-xl object-cover shadow-sm zoomable-img cursor-pointer flex-shrink-0" data-zoom-url="${escapeHtml(itemImgUrl)}">` : `<div class="w-20 h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-300 flex-shrink-0"><i class="fas fa-image text-2xl"></i></div>`;
              
              let aiBadge = '';
              if (item.aiAnalysis && item.aiAnalysis.detectedName) {
                const conf = Math.round(item.aiAnalysis.confidence * 100);
                aiBadge = `
                  <div class="mt-4 p-3.5 bg-slate-50 border border-slate-100 shadow-sm rounded-xl relative overflow-hidden group">
                    <div class="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <i class="fas fa-robot text-emerald-500"></i> AI Image Analysis
                    </div>
                    <div class="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200/60 text-[9px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider mb-3">
                      <i class="fas fa-check-circle"></i> Completed
                    </div>
                    <div class="text-[11px] text-slate-600 space-y-2.5">
                      <div class="flex justify-between items-center border-b border-slate-200/60 pb-2">
                        <span class="text-slate-500">Detected:</span>
                        <span class="font-semibold text-slate-900 truncate ml-2" title="${escapeHtml(item.aiAnalysis.detectedName || "Unknown")}">${escapeHtml(item.aiAnalysis.detectedName || "Unknown")}</span>
                      </div>
                      <div class="flex justify-between items-center border-b border-slate-200/60 pb-2">
                        <span class="text-slate-500">Category:</span>
                        <span class="font-semibold text-slate-900 truncate ml-2" title="${escapeHtml(item.aiAnalysis.detectedCategory || "Unknown")}">${escapeHtml(item.aiAnalysis.detectedCategory || "Unknown")}</span>
                      </div>
                      <div class="flex justify-between items-center pt-0.5">
                        <span class="text-slate-500">Confidence:</span>
                        <span class="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">${conf}%</span>
                      </div>
                    </div>
                  </div>`;
              }

              return `
                <div class="border border-slate-200 rounded-2xl p-5 bg-white flex gap-5 min-w-[460px] max-w-[540px] flex-shrink-0 snap-start shadow-sm hover:shadow-md transition-all relative">
                  ${itemImg}
                  <div class="flex-1 min-w-0">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><i class="fas fa-box-open"></i> Donor Entered</div>
                    <div class="text-base font-bold text-slate-900 truncate" title="${escapeHtml(item.itemName || item.name || "Item")}">${escapeHtml(item.itemName || item.name || "Item")}</div>
                    <div class="text-xs text-slate-500 mt-2 flex items-center flex-wrap gap-2">
                      <span class="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">${escapeHtml(item.quantity || "-")} ${escapeHtml(item.unit || "")}</span>
                      ${item.category ? `<span class="bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider border border-emerald-100/80">${escapeHtml(item.category)}</span>` : ""}
                    </div>
                    ${aiBadge}
                  </div>
                </div>
              `;
            }
          )
          .join("")
      : `<div class="p-6 text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-center w-full font-medium"><i class="fas fa-inbox text-slate-400 text-2xl mb-2 block"></i> No item details available.</div>`;

    const pickupAddress = donation.pickupAddress || {};
    const fullAddress = [
      pickupAddress.street || pickupAddress.address || donation.address,
      pickupAddress.city || donation.city,
      pickupAddress.state || donation.state,
      pickupAddress.zipCode || donation.zip,
    ].filter(Boolean).join(", ");

    return `
      <div class="p-2 sm:p-4">
        <div class="bg-slate-50/50 rounded-2xl border border-slate-200 p-6 flex flex-col gap-6">
          
          <div class="flex flex-wrap gap-8 justify-between border-b border-slate-200/70 pb-6">
            <div class="flex-1 min-w-[250px]">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <i class="fas fa-user"></i>
                </div>
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Donor Details</h4>
              </div>
              <div class="font-bold text-slate-900 text-lg ml-10">${escapeHtml(donorName)}</div>
              <div class="text-sm text-slate-600 mt-2 ml-10 flex items-start gap-2">
                <i class="fas fa-map-marker-alt text-slate-400 mt-0.5"></i>
                <span>${escapeHtml(fullAddress || "Address not available")}</span>
              </div>
              <div class="text-sm font-medium text-slate-700 mt-3 ml-10 inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <i class="fas fa-calendar-alt text-emerald-600"></i> 
                <span>Pickup: ${escapeHtml(formatDateTime(donation.pickupTime || donation.pickupDatetime || donation.pickup_datetime))}</span>
              </div>
            </div>
            
            <div class="flex-1 min-w-[250px] sm:border-l sm:border-slate-200/70 sm:pl-8">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <i class="fas fa-clipboard-list"></i>
                </div>
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Operational Notes</h4>
              </div>
              <p class="text-sm text-slate-600 mb-4 ml-10 bg-white p-3 rounded-xl border border-slate-200 italic shadow-sm">${escapeHtml(donation.notes || "No notes provided.")}</p>
              <div class="flex items-center gap-3 ml-10">
                <div class="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                  <span class="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</span>
                  <span class="text-sm font-bold text-slate-800">${escapeHtml(donation.status || "-")}</span>
                </div>
                <div class="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                  <span class="text-xs text-slate-400 uppercase font-bold tracking-wider">Priority</span>
                  <span class="text-sm font-bold text-slate-800">${escapeHtml(donation.priority || "-")}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="w-full">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <i class="fas fa-apple-alt"></i>
                </div>
                <h4 class="text-sm font-bold text-slate-900">
                  Food Items 
                  <span class="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-full ml-2 font-bold">${Array.isArray(items) ? items.length : 0}</span>
                </h4>
              </div>
              <span class="text-xs text-slate-400 font-medium bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm flex items-center gap-1.5">
                <i class="fas fa-arrows-alt-h text-slate-300"></i> Swipe to see more
              </span>
            </div>
            
            <style>
              .custom-scroll::-webkit-scrollbar { height: 8px; }
              .custom-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
              .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f1f5f9; }
              .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            </style>
            
            <div class="flex gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory custom-scroll pl-1" style="-webkit-overflow-scrolling: touch;">
              ${itemList}
            </div>
          </div>
          
        </div>
      </div>
    `;
  }

  async afterRender() {
    const summaryEl = document.getElementById("donationSummary");
    const tableBody = document.getElementById("donationTableBody");

    // Global zoom function is now managed by utils.js

    const bindActions = () => {
      document.querySelectorAll(".action-claim-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = "Claiming...";
          try {
            await apiPut(`/donations/${id}/claim`, {});
            if (typeof window.ui !== "undefined") window.ui.showAlert("Donation claimed successfully", "success");
            this.afterRender();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Claim";
            if (typeof window.ui !== "undefined") window.ui.showAlert(e.message, "error");
          }
        };
      });

      document.querySelectorAll(".action-accept-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = "Accepting...";
          try {
            await apiPut(`/donations/${id}/status`, { status: "accepted" });
            if (typeof window.ui !== "undefined") window.ui.showAlert("Pickup accepted", "success");
            this.afterRender();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Accept";
            if (typeof window.ui !== "undefined") window.ui.showAlert(e.message, "error");
          }
        };
      });

      document.querySelectorAll(".action-pickup-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = "Updating...";
          try {
            await apiPut(`/donations/${id}/status`, { status: "picked_up" });
            if (typeof window.ui !== "undefined") window.ui.showAlert("Donation marked as picked up", "success");
            this.afterRender();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Mark Picked Up";
            if (typeof window.ui !== "undefined") window.ui.showAlert(e.message, "error");
          }
        };
      });

      document.querySelectorAll(".action-deliver-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = "Delivering...";
          try {
            await apiPut(`/donations/${id}/status`, { status: "delivered" });
            if (typeof window.ui !== "undefined") window.ui.showAlert("Donation marked as delivered", "success");
            this.afterRender();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Mark Delivered";
            if (typeof window.ui !== "undefined") window.ui.showAlert(e.message, "error");
          }
        };
      });

      document.querySelectorAll(".action-confirm-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = "Confirming...";
          try {
            await apiPut(`/donations/${id}/status`, { status: "closed" });
            if (typeof window.ui !== "undefined") window.ui.showAlert("Receipt confirmed. Handoff completed.", "success");
            this.afterRender();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Confirm Receipt";
            if (typeof window.ui !== "undefined") window.ui.showAlert(e.message, "error");
          }
        };
      });

      document.querySelectorAll(".action-cancel-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          if (!window.confirm("Are you sure you want to cancel this donation?")) return;
          btn.disabled = true;
          btn.textContent = "Cancelling...";
          try {
            await apiPut(`/donations/${id}/status`, { status: "cancelled", notes: "Cancelled from dashboard" });
            if (typeof window.ui !== "undefined") window.ui.showAlert("Donation cancelled successfully", "success");
            this.afterRender();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Cancel";
            if (typeof window.ui !== "undefined") window.ui.showAlert(e.message, "error");
          }
        };
      });
    };

    // Reusable data-fetch function for both initial load and socket-triggered refreshes
    const refreshDonations = async () => {
      try {
        const categoryFilter = document.getElementById("donationCategoryFilter");
        const statusFilter = document.getElementById("donationStatusFilter");
        
        let queryParams = [];
        if (categoryFilter && categoryFilter.value && categoryFilter.value !== "all") {
          queryParams.push(`category=${encodeURIComponent(categoryFilter.value)}`);
        }
        if (statusFilter && statusFilter.value && statusFilter.value !== "all") {
          queryParams.push(`status=${encodeURIComponent(statusFilter.value)}`);
        }
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
        const response = await apiGet(`/donations${queryString}`);
        const donations = this.normalizeDonations(response);

        summaryEl.innerHTML = this.renderSummary(donations);
        tableBody.innerHTML = this.renderRows(donations);
        bindActions();
        this.bindImageZoom();
        this.bindRowExpansion();
        this.bindItemDetails();
      } catch (error) {
        summaryEl.innerHTML = `
          <article class="dashboard-panel" style="grid-column: 1 / -1;">
            <div class="dashboard-panel-body">
              ${renderInlineState(`Unable to load donation stats: ${error.message}`, "error")}
            </div>
          </article>
        `;
        tableBody.innerHTML = `
          <tr>
            <td colspan="8">${renderInlineState(`Unable to load donations: ${error.message}`, "error")}</td>
          </tr>
        `;
      }
    };

    // Initial data fetch
    await refreshDonations();

    // Bind filter change listeners (once only)
    const categoryFilter = document.getElementById("donationCategoryFilter");
    const statusFilter = document.getElementById("donationStatusFilter");
    if (categoryFilter && !categoryFilter.dataset.bound) {
      categoryFilter.dataset.bound = "true";
      categoryFilter.addEventListener("change", () => refreshDonations());
    }
    if (statusFilter && !statusFilter.dataset.bound) {
      statusFilter.dataset.bound = "true";
      statusFilter.addEventListener("change", () => refreshDonations());
    }

    // ── Real-time Socket.io updates ──
    // Clean up any previous listeners from a prior afterRender call
    if (this._socketCleanup) {
      this._socketCleanup();
    }

    if (window.socketService) {
      // Debounce rapid-fire socket events so we don't hammer the API
      let refreshTimer = null;
      const debouncedRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          console.log("[Donations] Live update detected, refreshing table...");
          refreshDonations();
        }, 500);
      };

      window.socketService.on("donationStatusUpdated", debouncedRefresh);
      window.socketService.on("donationClaimed", debouncedRefresh);
      window.socketService.on("newDonation", debouncedRefresh);
      window.socketService.on("donationCreated", debouncedRefresh);
      window.socketService.on("donationUpdated", debouncedRefresh);

      // Store cleanup so we can remove listeners if page re-renders
      this._socketCleanup = () => {
        window.socketService.off("donationStatusUpdated", debouncedRefresh);
        window.socketService.off("donationClaimed", debouncedRefresh);
        window.socketService.off("newDonation", debouncedRefresh);
        window.socketService.off("donationCreated", debouncedRefresh);
        window.socketService.off("donationUpdated", debouncedRefresh);
        if (refreshTimer) clearTimeout(refreshTimer);
        this._socketCleanup = null;
      };
    }
  }

  /**
   * Binds click/hover handlers to all .zoomable-img elements.
   * Uses data-zoom-url attribute instead of inline onclick to avoid
   * escapeHtml breaking single quotes inside JS event attributes.
   */
  bindImageZoom() {
    document.querySelectorAll(".zoomable-img").forEach((img) => {
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

  bindItemDetails() {
    document.querySelectorAll(".item-detail-toggle").forEach((li) => {
      if (li.dataset.itemBound === "true") return;
      li.dataset.itemBound = "true";
      li.addEventListener("click", (e) => {
        // prevent toggling if clicking the image itself
        if (e.target.tagName.toLowerCase() === 'img') return;
        
        const details = li.querySelector('.ai-analysis-details');
        if (details) {
          details.classList.toggle('hidden');
        }
      });
    });
  }

  bindRowExpansion() {
    document.querySelectorAll(".donation-record-row").forEach((row) => {
      if (row.dataset.expandBound === "true") return;
      row.dataset.expandBound = "true";

      row.addEventListener("click", (event) => {
        const target = event.target;
        if (
          target.closest("button") ||
          target.closest("a") ||
          target.classList.contains("zoomable-img")
        ) {
          return;
        }

        const detailRow = document.getElementById(row.dataset.detailRow);
        if (!detailRow) return;

        const expanded = row.getAttribute("aria-expanded") === "true";
        row.setAttribute("aria-expanded", String(!expanded));
        row.classList.toggle("expanded", !expanded);
        detailRow.hidden = expanded;
      });
    });
  }
}
