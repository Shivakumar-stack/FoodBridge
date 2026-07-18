import Sidebar from "./Sidebar.js";
import Navbar from "./Navbar.js";
import "./router.js";
import {
  ensureDashboardSession,
  getCurrentUser,
  getUserRole,
} from "./utils.js";

const app = document.querySelector("#app");

if (!ensureDashboardSession()) {
  if (app) {
    app.innerHTML = "";
  }
} else if (app) {
  const user = getCurrentUser();
  const role = getUserRole();

  window.dashboardContext = {
    user,
    role,
  };

  app.innerHTML = `
    <div class="dashboard-shell">
      <aside id="dashboard-sidebar" class="dashboard-sidebar" aria-label="Dashboard sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-logo" aria-hidden="true">
            <img src="../assets/images/logo.png" alt="FoodBridge Logo">
          </div>




          <span class="sidebar-brand-copy">
            <strong>FoodBridge</strong>
            <span>Operations Dashboard</span>
          </span>
        </div>
        <nav class="sidebar-nav" aria-label="Dashboard navigation"></nav>
      </aside>
      <div id="sidebar-overlay" class="sidebar-overlay" aria-hidden="true"></div>
      <main id="dashboard-main" class="dashboard-main">
        <div id="navbar-placeholder"></div>
        <section id="dashboard-content" class="dashboard-content" aria-live="polite"></section>
      </main>
    </div>
  `;

  const sidebar = document.getElementById("dashboard-sidebar");
  const main = document.getElementById("dashboard-main");
  const overlay = document.getElementById("sidebar-overlay");
  const desktopMedia = window.matchMedia("(min-width: 1024px)");

  let isDesktop = desktopMedia.matches;
  let sidebarOpen = isDesktop;

  const syncSidebarState = () => {
    const toggles = document.querySelectorAll("[data-sidebar-toggle]");

    if (isDesktop) {
      sidebar.classList.toggle("collapsed", !sidebarOpen);
      sidebar.classList.remove("mobile-open");
      main.classList.toggle("sidebar-collapsed", !sidebarOpen);
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
    } else {
      sidebar.classList.toggle("collapsed", !sidebarOpen);
      sidebar.classList.toggle("mobile-open", sidebarOpen);
      main.classList.add("sidebar-collapsed");
      overlay.classList.toggle("show", sidebarOpen);
      overlay.setAttribute("aria-hidden", String(!sidebarOpen));
    }

    toggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", String(sidebarOpen));
      toggle.setAttribute(
        "aria-label",
        sidebarOpen ? "Collapse sidebar" : "Expand sidebar",
      );
      const icon = toggle.querySelector("svg");
      if (icon) {
        icon.innerHTML = sidebarOpen
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />';
      }
    });
  };

  const bindToggleListeners = () => {
    document.querySelectorAll("[data-sidebar-toggle]").forEach((toggle) => {
      if (toggle.dataset.bound === "true") return;
      toggle.dataset.bound = "true";

      toggle.addEventListener("click", () => {
        sidebarOpen = !sidebarOpen;
        syncSidebarState();
      });
    });
  };

  const bindCloseListeners = () => {
    document.querySelectorAll("[data-sidebar-close]").forEach(closeBtn => {
      if (closeBtn.dataset.bound === "true") return;
      closeBtn.dataset.bound = "true";

      closeBtn.addEventListener("click", () => {
        sidebarOpen = false;
        syncSidebarState();
      });
    });
  };

  overlay.addEventListener("click", () => {
    if (!isDesktop) {
      sidebarOpen = false;
      syncSidebarState();
    }
  });

  window.addEventListener("resize", () => {
    const nextDesktop = desktopMedia.matches;
    if (nextDesktop !== isDesktop) {
      isDesktop = nextDesktop;
      sidebarOpen = isDesktop;
      syncSidebarState();
    }
  });

  window.bindDashboardSidebarToggle = bindToggleListeners;
  window.bindDashboardSidebarClose = bindCloseListeners;

  const sidebarComponent = new Sidebar(role);
  window.dashboardSidebar = sidebarComponent;

  const navbar = new Navbar(user);
  window.setDashboardPageMeta = (title, subtitle) => {
    navbar.setPageMeta(title, subtitle);
  };

  bindToggleListeners();
  bindCloseListeners();
  syncSidebarState();
}
