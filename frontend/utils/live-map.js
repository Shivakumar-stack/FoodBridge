const DEFAULT_MAP_CENTER = [15.3173, 75.7139];
const DEFAULT_MAP_ZOOM = 7;
const MAP_REFRESH_INTERVAL_MS = 30000;
const FALLBACK_SOCKET_URL = window.location.origin;
const SOCKET_SERVER_URL =
  window.appConfig?.SOCKET_SERVER_URL || FALLBACK_SOCKET_URL;
const DEFAULT_USER_LOCATION = { lat: 12.9716, lng: 77.5946 };

const CITY_COORDINATES = {
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  bangaluru: [12.9716, 77.5946],
  mysore: [12.2958, 76.6394],
  mysuru: [12.2958, 76.6394],
  hubli: [15.3647, 75.124],
  hublidharwad: [15.3647, 75.124],
  dharwad: [15.4589, 75.0078],
  mangalore: [12.9141, 74.856],
  mangaluru: [12.9141, 74.856],
  belgaum: [15.8497, 74.4977],
  belagavi: [15.8497, 74.4977],
  kalaburagi: [17.3297, 76.8343],
  gulbarga: [17.3297, 76.8343],
  davanagere: [14.4644, 75.9218],
  shivamogga: [13.9299, 75.5681],
  shimoga: [13.9299, 75.5681],
  udupi: [13.3409, 74.7971],
  manipal: [13.4588, 74.7845],
  tumkur: [13.3389, 77.1015],
  bellary: [15.0574, 76.8824],
  bellari: [15.0574, 76.8824],
  hassan: [13.0034, 76.1014],
  chitradurga: [14.1022, 76.4055],
  madikeri: [12.4208, 75.7327],
  bagalkot: [16.1824, 75.6951],
  raichur: [16.4024, 77.3536],
  koppal: [15.3497, 76.1512],
  karwar: [14.6154, 74.7135],
  sirsi: [14.6187, 74.8439],
  sindhanur: [15.1167, 76.2167],
  narasimharajapura: [13.3667, 75.5667],
  yadgir: [16.7724, 77.2946],
  ranebennur: [14.6259, 75.5981],
  hoskote: [13.2167, 77.7992],
  chikballapur: [13.4319, 77.7273],
  kolar: [13.1366, 78.1347],
  mulbagal: [13.1715, 78.2348],
  bypass: [15.3173, 75.7139],
  karnataka: [15.3173, 75.7139],
};

function getPriorityMeta(score = 0) {
  if (score >= 70) {
    return {
      bucket: "critical",
      label: "Critical",
      markerColor: "#ef4444",
      color: "#ef4444", // Alias for markerColor
      className: "map-priority-critical",
    };
  }

  if (score >= 40) {
    return {
      bucket: "medium",
      label: "Medium",
      markerColor: "#059669",
      color: "#059669", // Alias for markerColor
      className: "map-priority-medium",
    };
  }

  return {
    bucket: "low",
    label: "Low",
    markerColor: "#22c55e",
    color: "#22c55e", // Alias for markerColor
    className: "map-priority-low",
  };
}

