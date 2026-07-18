class Sidebar {
  constructor(userRole) {
    this.userRole = userRole || "donor";
    this.sidebar = document.querySelector(".sidebar-nav");
    this.render();
    this.setActiveLink(this.getCurrentRoute());
  }

  getModules() {
    const modules = [
      {
        key: "overview",
        name: "Overview",
        route: "/",
        roles: ["donor", "ngo", "volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5M5.25 9.75V21h13.5V9.75" /></svg>',
      },
      {
        key: "donations",
        name: "Donations",
        route: "/donations",
        roles: ["donor", "ngo", "volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 7.5h15m-15 4.5h15m-15 4.5h10.5" /></svg>',
      },
      {
        key: "requests",
        name: "Requests",
        route: "/requests",
        roles: ["donor", "ngo", "volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5.25H7.5A2.25 2.25 0 005.25 7.5v9A2.25 2.25 0 007.5 18.75h9A2.25 2.25 0 0018.75 16.5V15M9 5.25a2.25 2.25 0 002.25 2.25H15a2.25 2.25 0 002.25-2.25M9 5.25A2.25 2.25 0 0111.25 3h1.5A2.25 2.25 0 0115 5.25" /></svg>',
      },
      {
        key: "volunteers",
        name: "Volunteer Queue",
        route: "/volunteers",
        roles: ["volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM15.75 18.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3.75 5.25h3l2.25 8.25h8.25l2.25-6h-12" /></svg>',
      },
      {
        key: "map",
        name: "Live Map",
        route: "/map",
        roles: ["ngo", "volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.75 3.45l-7.073-2.83a.75.75 0 00-.604 0L2.122 19.35A.75.75 0 011.05 18.66V4.412a.75.75 0 01.527-.711L8.65 1.13a.75.75 0 01.604 0l7.073 2.83a.75.75 0 01.604 0l6.945-2.778a.75.75 0 011.05.69v14.248a.75.75 0 01-.527.711L16.35 20.62a.75.75 0 01-.604 0z" /></svg>',
      },
      {
        key: "reports",
        name: "Reports",
        route: "/reports",
        roles: ["admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v16.5h16.5M7.5 14.25l3-3 2.25 2.25 4.5-4.5" /></svg>',
      },
      {
        key: "users",
        name: "Users",
        route: "/users",
        roles: ["admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.5a6 6 0 00-12 0m12 0h4.5m-4.5 0a6 6 0 0112 0M9 10.5a3 3 0 100-6 3 3 0 000 6zm9 0a3 3 0 100-6 3 3 0 000 6z" /></svg>',
      },
      {
        key: "notifications",
        name: "Notifications",
        route: "/notifications",
        roles: ["donor", "ngo", "volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 18.75a2.25 2.25 0 01-4.5 0m8.25-2.25H6.75c.75-.75 1.5-2.25 1.5-4.5a3.75 3.75 0 117.5 0c0 2.25.75 3.75 1.5 4.5z" /></svg>',
      },
      {
        key: "profile",
        name: "Profile",
        route: "/profile",
        roles: ["donor", "ngo", "volunteer", "admin"],
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" /></svg>',
      },
      {
        key: "donate-food",
        name: "Donate Food",
        route: "/donate",
        roles: ["donor", "admin"],
        externalHref: "../pages/donate.html",
        icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-6.75-4.35-9-9a5.25 5.25 0 019-5.25A5.25 5.25 0 0121 12c-2.25 4.65-9 9-9 9z" /></svg>',
      },
    ];

    return modules.filter((module) => module.roles.includes(this.userRole));
  }

  getCurrentRoute() {
    const rawHash = window.location.hash || "#/";
    const path = rawHash.replace(/^#/, "") || "/";
    if (path === "/index.html" || path === "/index") return "/";
    return path.startsWith("/") ? path : `/${path}`;
  }

  setActiveLink(route) {
    const links = this.sidebar?.querySelectorAll("[data-nav-route]") || [];
    links.forEach((link) => {
      const linkRoute = link.getAttribute("data-nav-route");
      const active = linkRoute === route;
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  render() {
    if (!this.sidebar) return;

    const modules = this.getModules();
    this.sidebar.innerHTML = modules
      .map(
        (module) => `
        <a href="${module.externalHref || `#${module.route}`}" ${module.externalHref ? "" : 'data-link'} data-nav-route="${module.route}" class="sidebar-nav-link" aria-label="${module.name}" title="${module.name}">
          ${module.icon}
          <span>${module.name}</span>
        </a>
      `,
      )
      .join("");

    // Close sidebar on mobile when a link is clicked
    const links = this.sidebar.querySelectorAll(".sidebar-nav-link");
    links.forEach(link => {
      link.addEventListener("click", () => {
        if (!window.matchMedia("(min-width: 1024px)").matches) {
          const overlay = document.getElementById("sidebar-overlay");
          if (overlay) overlay.click();
        }
      });
    });
  }
}

export default Sidebar;
