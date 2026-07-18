const routes = {
  "/": {
    module: "dashboard_pages/Overview.js",
    title: "Dashboard Overview",
    subtitle: "Live operations, impact metrics, and recent donation flow.",
  },
  "/donations": {
    module: "dashboard_pages/Donations.js",
    title: "Donations",
    subtitle: "Monitor all submitted donations and fulfillment lifecycle.",
  },
  "/requests": {
    module: "dashboard_pages/Requests.js",
    title: "Food Requests",
    subtitle: "Track NGO demand and create requests where permitted.",
  },
  "/volunteers": {
    module: "dashboard_pages/Volunteers.js",
    title: "Volunteer Queue",
    subtitle: "Review pending pickups and current assignment readiness.",
  },
  "/reports": {
    module: "dashboard_pages/Reports.js",
    title: "System Reports",
    subtitle: "Role distribution and donation fulfillment analytics.",
  },
  "/profile": {
    module: "dashboard_pages/Profile.js",
    title: "Profile",
    subtitle: "Your account, role context, and contact information.",
  },
  "/map": {
    module: "dashboard_pages/Map.js",
    title: "Map",
    subtitle: "Geospatial view of food requests and donation points.",
  },
  "/notifications": {
    module: "dashboard_pages/Notifications.js",
    title: "Notifications",
    subtitle: "Operational updates and unread alert tracking.",
  },
  "/users": {
    module: "dashboard_pages/Users.js",
    title: "User Management",
    subtitle: "Recent user records and account role visibility.",
  },
};

const getCurrentRoute = () => {
  const hash = window.location.hash || "#/";
  let route = hash.replace(/^#/, "");

  if (!route || route === "/index.html" || route === "/index") {
    route = "/";
  }

  if (!route.startsWith("/")) {
    route = `/${route}`;
  }

  return route;
};

// Track current page instance for cleanup on navigation
let currentPage = null;

const router = async () => {
  const currentRoute = getCurrentRoute();
  const routeConfig = routes[currentRoute] || routes["/"];

  const contentEl = document.querySelector("#dashboard-content");
  if (!contentEl) return;

  // ── Lifecycle: Destroy the previous page before loading the new one ──
  // This cleans up socket listeners, timers, and event handlers from the old page
  if (currentPage && typeof currentPage.destroy === "function") {
    try {
      currentPage.destroy();
    } catch (e) {
      console.warn("[dashboard-router] page destroy() error:", e);
    }
  }
  currentPage = null;

  contentEl.innerHTML =
    '<div class="dashboard-inline-state">Loading dashboard module...</div>';

  try {
    // Appended ?v=3 to forcefully clear stale browser cache for module pages
    const pageModule = await import(`./${routeConfig.module}?v=3`);
    const page = new pageModule.default();
    currentPage = page;

    contentEl.innerHTML = "";
    contentEl.appendChild(page.render());

    if (typeof window.setDashboardPageMeta === "function") {
      window.setDashboardPageMeta(routeConfig.title, routeConfig.subtitle);
    }

    if (
      window.dashboardSidebar &&
      typeof window.dashboardSidebar.setActiveLink === "function"
    ) {
      window.dashboardSidebar.setActiveLink(currentRoute);
    }

    if (typeof page.afterRender === "function") {
      await page.afterRender();
    }
  } catch (error) {
    contentEl.innerHTML = `<div class="dashboard-inline-state dashboard-inline-error">Unable to load this module: ${error.message}</div>`;
    console.error("[dashboard-router] module load failed", error);
  }
};

window.addEventListener("hashchange", router);

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (event) => {
    const link = event.target.closest("[data-link]");
    if (!link) return;

    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;

    event.preventDefault();
    if (window.location.hash === href) {
      router();
    } else {
      window.location.hash = href;
    }
  });

  if (!window.location.hash) {
    window.location.hash = "#/";
  } else {
    router();
  }
});