const MapModule = {
  map: null,
  markerLayer: null,
  markers: [],
  selectedDonationId: "",
  isExpanded: false,
  hasAutoFitted: false,
  role: "",
  user: null,
  donations: [],
  urgencyFilter: "all",
  radiusFilterKm: "all",
  searchQuery: "",
  refreshTimer: null,
  refreshInFlight: false,
  actionInFlight: false,
  interactionEnabled: false,
  socket: null,
  heatLayer: null,
  heatmapEnabled: false,
  actionDelegationBound: false,
  _actionClickHandler: null,
  _resizeHandler: null,
  _escapeHandler: null,
  _socketOfflineTimer: null,
  _refreshFromSocket: null,
  userLocation: null,
  userLocationMarker: null,
  detailDrawerEl: null,
  detailContentEl: null,
  accessNoticeTextEl: null,
  accessNoticeActionEl: null,

  init() {
    // Prevent double-init: if already running, tear down first
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.hasAutoFitted = false;
    this.actionDelegationBound = false;
    this.socketStatusUpdater = (state) => {
      const statusEl = document.getElementById("socketStatusIndicator");
      if (!statusEl) return;
      if (state === "connected") {
        statusEl.innerHTML = '<i class="fas fa-circle text-emerald-500 text-xs animate-pulse"></i> Live';
        statusEl.style.color = "#059669";
        return;
      }
      if (state === "offline") {
        statusEl.innerHTML = '<i class="fas fa-exclamation-circle text-amber-500 text-xs"></i> Offline';
        statusEl.style.color = "#d97706";
        return;
      }
      if (state === "reconnecting") {
        statusEl.innerHTML = '<i class="fas fa-wifi text-amber-500 text-xs"></i> Reconnecting...';
        statusEl.style.color = "#d97706";
        return;
      }
      statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin text-emerald-500 text-xs"></i> Connecting...';
      statusEl.style.color = "#4b5563";
    };

    this.ensureDependencies();
    this.setupUserContext();
    this.initLeaflet();
    this.bindControls();
    this.setupDetailDrawer();
    this.setupExpandButton();
    this.setupRealtimeSync();
    this.startAutoRefresh();
    this.registerImageZoom();
    this.refreshData({ forceFit: true });

    this.handleInvalidation();
  },

  registerImageZoom() {
    if (window.openFullImage) return;
    window.openFullImage = (url) => {
      if (!url || url === "undefined") return;
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;";
      overlay.onclick = () => document.body.removeChild(overlay);
      const img = document.createElement("img");
      img.src = url;
      img.style.cssText = "max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);";
      overlay.appendChild(img);
      document.body.appendChild(overlay);
    };

    document.addEventListener("click", (event) => {
      const image = event.target.closest("[data-zoom-url]");
      if (!image) return;
      window.openFullImage(image.dataset.zoomUrl);
    });
  },

  ensureDependencies() {
    if (!window.donationService) {
      this.showMapError("Data service failed to load. Please refresh the page.");
      throw new Error("donationService not available");
    }
    if (typeof L === "undefined") {
      throw new Error("Leaflet L not available");
    }
  },

  setupUserContext() {
    const hasAuth = window.authService && typeof window.authService !== "undefined";
    const isLoggedIn = hasAuth && window.authService.isLoggedIn();
    this.user = isLoggedIn ? window.authService.getUser() || {} : null;
    this.role = this.user?.role || "public";
    console.log(`[Map] Initialized as ${this.role} role`);
  },

  initLeaflet() {
    const mapNode = document.getElementById("map");
    if (!mapNode) return;

    // Apply styling to prevent the map from blending into the background
    mapNode.style.border = "1px solid var(--dash-border, #e5e7eb)";
    mapNode.style.borderRadius = "12px";
    mapNode.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
    mapNode.style.overflow = "hidden";

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.map = L.map("map", {
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
      tap: true,
    }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

    // Keep visual-only heat data below interactive donation markers.
    this.map.createPane("donationHeatPane");
    this.map.getPane("donationHeatPane").style.zIndex = "350";
    this.map.getPane("donationHeatPane").style.pointerEvents = "none";
    this.map.createPane("donationMarkerPane");
    this.map.getPane("donationMarkerPane").style.zIndex = "650";

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(this.map);

    this.createMarkerLayer();
    this.interactionEnabled = true;
    this.updateInteractionButton();
  },

  handleInvalidation() {
    window.setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 200);

    window.addEventListener("resize", () => {
      if (this.map) this.map.invalidateSize();
    });
  },

  createMarkerLayer() {
    if (!this.map) return;

    if (this.markerLayer && this.map.hasLayer(this.markerLayer)) {
      this.map.removeLayer(this.markerLayer);
    }

    // Every donation remains a direct click target. Collocated records are
    // spread in renderMarkers() rather than hidden behind a single cluster.
    this.markerLayer = L.featureGroup();

    this.markerLayer.addTo(this.map);
  },

  isAuthenticated() {
    return (
      window.authService &&
      typeof window.authService !== "undefined" &&
      window.authService.isLoggedIn()
    );
  },

  showAlert(message, type = "info") {
    if (typeof ui !== "undefined" && typeof ui.showAlert === "function") {
      ui.showAlert(message, type);
    }
  },

  showMapError(message) {
    const viewport = document.getElementById("mapViewport");
    if (viewport) {
      let state = document.getElementById("mapStateOverlay");
      if (!state) {
        state = document.createElement("div");
        state.id = "mapStateOverlay";
        state.className = "map-state-overlay";
        viewport.appendChild(state);
      }
      state.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full bg-gray-50 p-8 text-center">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
          </div>
          <p class="text-gray-700 font-medium max-w-md">${message}</p>
          <button data-map-action="reloadPage" class="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            Refresh Page
          </button>
        </div>
      `;
    }
    console.error("Map error:", message);
  },

  showMapLoading() {
    const viewport = document.getElementById("mapViewport");
    if (viewport) {
      let state = document.getElementById("mapStateOverlay");
      if (!state) {
        state = document.createElement("div");
        state.id = "mapStateOverlay";
        state.className = "map-state-overlay";
        viewport.appendChild(state);
      }
      state.innerHTML = `
        <div class="flex items-center justify-center h-full bg-gray-50">
          <div class="text-center">
            <i class="fas fa-circle-notch fa-spin text-emerald-500 text-4xl mb-4"></i>
            <p class="text-gray-600">Loading map data...</p>
          </div>
        </div>
      `;
    }
  },

  refreshRolePresentation() {
    const subtitle = document.getElementById("mapViewSubtitle");
    const roleLabels = {
      donor: "Donor View - Your donations and statuses",
      volunteer: "Volunteer View - Available pickups by urgency",
      ngo: "NGO View - Discover and claim available donations",
      admin: "Admin View - Global donations overview",
      public: "Community View - Live public donation feed",
    };

    if (subtitle) {
      subtitle.textContent = roleLabels[this.role] || "Live donation map";
    }

    const urgencySelect = document.getElementById("urgencyFilter");
    if (urgencySelect) {
      if (this.role === "volunteer") {
        urgencySelect.classList.remove("hidden");
      } else {
        urgencySelect.classList.add("hidden");
      }
    }

    this.updateMapScopeLabel();
    this.updateAccessNotice();
  },

  setupAccessNotice() {
    this.accessNoticeTextEl = document.getElementById("mapAccessNoticeText");
    this.accessNoticeActionEl = document.getElementById(
      "mapAccessNoticeAction",
    );

    if (this.accessNoticeActionEl && !this.accessNoticeActionEl.dataset.bound) {
      this.accessNoticeActionEl.dataset.bound = "true";
      this.accessNoticeActionEl.addEventListener("click", () => {
        if (this.isAuthenticated()) return;
        sessionStorage.setItem("redirectAfterLogin", window.location.href);
      });
    }

    this.updateAccessNotice();
  },

  updateAccessNotice() {
    if (!this.accessNoticeTextEl || !this.accessNoticeActionEl) return;

    if (!this.isAuthenticated()) {
      this.accessNoticeTextEl.textContent =
        "Guest mode: viewing public live data. Log in with your account to claim or accept donations.";
      this.accessNoticeActionEl.classList.remove("hidden");
      return;
    }

    const roleMessages = {
      donor:
        "Signed in as donor. You can track your donation statuses in real time.",
      volunteer:
        "Signed in as volunteer. You can accept nearby pickups directly from the map.",
      ngo: "Signed in as NGO. You can claim eligible donations directly from the map.",
      admin:
        "Signed in as admin. You are viewing network-wide donation activity.",
    };

    this.accessNoticeTextEl.textContent =
      roleMessages[this.role] ||
      "Signed in. Your role-based map permissions are active.";
    this.accessNoticeActionEl.classList.add("hidden");
  },

  bindControls() {
    this.refreshRolePresentation();
    this.setupAccessNotice();
    this.bindMapActionDelegation();

    const urgencySelect = document.getElementById("urgencyFilter");
    if (urgencySelect) {
      urgencySelect.addEventListener("change", () => {
        this.urgencyFilter = urgencySelect.value;
        this.renderMarkers({ forceFit: true });
      });
    }

    const searchInput = document.getElementById("mapSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        this.searchQuery = String(searchInput.value || "")
          .trim()
          .toLowerCase();
        this.renderMarkers({ forceFit: false });
      });
    }

    const radiusSelect = document.getElementById("radiusFilter");
    if (radiusSelect) {
      radiusSelect.addEventListener("change", async () => {
        this.radiusFilterKm = radiusSelect.value;

        if (this.radiusFilterKm !== "all" && !this.userLocation) {
          await this.bootstrapUserLocation({
            recenter: false,
            showMarker: true,
          });
        }

        this.renderMarkers({ forceFit: true });
      });
    }

    const heatmapToggleBtn = document.getElementById("heatmapToggleBtn");
    heatmapToggleBtn?.addEventListener("click", () => {
      this.toggleHeatmap();
    });
    this.updateHeatmapButton();

    const interactionBtn = document.getElementById("interactionToggleBtn");
    interactionBtn?.addEventListener("click", () => {
      this.toggleInteraction();
    });
    this.updateInteractionButton();
  },

  bindMapActionDelegation() {
    if (this.actionDelegationBound) return;
    this.actionDelegationBound = true;

    this._actionClickHandler = (event) => {
      const actionEl = event.target.closest("[data-map-action]");
      if (!actionEl || !document.getElementById("mapWrapper")?.contains(actionEl)) return;

      const action = actionEl.dataset.mapAction;
      const donationId = actionEl.dataset.donationId || "";
      const status = actionEl.dataset.status || "";
      this.handleMapAction(action, donationId, status);
    };
    document.addEventListener("click", this._actionClickHandler);
  },

  handleMapAction(action, donationId = "", status = "") {
    const actions = {
      reloadPage: () => window.location.reload(),
      resetView: () => this.resetView(),
      refreshData: () => this.refreshData({ forceFit: false }),
      locateUser: () => this.locateUser(),
      openDetail: () => this.openDetailDrawerByDonationId(donationId),
      acceptPickup: () => this.acceptPickup(donationId),
      claimDonation: () => this.claimDonation(donationId),
      markPickedUp: () => this.markPickedUp(donationId),
      markDelivered: () => this.markDelivered(donationId),
      confirmReceipt: () => this.confirmReceipt(donationId),
      adminCancelDonation: () => this.adminCancelDonation(donationId),
      adminMarkPickedUp: () => this.adminMarkPickedUp(donationId),
      adminMarkDelivered: () => this.adminMarkDelivered(donationId),
      adminCloseDonation: () => this.adminCloseDonation(donationId, status),
    };

    if (actions[action]) {
      actions[action]();
    }
  },

  updateMapScopeLabel() {
    const scopeLabel = document.getElementById("mapDataScopeLabel");
    if (!scopeLabel) return;

    const roleLabelMap = {
      donor: "Your donation activity",
      volunteer: "Nearby pending pickups",
      ngo: "Claimable public donations",
      admin: "Network-wide donation feed",
      public: "Public active donation feed",
    };

    scopeLabel.textContent = roleLabelMap[this.role] || "Live donation feed";
  },

  setupDetailDrawer() {
    this.detailDrawerEl = document.getElementById("mapDetailDrawer");
    this.detailContentEl = document.getElementById("mapDetailContent");
    const closeBtn = document.getElementById("mapDetailCloseBtn");
    closeBtn?.addEventListener("click", () => this.closeDetailDrawer());
  },

  setupRealtimeSync() {
    if (!this.socket) {
      if (window.socketService && typeof window.socketService.init === "function") {
        this.socket = window.socketService.init();
      } else if (typeof io === "function") {
        this.socket = io(SOCKET_SERVER_URL, {
          withCredentials: true,
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          timeout: 10000,
        });
      }
    }

    if (this.socket && !this.socket.connected && this.socket.disconnected && typeof this.socket.connect === "function") {
      this.socket.connect();
    }

    if (!this.socket) {
      console.warn("[LiveMap] Socket.IO client not available. Real-time sync disabled.");
      return;
    }

    if (this._refreshFromSocket) {
      this.socket.off("newDonation", this._refreshFromSocket);
      this.socket.off("donationStatusUpdated", this._refreshFromSocket);
      this.socket.off("donationClaimed", this._refreshFromSocket);
    }
    this._refreshFromSocket = () => this.refreshData({ forceFit: false });
    this.socket.on("newDonation", this._refreshFromSocket);
    this.socket.on("donationStatusUpdated", this._refreshFromSocket);
    this.socket.on("donationClaimed", this._refreshFromSocket);

    if (this._onSocketConnect) this.socket.off("connect", this._onSocketConnect);
    if (this._onSocketError) this.socket.off("connect_error", this._onSocketError);
    if (this._onSocketDisconnect) this.socket.off("disconnect", this._onSocketDisconnect);

    this._onSocketConnect = () => {
      if (this.user) {
        const userId = this.user.id || this.user._id;
        if (userId) {
          this.socket.emit("join", userId);
        }
      }
      this.socketStatusUpdater("connected");
    };

    this._onSocketError = (error) => {
      this.socketStatusUpdater("offline");
      console.error("Socket connection error:", error?.message || error);
    };

    this._onSocketDisconnect = (reason) => {
      this.socketStatusUpdater("reconnecting");
      console.warn("Socket disconnected:", reason);
    };

    this.socket.on("connect", this._onSocketConnect);
    this.socket.on("connect_error", this._onSocketError);
    this.socket.on("disconnect", this._onSocketDisconnect);

    const isConnected = Boolean(this.socket?.connected || window.socketService?.socket?.connected);
    if (isConnected) {
      this.socketStatusUpdater("connected");
    } else {
      this.socketStatusUpdater("connecting");
      // Add a timeout to prevent infinite "Connecting..." if the server is offline
      this._socketOfflineTimer = window.setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          this.socketStatusUpdater("offline");
        }
      }, 3500);
    }
  },

  async bootstrapUserLocation(options = {}) {
    const recenter = options.recenter === true;
    const showMarker = options.showMarker !== false;

    if (!this.map) {
      return this.useFallbackLocation();
    }

    if (!navigator.geolocation) {
      return this.useFallbackLocation(
        "Geolocation not supported",
      );
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude);
          const lng = Number(position.coords.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve(this.useFallbackLocation());
            return;
          }

          this.userLocation = { lat, lng };

          if (recenter) {
            this.map.setView([lat, lng], 11);
            this.hasAutoFitted = true;
          }

          if (showMarker) {
            this.renderUserLocationMarker();
          }

          resolve(this.userLocation);
        },
        (error) => {
          console.warn("Geolocation fallback active:", error?.message || error);
          resolve(this.useFallbackLocation());
        },
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 300000,
        },
      );
    });
  },

  useFallbackLocation(message = null) {
    const fallback = DEFAULT_USER_LOCATION;
    // We intentionally do NOT set this.userLocation to fallback so that we don't render a false blue dot.

    // Instead of forcing the map to the fallback location, we do nothing and let renderMarkers()
    // automatically fitBounds() to the available donations!

    if (message) {
      console.log("Location fallback:", message);
    }

    return fallback;
  },

  renderUserLocationMarker() {
    if (!this.map || !this.userLocation) return;

    const latLng = [this.userLocation.lat, this.userLocation.lng];
    if (this.userLocationMarker) {
      this.userLocationMarker.setLatLng(latLng);
      return;
    }

    const isFallback =
      this.userLocation.lat === DEFAULT_USER_LOCATION.lat &&
      this.userLocation.lng === DEFAULT_USER_LOCATION.lng;
    const popupText = isFallback
      ? "Default location (Bangalore)"
      : "Your location";

    this.userLocationMarker = L.circleMarker(latLng, {
      radius: 7,
      color: "#2563eb",
      fillColor: "#3b82f6",
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(this.map)
      .bindPopup(popupText);
  },

  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  setMapInteractivity(enabled) {
    if (!this.map) return;
    this.interactionEnabled = Boolean(enabled);

    if (this.map.dragging) {
      this.interactionEnabled
        ? this.map.dragging.enable()
        : this.map.dragging.disable();
    }
    if (this.map.touchZoom) {
      this.interactionEnabled
        ? this.map.touchZoom.enable()
        : this.map.touchZoom.disable();
    }
    if (this.map.doubleClickZoom) {
      this.interactionEnabled
        ? this.map.doubleClickZoom.enable()
        : this.map.doubleClickZoom.disable();
    }
    if (this.map.scrollWheelZoom) {
      this.interactionEnabled
        ? this.map.scrollWheelZoom.enable()
        : this.map.scrollWheelZoom.disable();
    }
    if (this.map.boxZoom) {
      this.interactionEnabled
        ? this.map.boxZoom.enable()
        : this.map.boxZoom.disable();
    }
    if (this.map.keyboard) {
      this.interactionEnabled
        ? this.map.keyboard.enable()
        : this.map.keyboard.disable();
    }
    if (this.map.tap) {
      this.interactionEnabled ? this.map.tap.enable() : this.map.tap.disable();
    }

    this.updateInteractionButton();
  },

  toggleInteraction() {
    this.setMapInteractivity(!this.interactionEnabled);
  },

  updateInteractionButton() {
    const interactionBtn = document.getElementById("interactionToggleBtn");
    const statusLabel = document.getElementById("mapInteractionStatus");
    if (!interactionBtn) return;

    const icon = interactionBtn.querySelector("i");
    // Avoid targeting the icon wrapper in dashboard view
    let text = interactionBtn.querySelector("span.text") || interactionBtn.querySelector("span.hidden") || Array.from(interactionBtn.querySelectorAll("span")).find(s => !s.classList.contains("icon"));

    if (this.interactionEnabled) {
      interactionBtn.setAttribute("title", "Lock map interaction");
      interactionBtn.classList.add("text-emerald-600", "active");
      if (icon) {
        icon.className = "fas fa-lock-open";
      }
      if (text) {
        text.textContent = "Lock Map";
      }
      if (statusLabel) {
        statusLabel.innerHTML =
          '<i class="fas fa-lock-open text-emerald-500 text-xs mr-1"></i> Map interactive';
      }
      return;
    }

    interactionBtn.setAttribute("title", "Enable map interaction");
    interactionBtn.classList.remove("text-emerald-600", "active");
    if (icon) {
      icon.className = "fas fa-lock";
    }
    if (text) {
      text.textContent = "Enable Map";
    }
    if (statusLabel) {
      statusLabel.innerHTML =
        '<i class="fas fa-lock text-gray-500 text-xs mr-1"></i> Map locked';
    }
  },

  startAutoRefresh() {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }

    this.refreshTimer = window.setInterval(() => {
      this.refreshData({ forceFit: false });
    }, MAP_REFRESH_INTERVAL_MS);
  },

  async refreshData(options = {}) {
    const forceFit = options.forceFit === true;
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;

    if (!navigator.onLine) {
      this.showMapError("Map unavailable — offline mode active");
      this.setMapInteractivity(false);
      this.refreshInFlight = false;
      return;
    }

    try {
      this.donations = await this.fetchDonationsForRole();
      document.getElementById("mapStateOverlay")?.remove();
      this.updateHeroMetrics();
      this.renderMarkers({ forceFit });
      this.updateLastUpdated();

      // Re-enable interactivity if it was disabled due to offline
      if (!this.interactionEnabled) {
        this.setMapInteractivity(true);
      }
    } catch (error) {
      console.error("Map load error:", error);

      if (!navigator.onLine || error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        this.showMapError("Map unavailable — offline mode active");
        this.setMapInteractivity(false);
      } else {
        this.showAlert("Unable to load map data right now.", "error");
      }
    } finally {
      this.refreshInFlight = false;
    }
  },

  extractDonationCollection(response) {
    if (Array.isArray(response?.data?.donations))
      return response.data.donations;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.donations)) return response.donations;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response)) return response;
    return [];
  },

  async fetchPublicDonations(limit = 300) {
    const response = await donationService.getPublicMap({ limit });
    return this.extractDonationCollection(response);
  },

  async fetchDonationsForRole() {
    let publicDonations = [];
    try {
      publicDonations = await this.fetchPublicDonations(300);
    } catch (e) {
      console.warn("Failed to fetch public donations", e);
    }

    if (this.role === "public") {
      return publicDonations;
    }

    try {
      let roleDonations = [];
      if (this.role === "volunteer") {
        const response = await donationService.getVolunteerAvailable();
        if (!response && this.isAuthenticated()) {
          throw new Error("Authenticated volunteer map request did not return role data.");
        }
        roleDonations = this.extractDonationCollection(response);
      } else if (this.role === "ngo") {
        const [claimableResponse, ownResponse] = await Promise.all([
          donationService.getNgoAvailable(),
          donationService.getAll({ limit: 300 }),
        ]);
        if ((!claimableResponse || !ownResponse) && this.isAuthenticated()) {
          throw new Error("Authenticated NGO map request did not return role data.");
        }
        roleDonations = [
          ...this.extractDonationCollection(claimableResponse),
          ...this.extractDonationCollection(ownResponse),
        ];
      } else {
        const response = await donationService.getAll({ limit: 300 });
        if (!response && this.isAuthenticated()) {
          throw new Error("Authenticated map request did not return role data.");
        }
        roleDonations = this.extractDonationCollection(response);
      }

      const merged = new Map();
      publicDonations.forEach((donation) => {
        const id = this.getDonationId(donation);
        if (id) merged.set(id, donation);
      });
      roleDonations.forEach((donation) => {
        const id = this.getDonationId(donation);
        if (id) merged.set(id, donation);
      });

      return Array.from(merged.values());
    } catch (error) {
      const errorMessage = String(error?.message || "").toLowerCase();
      const isAccessError =
        error?.status === 401 ||
        error?.status === 403 ||
        errorMessage.includes("not authorized") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("forbidden") ||
        errorMessage.includes("access");

      if (!isAccessError) {
        throw error;
      }

      if (this.isAuthenticated()) {
        this.showAlert(
          "Your session cannot access this role-based map data. Please log in again.",
          "error",
        );
        throw error;
      }

      console.warn(
        "Guest role-scoped map fetch failed. Falling back to public feed:",
        error?.message || error,
      );
      return this.fetchPublicDonations(300);
    }
  },

  getDonationId(donation) {
    return String(donation?._id || donation?.id || "");
  },

  isDonationAssigned(donation) {
    return Boolean(donation?.assignedVolunteer || donation?.assigned_volunteer);
  },

  getFilteredDonations() {
    let filtered = this.donations;

    if (this.role === "volunteer" && this.urgencyFilter !== "all") {
      filtered = filtered.filter((donation) => {
        const score = Number(donation?.priorityScore) || 0;
        const bucket = getPriorityMeta(score).bucket;
        return bucket === this.urgencyFilter;
      });
    }

    if (this.radiusFilterKm !== "all" && this.userLocation) {
      const maxRadius = Number(this.radiusFilterKm);
      if (Number.isFinite(maxRadius) && maxRadius > 0) {
        filtered = filtered.filter((donation, index) => {
          const location = this.resolveDonationLocation(donation, index);
          if (!location) return false;

          const distance = this.calculateDistanceKm(
            this.userLocation.lat,
            this.userLocation.lng,
            location.lat,
            location.lng,
          );
          return distance <= maxRadius;
        });
      }
    }

    if (this.searchQuery) {
      filtered = filtered.filter((donation) =>
        this.matchesSearchQuery(donation),
      );
    }

    return filtered;
  },

  matchesSearchQuery(donation) {
    const query = this.searchQuery;
    if (!query) return true;

    const foodName = String(donation?.foodItems?.[0]?.name || "").toLowerCase();
    const city = String(donation?.pickupAddress?.city || "").toLowerCase();
    const donorName = String(
      donation?.donor?.organization?.name ||
        `${donation?.donor?.firstName || ""} ${donation?.donor?.lastName || ""}`,
    )
      .trim()
      .toLowerCase();

    return (
      foodName.includes(query) ||
      city.includes(query) ||
      donorName.includes(query)
    );
  },

  createDonationMarkerIcon(priority, isSelected = false) {
    const color = priority.markerColor || priority.color || "#10b981";
    const size = isSelected ? 24 : 18;
    const borderSize = isSelected ? 3 : 2;
    const shadow = isSelected
      ? `0 0 0 4px ${color}44, 0 4px 12px rgba(15, 23, 42, 0.4)`
      : "0 2px 7px rgba(15, 23, 42, 0.38)";

    return L.divIcon({
      className: "map-donation-icon map-donation-hitbox",
      html: `<span class="map-donation-dot${isSelected ? " is-selected" : ""}" style="--marker-color:${color};--marker-size:${size}px;--marker-border:${borderSize}px;--marker-shadow:${shadow}"></span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -14],
    });
  },

  spreadCollocatedLocation(location, occurrence) {
    if (occurrence === 0) return location;
    const ringIndex = occurrence - 1;
    const pointsPerRing = 8;
    const ring = Math.floor(ringIndex / pointsPerRing) + 1;
    const position = ringIndex % pointsPerRing;
    const angle = (position / pointsPerRing) * Math.PI * 2;
    const radiusMeters = 90 * ring;
    const latOffset = (radiusMeters / 111320) * Math.sin(angle);
    const lngScale = Math.max(Math.cos((location.lat * Math.PI) / 180), 0.2);
    const lngOffset = (radiusMeters / (111320 * lngScale)) * Math.cos(angle);
    return { lat: location.lat + latOffset, lng: location.lng + lngOffset };
  },
  createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const toneColor = count >= 15 ? "#ef4444" : count >= 7 ? "#f59e0b" : "#10b981";

    return L.divIcon({
      className: "map-cluster-shell",
      html: `
        <div style="
          width: 38px;
          height: 38px;
          background-color: ${toneColor};
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          border: 3px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        ">
          ${count}
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  },

  renderMarkers(options = {}) {
    const forceFit = options.forceFit === true;
    this.clearMarkers();

    const visibleDonations = this.getFilteredDonations();
    this.updateVisibleCount(visibleDonations.length);
    const bounds = [];
    const heatPoints = [];
    const coordinateOccurrences = new Map();

    visibleDonations.forEach((donation, index) => {
      const sourceLocation = this.resolveDonationLocation(donation, index);
      if (!sourceLocation) return;
      const coordinateKey = `${sourceLocation.lat.toFixed(5)},${sourceLocation.lng.toFixed(5)}`;
      const occurrence = coordinateOccurrences.get(coordinateKey) || 0;
      coordinateOccurrences.set(coordinateKey, occurrence + 1);
      const location = this.spreadCollocatedLocation(sourceLocation, occurrence);

      const donationId = this.getDonationId(donation);
      const score = Number(donation?.priorityScore) || 0;
      const priority = getPriorityMeta(score);
      const marker = L.marker([location.lat, location.lng], {
        icon: this.createDonationMarkerIcon(
          priority,
          donationId === this.selectedDonationId,
        ),
        keyboard: true,
        interactive: true,
        bubblingMouseEvents: false,
        pane: "donationMarkerPane",
      });

      marker.bindPopup(this.buildPopupHtml(donation), {
        className: "custom-popup",
      });

      marker.on("click", () => {
        if (donationId) {
          this.selectedDonationId = donationId;
        }
        this.openDetailDrawer(donation);
      });

      this.markerLayer.addLayer(marker);
      const intensity = Math.max(0.2, Math.min(1, (score || 20) / 100));
      heatPoints.push([sourceLocation.lat, sourceLocation.lng, intensity]);
      this.markers.push(marker);
      bounds.push([location.lat, location.lng]);
    });

    if (this.selectedDonationId) {
      const activeDonation = visibleDonations.find(
        (donation) => this.getDonationId(donation) === this.selectedDonationId,
      );
      if (activeDonation) {
        this.openDetailDrawer(activeDonation);
      } else {
        this.closeDetailDrawer();
      }
    }

    this.renderHeatmapLayer(heatPoints);

    if (bounds.length) {
      if (forceFit || !this.hasAutoFitted) {
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        this.hasAutoFitted = true;
      }
    } else if (forceFit || !this.hasAutoFitted) {
      this.map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      this.hasAutoFitted = true;
    }
  },

  updateVisibleCount(count) {
    const countEl = document.getElementById("visibleDonationsCount");
    if (!countEl) return;
    countEl.textContent = `${count} visible`;
  },

  updateHeroMetrics() {
    const districtEl = document.getElementById("heroDistrictCount");
    const activeEl = document.getElementById("heroActiveCount");
    const districtListEl = document.getElementById("districtListContainer");

    const districtStats = new Map();
    let pending = 0,
      inTransit = 0,
      delivered = 0,
      totalMeals = 0;

    this.donations.forEach((donation) => {
      const cityName = String(donation?.pickupAddress?.city || "Unknown");
      const cityKey = cityName.trim().toLowerCase();

      const status = String(donation?.status || "").toLowerCase();
      const quantity = Number(donation?.availableQuantity) || Number(donation?.quantity) || 0;
      const servings = Number(donation?.estimatedServings) || quantity;

      if (!districtStats.has(cityKey)) {
        districtStats.set(cityKey, { name: cityName, count: 0, meals: 0 });
      }
      const d = districtStats.get(cityKey);
      d.count++;
      d.meals += servings;

      if (["pending", "broadcasted", "claimed"].includes(status)) {
        pending++;
      } else if (["accepted", "picked_up", "in_transit"].includes(status)) {
        inTransit++;
      } else if (["delivered", "completed", "closed"].includes(status)) {
        delivered++;
      }
      totalMeals += servings;
    });

    if (districtEl) {
      districtEl.innerHTML = `<i class="fas fa-map-marker-alt mr-2"></i>${districtStats.size || 0} Districts`;
    }

    if (activeEl) {
      activeEl.innerHTML = `<i class="fas fa-bolt mr-2"></i>${pending} Live Donations`;
    }

    // Update Community Contributions (Stat Cards)
    const statCards = document.querySelectorAll(".stat-value");
    if (statCards && statCards.length >= 4) {
      statCards[0].textContent = (1248 + pending).toLocaleString();
      statCards[1].textContent = (856 + inTransit).toLocaleString();
      statCards[2].textContent = (45210 + totalMeals).toLocaleString();
      statCards[3].textContent = (12840 + delivered).toLocaleString();
    }

    // Update Active Districts Sidebar
    if (districtListEl) {
      if (districtStats.size === 0) {
        districtListEl.innerHTML = `
          <div class="text-center py-8 text-gray-500 text-sm">
            <i class="fas fa-map-marked-alt text-2xl mb-2 block opacity-20"></i>
            No active operations in districts yet.
          </div>
        `;
      } else {
        const sortedDistricts = Array.from(districtStats.values()).sort((a, b) => b.count - a.count);
        districtListEl.innerHTML = sortedDistricts.slice(0, 8).map(d => `
          <div class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span class="text-xs font-bold text-emerald-700">${d.name.substring(0, 3).toUpperCase()}</span>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">${this.escapeHtml(d.name)}</p>
                <p class="text-xs text-gray-500">${d.count} donation${d.count > 1 ? 's' : ''}</p>
              </div>
            </div>
            <span class="text-xs font-medium text-emerald-700">${d.meals} meal${d.meals > 1 ? 's' : ''}</span>
          </div>
        `).join("");
      }
    }
  },

  renderHeatmapLayer(points = []) {
    if (!this.map) return;

    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    if (!this.heatmapEnabled) return;
    if (typeof L.heatLayer !== "function") return;
    if (!points.length) return;

    this.heatLayer = L.heatLayer(points, {
      pane: "donationHeatPane",
      radius: 25,
      blur: 18,
      minOpacity: 0.35,
      maxZoom: 14,
      gradient: {
        0.3: "#22c55e",
        0.6: "#059669",
        1.0: "#ef4444",
      },
    }).addTo(this.map);
  },

  toggleHeatmap() {
    this.heatmapEnabled = !this.heatmapEnabled;
    this.updateHeatmapButton();
    this.renderMarkers({ forceFit: false });
  },

  updateHeatmapButton() {
    const btn = document.getElementById("heatmapToggleBtn");
    if (!btn) return;

    const icon = btn.querySelector("i");
    let text = btn.querySelector("span.text") || btn.querySelector("span.hidden") || Array.from(btn.querySelectorAll("span")).find(s => !s.classList.contains("icon"));

    if (this.heatmapEnabled) {
      btn.classList.add("text-emerald-600", "active");
      btn.setAttribute("title", "Disable heatmap");
      if (icon) {
        icon.className = "fas fa-fire-flame-curved";
      }
      if (text) {
        text.textContent = "Heatmap On";
      }
      return;
    }

    btn.classList.remove("text-emerald-600", "active");
    btn.setAttribute("title", "Enable heatmap");
    if (icon) {
      icon.className = "fas fa-fire";
    }
    if (text) {
      text.textContent = "Heatmap Off";
    }
  },

  buildPopupHtml(donation) {
    const donationId = this.getDonationId(donation);
    const foodName = this.escapeHtml(donation?.foodItems?.[0]?.name || "Food Donation");
    const city = donation?.pickupAddress?.city || donation?.city || "Unknown city";
    const street = donation?.pickupAddress?.street || donation?.pickupAddress?.address || donation?.address || "";
    const shortAddress = street ? `${street}, ${city}` : city;
    const status = this.escapeHtml(this.formatStatus(donation?.status || "pending"));
    const score = Number(donation?.priorityScore) || 0;
    const priority = getPriorityMeta(score);
    const donorName = this.escapeHtml(
      donation?.donor?.organization?.name ||
        donation?.donorName ||
        `${donation?.donor?.firstName || ""} ${donation?.donor?.lastName || ""}`.trim() ||
        "Anonymous",
    );

    const location = this.resolveDonationLocation(donation, 0);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

    return `
      <div class="map-popup ${priority.className}">
        <div class="map-popup-content">
          <h4 class="map-popup-title">${foodName}</h4>
          <p class="map-popup-meta"><i class="fas fa-building"></i> ${donorName}</p>
          <p class="map-popup-meta"><i class="fas fa-location-dot"></i> ${this.escapeHtml(shortAddress)}</p>
          <div class="map-popup-stats">
            <strong style="color: ${priority.color}; border-left: 3px solid ${priority.color}; padding-left: 6px; font-size: 13px; line-height: 1;">${priority.label}</strong>
            <span class="map-popup-badge status">${status}</span>
          </div>
        </div>
        <div class="map-popup-actions">
          <a href="${googleMapsUrl}" target="_blank" class="map-action-link">
            <i class="fas fa-directions"></i> Maps
          </a>
          <button data-map-action="openDetail" data-donation-id="${donationId}" class="map-action-btn" type="button">
            Details
          </button>
        </div>
      </div>
    `;
  },

  openDetailDrawerByDonationId(donationId) {
    const donation = this.donations.find(d => this.getDonationId(d) === donationId);
    if (donation) {
      this.openDetailDrawer(donation);
    }
  },

  buildDetailHtml(donation) {
    const donationId = this.getDonationId(donation);
    const foodName = this.escapeHtml(donation?.foodItems?.[0]?.itemName || donation?.items?.[0]?.itemName || donation?.foodItems?.[0]?.name || "Food Donation");
    const city = this.escapeHtml(donation?.pickupAddress?.city || donation?.city || "Unknown city");
    const status = this.formatStatus(donation?.status || "pending");
    const score = Number(donation?.priorityScore) || 0;
    const priority = getPriorityMeta(score);
    const donorName = this.escapeHtml(
      donation?.donor?.organization?.name ||
        donation?.donorName ||
        `${donation?.donor?.firstName || ""} ${donation?.donor?.lastName || ""}`.trim() ||
        "Anonymous",
    );

    // Image URL
    let imageUrl = donation?.image || donation?.imageUrl || "";
    if (!imageUrl) {
      const itemsArr = donation?.foodItems || donation?.items;
      if (itemsArr && itemsArr.length > 0 && itemsArr[0].image) {
        imageUrl = itemsArr[0].image;
      }
    }

    const street = donation?.pickupAddress?.street || donation?.pickupAddress?.address || donation?.address || "";
    const zipCode = donation?.pickupAddress?.zipCode || donation?.pickupAddress?.zip_code || "";
    const state = donation?.pickupAddress?.state || "";
    const fullAddress = [street, city, state, zipCode].filter(Boolean).join(", ") || city;

    const quantity = Number(donation?.availableQuantity) || Number(donation?.quantity) || 0;
    const servings = Number(donation?.estimatedServings) || quantity;
    const impact = servings > 0 ? `${servings} estimated servings` : "Unknown impact";

    const notes = this.escapeHtml(donation?.notes || donation?.donorNotes || "No additional notes");

    const actionButton = this.getDrawerActionButton(donation, donationId);

    // Build image section
    let imageSection = "";
    if (imageUrl) {
      imageSection = `
        <div style="margin: 16px 0;">
          <img src="${this.escapeHtml(imageUrl)}" alt="Donation photo"
            style="width: 100%; height: 220px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
            class="zoomable-img cursor-pointer" data-zoom-url="${this.escapeHtml(imageUrl)}" />
        </div>
      `;
    }

    return `
      <div style="padding: 4px;">
        <div style="border-left: 4px solid ${priority.color}; padding-left: 12px; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #111827;">${foodName}</h3>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280; font-weight: 500;">${donorName}</p>
        </div>

        ${imageSection}

        <div style="margin-top: 24px; padding: 0 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 14px;">
            <span style="color: #9ca3af; font-weight: 500;">Priority</span>
            <strong style="color: ${priority.color}; border-left: 3px solid ${priority.color}; padding-left: 8px;">${priority.label}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 16px;">
            <span style="color: #9ca3af; font-weight: 500;">Status</span>
            <strong style="color: #111827;">${status}</strong>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; margin-bottom: 16px;">
            <span style="color: #9ca3af; font-weight: 500;">Full Address</span>
            <strong style="color: #111827; line-height: 1.4;">${fullAddress}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 16px;">
            <span style="color: #9ca3af; font-weight: 500;">Impact</span>
            <strong style="color: #111827;">${impact}</strong>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; margin-bottom: 24px;">
            <span style="color: #9ca3af; font-weight: 500;">Donor Notes</span>
            <strong style="color: #111827; line-height: 1.4;">${notes}</strong>
          </div>
        </div>

        ${actionButton ? `<div class="map-detail-actions" style="margin-top: 16px;">${actionButton}</div>` : ''}
      </div>
    `;
  },


  getPopupActionButton(donation, donationId) {
    const action = this.getActionDescriptor(donation, donationId);
    if (!action) return "";

    return `
      <button class="map-popup-action" type="button" data-map-action="${action.name}" data-donation-id="${donationId}" data-status="${action.status || ""}">
        ${action.label}
      </button>
    `;
  },

  getActionDescriptor(donation, donationId) {
    if (!donationId) return null;

    const status = String(donation?.status || "").toLowerCase();
    const isAssigned = this.isDonationAssigned(donation);

    if (this.role === "volunteer") {
      if (status === "claimed" && !isAssigned) {
        return {
          name: "acceptPickup",
          label: "Accept Pickup",
        };
      }
      if (status === "accepted") {
        return {
          name: "markPickedUp",
          label: "Mark Picked Up",
        };
      }
      if (status === "picked_up" || status === "in_transit") {
        return {
          name: "markDelivered",
          label: "Mark Delivered",
        };
      }
    }

    if (this.role === "ngo") {
      if (status === "pending" || status === "broadcasted") {
        return {
          name: "claimDonation",
          label: "Claim Donation",
        };
      }
      if (status === "delivered" && donation?.claimedBy) {
        return {
          name: "confirmReceipt",
          label: "Confirm Receipt",
        };
      }
    }

    if (this.role === "admin") {
      if (status === "pending" || status === "broadcasted" || status === "claimed") {
        return {
          name: "adminCancelDonation",
          label: "Cancel Donation",
        };
      }
      if (status === "accepted") {
        return {
          name: "adminMarkPickedUp",
          label: "Mark Picked Up",
        };
      }
      if (status === "picked_up" || status === "in_transit") {
        return {
          name: "adminMarkDelivered",
          label: "Mark Delivered",
        };
      }
      if (status === "delivered" || status === "closed") {
        return {
          name: "adminCloseDonation",
          status,
          label: status === "delivered" ? "Close Donation" : "Complete Donation",
        };
      }
    }

    return null;
  },

  getDrawerActionButton(donation, donationId) {
    const action = this.getActionDescriptor(donation, donationId);
    if (!action) return "";

    return `
      <button class="map-detail-action" type="button" data-map-action="${action.name}" data-donation-id="${donationId}" data-status="${action.status || ""}">
        ${action.label}
        <i class="fas fa-arrow-right"></i>
      </button>
    `;
  },

  openDetailDrawer(donation) {
    if (!this.detailDrawerEl || !this.detailContentEl || !donation) return;

    const donationId = this.getDonationId(donation);
    if (donationId) {
      this.selectedDonationId = donationId;
    }

    this.detailContentEl.innerHTML = this.buildDetailHtml(donation);
    this.detailDrawerEl.classList.add("is-open");
    this.detailDrawerEl.setAttribute("aria-hidden", "false");
  },

  closeDetailDrawer() {
    this.selectedDonationId = "";
    if (!this.detailDrawerEl || !this.detailContentEl) return;

    this.detailDrawerEl.classList.remove("is-open");
    this.detailDrawerEl.setAttribute("aria-hidden", "true");
    this.detailContentEl.innerHTML =
      '<p class="map-detail-empty">Select a marker to view donation details.</p>';
  },

  isDetailDrawerOpen() {
    return this.detailDrawerEl?.classList.contains("is-open") === true;
  },

  resolveDonationLocation(donation, index) {
    const pickupAddress = donation?.pickupAddress || {};
    const coordinate = pickupAddress?.coordinates || {};
    const geoCoordinates = Array.isArray(pickupAddress?.location?.coordinates)
      ? pickupAddress.location.coordinates
      : [];

    const geoLng = Number(geoCoordinates[0]);
    const geoLat = Number(geoCoordinates[1]);
    if (Number.isFinite(geoLat) && Number.isFinite(geoLng) && (geoLat !== 0 || geoLng !== 0)) {
      return { lat: geoLat, lng: geoLng };
    }

    const lat = Number(
      donation?.lat ?? coordinate?.lat ?? pickupAddress?.latitude ?? pickupAddress?.lat,
    );
    const lng = Number(
      donation?.lng ??
        coordinate?.lng ??
        pickupAddress?.longitude ??
        pickupAddress?.lon ??
        pickupAddress?.lng,
    );

    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { lat, lng };
    }

    const cityKey = this.normalizeCity(donation?.city || pickupAddress?.city);
    if (cityKey && CITY_COORDINATES[cityKey]) {
      const [cityLat, cityLng] = CITY_COORDINATES[cityKey];
      return { lat: cityLat, lng: cityLng };
    }

    const jitter = this.getJitterBySeed(
      this.getDonationId(donation) || String(index),
    );
    return {
      lat: DEFAULT_MAP_CENTER[0] + jitter.lat,
      lng: DEFAULT_MAP_CENTER[1] + jitter.lng,
    };
  },

  normalizeCity(city) {
    return String(city || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  },

  getJitterBySeed(seed) {
    const hash = String(seed)
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
      lat: ((hash % 25) - 12) / 600,
      lng: ((hash % 31) - 15) / 600,
    };
  },

  async acceptPickup(donationId) {
    if (this.role !== "volunteer") {
      this.showAlert("Only volunteer accounts can accept pickups.", "warning");
      return;
    }

    await this.runAction(async () => {
      await donationService.acceptVolunteerPickup(donationId);
    }, "Pickup accepted.");
  },

  async claimDonation(donationId) {
    if (this.role !== "ngo") {
      this.showAlert("Only NGO accounts can claim donations.", "warning");
      return;
    }

    await this.runAction(async () => {
      await donationService.claimDonation(donationId);
    }, "Donation claimed.");
  },

  async markPickedUp(donationId) {
    if (this.role !== "volunteer") {
      this.showAlert("Only volunteers can update pickup progress.", "warning");
      return;
    }
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, "picked_up");
    }, "Donation marked as picked up.");
  },

  async markDelivered(donationId) {
    if (this.role !== "volunteer") {
      this.showAlert("Only volunteers can mark deliveries.", "warning");
      return;
    }
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, "delivered");
    }, "Donation marked as delivered to NGO.");
  },

  async confirmReceipt(donationId) {
    if (this.role !== "ngo") {
      this.showAlert("Only NGOs can confirm receipt.", "warning");
      return;
    }
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, "closed");
    }, "Receipt confirmed. Handoff completed.");
  },

  async adminCancelDonation(donationId) {
    if (this.role !== "admin") {
      this.showAlert("Only admin accounts can use this override.", "warning");
      return;
    }
    if (!window.confirm("Cancel this donation for demo operations?")) return;
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, "cancelled", "Cancelled by admin from live map");
    }, "Donation cancelled.");
  },

  async adminMarkPickedUp(donationId) {
    if (this.role !== "admin") {
      this.showAlert("Only admin accounts can use this override.", "warning");
      return;
    }
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, "picked_up", "Admin updated pickup progress from live map");
    }, "Donation marked as picked up.");
  },

  async adminMarkDelivered(donationId) {
    if (this.role !== "admin") {
      this.showAlert("Only admin accounts can use this override.", "warning");
      return;
    }
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, "delivered", "Admin marked delivery complete from live map");
    }, "Donation marked as delivered.");
  },

  async adminCloseDonation(donationId, currentStatus = "delivered") {
    if (this.role !== "admin") {
      this.showAlert("Only admin accounts can use this override.", "warning");
      return;
    }
    const nextStatus = currentStatus === "closed" ? "completed" : "closed";
    await this.runAction(async () => {
      await donationService.updateStatus(donationId, nextStatus, "Admin closed donation from live map");
    }, nextStatus === "completed" ? "Donation completed." : "Donation closed.");
  },

  async runAction(action, successMessage) {
    if (!this.isAuthenticated()) {
      sessionStorage.setItem("redirectAfterLogin", window.location.href);
      this.showAlert(
        "Please log in with your account to perform this action.",
        "info",
      );
      window.setTimeout(() => {
        window.location.href = "../pages/login.html";
      }, 450);
      return;
    }

    if (this.actionInFlight) return;

    this.actionInFlight = true;

    try {
      await action();
      this.showAlert(successMessage, "success");
      await this.refreshData({ forceFit: true });
    } catch (error) {
      console.error("Map action failed:", error);
      this.showAlert(error.message || "Action failed.", "error");
    } finally {
      this.actionInFlight = false;
    }
  },

  clearMarkers() {
    if (
      this.markerLayer &&
      typeof this.markerLayer.clearLayers === "function"
    ) {
      this.markerLayer.clearLayers();
    } else {
      this.markers.forEach((marker) => {
        this.markerLayer.removeLayer(marker);
      });
    }
    this.markers = [];
  },

  destroy() {
    if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    if (this._socketOfflineTimer) window.clearTimeout(this._socketOfflineTimer);
    if (this._actionClickHandler) document.removeEventListener("click", this._actionClickHandler);
    if (this._escapeHandler) document.removeEventListener("keydown", this._escapeHandler);
    if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
    if (this.socket) {
      if (this._onSocketConnect) this.socket.off("connect", this._onSocketConnect);
      if (this._onSocketError) this.socket.off("connect_error", this._onSocketError);
      if (this._onSocketDisconnect) this.socket.off("disconnect", this._onSocketDisconnect);
      if (this._refreshFromSocket) {
        this.socket.off("newDonation", this._refreshFromSocket);
        this.socket.off("donationStatusUpdated", this._refreshFromSocket);
        this.socket.off("donationClaimed", this._refreshFromSocket);
      }
    }
    if (this.map) this.map.remove();
    this.map = null;
    this.markerLayer = null;
    this.markers = [];
    this.refreshTimer = null;
    this.refreshInFlight = false;
    this.actionDelegationBound = false;
    this._actionClickHandler = null;
    document.body.classList.remove("map-expanded");
  },

  setupExpandButton() {
    const expandBtn = document.getElementById("expandMapBtn");
    const mapWrapper = document.getElementById("mapWrapper");
    const mapOverlay = document.getElementById("mapOverlay");

    this.syncNavOffset();
    if (mapWrapper) {
      mapWrapper.classList.remove("expanded");
    }
    mapOverlay?.classList.add("hidden");
    document.body.classList.remove("map-expanded");

    expandBtn?.addEventListener("click", () => this.toggleExpand());
    mapOverlay?.addEventListener("click", () => {
      if (this.isExpanded) this.toggleExpand();
    });

    this._escapeHandler = (event) => {
      if (event.key !== "Escape") return;

      if (this.isDetailDrawerOpen()) {
        this.closeDetailDrawer();
        return;
      }

      if (this.isExpanded) {
        this.toggleExpand();
      }
    };
    document.addEventListener("keydown", this._escapeHandler);

    this._resizeHandler = () => {
      this.syncNavOffset();
      this.map?.invalidateSize();
    };
    window.addEventListener("resize", this._resizeHandler);
  },

  toggleExpand() {
    const mapWrapper = document.getElementById("mapWrapper");
    const mapOverlay = document.getElementById("mapOverlay");
    const expandBtn = document.getElementById("expandMapBtn");
    const expandIcon = expandBtn?.querySelector("i");

    if (!mapWrapper) return;

    this.syncNavOffset();
    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      mapWrapper.classList.add("expanded");
      mapOverlay?.classList.remove("hidden");
      document.body.classList.add("map-expanded");
      if (expandIcon) {
        expandIcon.classList.remove("fa-expand");
        expandIcon.classList.add("fa-compress");
      }
      expandBtn?.setAttribute("title", "Collapse Map");
    } else {
      mapWrapper.classList.remove("expanded");
      mapOverlay?.classList.add("hidden");
      document.body.classList.remove("map-expanded");
      if (expandIcon) {
        expandIcon.classList.remove("fa-compress");
        expandIcon.classList.add("fa-expand");
      }
      expandBtn?.setAttribute("title", "Expand Map");
    }

    setTimeout(() => {
      this.map.invalidateSize();
    }, 280);
  },

  resetView() {
    if (!this.map) return;
    this.hasAutoFitted = false;
    if (this.userLocation) {
      this.map.setView([this.userLocation.lat, this.userLocation.lng], 11);
      return;
    }
    this.map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  },

  locateUser() {
    this.bootstrapUserLocation({
      recenter: true,
      showMarker: true,
      notifyOnError: true,
    }).then((location) => {
      // If it returned the fallback location, it means geolocation failed or was denied.
      if (location && location.lat === DEFAULT_USER_LOCATION.lat && location.lng === DEFAULT_USER_LOCATION.lng) {
         this.showAlert("Please enable location permissions in your browser settings to use My Location.", "warning");
      }
      this.renderMarkers({ forceFit: false });
    }).catch((err) => {
      console.warn("locateUser failed:", err);
      this.showAlert("Unable to access location.", "error");
    });
  },

  updateLastUpdated() {
    const label = document.getElementById("mapLastUpdated");
    if (!label) return;

    const now = new Date();
    label.textContent = `Last updated: ${now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  },

  syncNavOffset() {
    const navbar = document.getElementById("navbar");
    const navHeight = navbar?.offsetHeight || 64;
    document.documentElement.style.setProperty(
      "--live-map-nav-height",
      `${navHeight}px`,
    );
  },

  formatStatus(status) {
    return String(status || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  },

  formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  },

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
};

document.addEventListener("DOMContentLoaded", () => {
  // Only auto-init on standalone map pages (e.g., live-map.html).
  // The unified dashboard initializes MapModule via Map.js afterRender(),
  // which passes notifyOnError: false to suppress geolocation alerts.
  const isDashboard = document.querySelector(".dashboard-app") || document.getElementById("app");
  if (!isDashboard && document.getElementById("map")) {
    MapModule.init();
  }
});

window.MapModule = MapModule;
