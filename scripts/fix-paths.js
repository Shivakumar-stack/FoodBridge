const fs = require("fs");
const path = require("path");

const fixFile = (filePath, replacements) => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  let content = fs.readFileSync(filePath, "utf8");
  let original = content;

  replacements.forEach((r) => {
    content = content.split(r.from).join(r.to);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log("Fixed paths inside:", filePath);
  }
};

const base = path.join(process.cwd(), "frontend");

// auth
fixFile(path.join(base, "auth", "login.html"), [
  { from: '"../styles/login.css"', to: '"./login.css"' },
  { from: '"../services/login.js"', to: '"./login.js"' },
  { from: '"../auth/login.css"', to: '"./login.css"' },
  { from: '"../auth/login.js"', to: '"./login.js"' },
]);

// dashboard
fixFile(path.join(base, "dashboard", "dashboard.html"), [
  { from: '"../styles/dashboard.css"', to: '"./dashboard.css"' },
  { from: '"../services/dashboard.js"', to: '"./dashboard.js"' },
  { from: '"../services/dashboard-layout.js"', to: '"./dashboard-layout.js"' },
  { from: '"../dashboard/dashboard.css"', to: '"./dashboard.css"' },
  { from: '"../dashboard/dashboard.js"', to: '"./dashboard.js"' },
  { from: '"../dashboard/dashboard-layout.js"', to: '"./dashboard-layout.js"' },
]);

// admin
fixFile(path.join(base, "admin", "analytics.html"), [
  { from: '"../styles/admin-analytics.css"', to: '"./admin-analytics.css"' },
  { from: '"../services/analytics.js"', to: '"./analytics.js"' },
  { from: '"../services/admin-analytics.js"', to: '"./analytics.js"' },
  { from: '"../admin/admin-analytics.css"', to: '"./admin-analytics.css"' },
  { from: '"../admin/analytics.js"', to: '"./analytics.js"' },
  { from: '"../admin/admin-analytics.js"', to: '"./analytics.js"' },
]);

// volunteer
fixFile(path.join(base, "volunteer", "volunteer.html"), [
  { from: '"../styles/volunteer.css"', to: '"./volunteer.css"' },
  { from: '"../services/volunteer.js"', to: '"./volunteer.js"' },
  { from: '"../volunteer/volunteer.css"', to: '"./volunteer.css"' },
  { from: '"../volunteer/volunteer.js"', to: '"./volunteer.js"' },
]);
fixFile(path.join(base, "volunteer", "volunteer-pickups.html"), [
  {
    from: '"../styles/volunteer-pickups.css"',
    to: '"./volunteer-pickups.css"',
  },
  {
    from: '"../services/volunteer-pickups.js"',
    to: '"./volunteer-pickups.js"',
  },
  {
    from: '"../volunteer/volunteer-pickups.css"',
    to: '"./volunteer-pickups.css"',
  },
  {
    from: '"../volunteer/volunteer-pickups.js"',
    to: '"./volunteer-pickups.js"',
  },
]);

// ngo
fixFile(path.join(base, "ngo", "ngo-claims.html"), [
  { from: '"../styles/ngo-claims.css"', to: '"./ngo-claims.css"' },
  { from: '"../services/ngo-claims.js"', to: '"./ngo-claims.js"' },
  { from: '"../ngo/ngo-claims.css"', to: '"./ngo-claims.css"' },
  { from: '"../ngo/ngo-claims.js"', to: '"./ngo-claims.js"' },
]);
