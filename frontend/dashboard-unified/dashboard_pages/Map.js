import { Icons } from "../utils.js";

/**
 * Dashboard Map Module
 * Integrates the existing Live Map system into the Unified Dashboard.
 */
export default class Map {
  constructor() {
    this.mapInitialized = false;
  }

  render() {
    const element = document.createElement("div");
    element.className = "dashboard-map-container";
    
    element.innerHTML = `
      <div class="dashboard-hero-note">
        Live tracking of food rescue operations. Volunteers can see available pickups, while NGOs can track incoming deliveries.
      </div>

      <article id="mapWrapper" class="dashboard-panel dashboard-map-panel map-wrapper no-padding">
        <div class="dashboard-map-header">
          <div class="dashboard-map-title">
            <h2 class="dashboard-panel-title">Operational Live Map</h2>
            <p class="dashboard-panel-subtitle" id="mapViewSubtitle">Loading view...</p>
          </div>

          <div class="map-dashboard-controls-row" aria-label="Map controls">
              <select id="urgencyFilter" class="dashboard-select sm dashboard-map-select">
                <option value="all">Priority: All</option>
                <option value="critical">Critical</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <select id="radiusFilter" class="dashboard-select sm dashboard-map-select">
                <option value="all">Dist: All</option>
                <option value="5">Within 5km</option>
                <option value="10">Within 10km</option>
                <option value="25">Within 25km</option>
              </select>

              <div class="dashboard-map-control-separator"></div>

              <button id="heatmapToggleBtn" class="map-ctrl-btn" type="button" title="Toggle Heatmap" aria-label="Toggle Heatmap">
                <i class="fas fa-fire"></i>
              </button>
              
              <button class="map-ctrl-btn" type="button" title="Reset View" aria-label="Reset View" data-map-action="resetView">
                <i class="fas fa-compress-arrows-alt"></i>
              </button>

              <button class="map-ctrl-btn" type="button" title="Refresh Data" aria-label="Refresh Data" data-map-action="refreshData">
                <i class="fas fa-rotate"></i>
              </button>

              <button class="map-ctrl-btn" type="button" title="My Location" aria-label="My Location" data-map-action="locateUser">
                <i class="fas fa-crosshairs"></i>
              </button>

              <button id="interactionToggleBtn" class="map-ctrl-btn" type="button" title="Toggle Interactivity" aria-label="Toggle Interactivity">
                <i class="fas fa-lock-open"></i>
              </button>
              
              <button id="expandMapBtn" class="map-ctrl-btn expand-special" type="button" title="Expand Map" aria-label="Expand Map">
                <i class="fas fa-expand"></i>
              </button>
          </div>
        </div>

        <div class="dashboard-map-body">
          <div id="mapViewport" class="dashboard-map-wrapper">
            <div id="map" class="dashboard-map-canvas"></div>

            <aside id="mapDetailDrawer" class="map-detail-drawer dashboard-version" aria-hidden="true">
              <button id="mapDetailCloseBtn" type="button" class="map-detail-close">
                ${Icons.x}
              </button>
              <div id="mapDetailContent" class="map-detail-content">
                <p class="map-detail-empty">Select a marker to view details.</p>
              </div>
            </aside>

            <div class="dashboard-map-status-wrap" class="absolute bottom-5 right-5 z-[1000] pointer-events-none">
              <div id="socketStatusIndicator" class="map-status-pill" class="pointer-events-auto bg-white/95 backdrop-blur-sm border border-gray-200 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-md flex items-center gap-1.5 text-gray-600">
                <i class="fas fa-circle-notch fa-spin text-emerald-500"></i> Connecting...
              </div>
            </div>
          </div>
        </div>
        
        <div class="dashboard-map-footer">
          <div class="dashboard-map-footer-left">
            <span class="dashboard-map-footer-item"><i class="fas fa-circle dashboard-map-live-dot"></i> Live Updates Active</span>
            <div class="dashboard-map-footer-separator"></div>
            <span id="mapInteractionStatus" class="dashboard-map-footer-item">Map interactive</span>
          </div>
          <div id="mapLastUpdated" class="dashboard-map-updated">Last updated: --</div>
        </div>
      </article>
      <div id="mapOverlay" class="map-overlay hidden" aria-hidden="true"></div>
    `;

    return element;
  }

  waitForMapModule(retries = 5, interval = 120) {
    return new Promise((resolve) => {
      const attempt = () => {
        if (window.MapModule && typeof window.MapModule.init === "function") {
          resolve(window.MapModule);
          return;
        }

        if (retries <= 0) {
          resolve(null);
          return;
        }

        retries -= 1;
        window.setTimeout(attempt, interval);
      };

      attempt();
    });
  }

  async afterRender() {
    // 1. Ensure Leaflet is loaded (it should be via script tags in dashboard-unified.html)
    if (typeof L === "undefined") {
      console.error("[DashboardMap] Leaflet not found. Waiting for load...");
      return;
    }

    const mapModule = await this.waitForMapModule();
    if (!mapModule) {
      console.warn("[DashboardMap] MapModule not found. Please ensure live-map.js is loaded.");
      return;
    }

    try {
      // Dynamic dashboard insertion needs one layout frame before Leaflet measures.
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      mapModule.init();
      this.mapInitialized = true;
      console.log("[DashboardMap] MapModule initialized successfully in dashboard.");
    } catch (error) {
      console.error("[DashboardMap] Error initializing map:", error);
    }
  }

  destroy() {
    if (this.mapInitialized && window.MapModule?.destroy) window.MapModule.destroy();
    this.mapInitialized = false;
  }
}
