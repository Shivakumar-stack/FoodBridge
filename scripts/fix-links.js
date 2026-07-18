const fs = require("fs");
const path = require("path");

const walkSync = function (dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    } else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

const pageMap = {
  "login.html": "auth",
  "signup.html": "pages",
  "dashboard.html": "dashboard",
  "admin-analytics.html": "admin",
  "analytics.html": "admin",
  "volunteer.html": "volunteer",
  "volunteer-pickups.html": "volunteer",
  "ngo-claims.html": "ngo",
  "my-donations.html": "pages",
  "volunteers.html": "pages",
  "map.html": "pages",
  "live-map.html": "pages",
  "donate.html": "pages",
  "index.html": "pages",
  "about.html": "pages",
  "how-it-works.html": "pages",
  "contact.html": "pages",
  "privacy-policy.html": "pages",
  "sitemap.html": "pages",
  "terms.html": "pages",
};

const frontendDir = path.join(process.cwd(), "frontend");
const targetFiles = walkSync(frontendDir).filter(
  (f) => f.endsWith(".html") || f.endsWith(".js"),
);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

targetFiles.forEach((file) => {
  // determine current folder name of the file
  const dirName = path.basename(path.dirname(file));
  // if it's services, styles, components it acts like pages (same level)
  let level = dirName;
  if (["services", "styles", "components", "images"].includes(dirName)) {
    level = "pages"; // assume sibling of pages for relative links calculation
  }

  let content = fs.readFileSync(file, "utf8");
  let changed = false;

  // find href="filename.html" and window.location.href = "filename.html" or redirectAfterLogin('filename.html')
  for (const [targetFile, targetFolder] of Object.entries(pageMap)) {
    // if we are in 'dashboard' and target is 'dashboard' -> just targetFile
    // if we are in 'dashboard' and target is 'pages' -> '../pages/' + targetFile
    // if we are in 'services' and target is 'dashboard' -> '../dashboard/' + targetFile

    let relativePath = "";
    if (level === targetFolder) {
      relativePath = targetFile;
    } else {
      // from folder A to folder B (e.g. from dashboard to pages)
      // since all modules auth, dashboard, admin, volunteer, ngo, pages, services are at frontend/
      // to go from frontend/dashboard to frontend/pages -> '../pages/filename'
      // wait, if we are in frontend/services/app.js to login.html -> '../auth/login.html'
      if (dirName === "frontend") continue;
      relativePath = "../" + targetFolder + "/" + targetFile;
    }

    // regex for href="filename.html"
    // match strictly "filename.html" or 'filename.html'
    const escapedTargetFile = escapeRegex(targetFile);
    const regexHref = new RegExp(`href=(["'])${escapedTargetFile}\\1`, "g");
    const newContentHref = content.replace(
      regexHref,
      "href=$1" + relativePath + "$1",
    );
    if (newContentHref !== content) {
      content = newContentHref;
      changed = true;
    }

    // regex for window.location.href = 'filename.html'
    const regexJs = new RegExp(`(["'])${escapedTargetFile}\\1`, "g");
    // be careful not to replace random strings if not in a URL context, but HTML filenames are usually safe.
    const newContentJs = content.replace(regexJs, "$1" + relativePath + "$1");
    if (newContentJs !== content) {
      content = newContentJs;
      changed = true;
    }

    // Note: the regexJs is broad -> matches 'dashboard.html' -> '../dashboard/dashboard.html'
    // this covers redirect('dashboard.html') and window.location.href = 'dashboard.html'
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log("Updated links in:", file);
  }
});
