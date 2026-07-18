const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");

let logs = [];

// 1. Finalize Utils: Move frontend/services to frontend/utils
// (The user asked to move API client wrappers to utils)
const servicesDir = path.join(frontendDir, "services");
const utilsDir = path.join(frontendDir, "utils");

if (fs.existsSync(servicesDir)) {
  const files = fs.readdirSync(servicesDir);
  files.forEach((file) => {
    const src = path.join(servicesDir, file);
    const dest = path.join(utilsDir, file);
    fs.renameSync(src, dest);
    logs.push(`Moved services/${file} to utils/${file}`);
  });
}

// 2. Link Normalization: find all href="login.html" and rewrite
const replaceInFiles = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const currentPath = path.join(dir, file);
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      if (currentPath !== path.join(projectRoot, "node_modules")) {
        replaceInFiles(currentPath);
      }
    } else if ([".html", ".js"].includes(path.extname(currentPath))) {
      let content = fs.readFileSync(currentPath, "utf8");
      let updated = content;

      // Adjust basic auth and generic html links
      // e.g. href="login.html" -> href="login.html" is actually already within pages/ if we moved it.
      // Wait, if an html file in pages/ refers to href="about.html", since both are in pages/, the link is still valid!
      // If the root index.html refers to "pages/about.html" it's valid.
      // If an old component refers to "auth/login.html" we change it to "pages/login.html".
      updated = updated.replace(
        /href=(['"])auth\/login\.html(['"])/g,
        "href=$1pages/login.html$2",
      );
      updated = updated.replace(
        /href=(['"])dashboard-unified\/index\.html(['"])/g,
        "href=$1pages/dashboard-unified.html$2",
      );
      updated = updated.replace(
        /href=(['"])ngo\/ngo-claims\.html(['"])/g,
        "href=$1pages/ngo-claims.html$2",
      );
      updated = updated.replace(
        /href=(['"])volunteer\/volunteer\.html(['"])/g,
        "href=$1pages/volunteer.html$2",
      );

      // Rewrite services/ path references to utils/
      updated = updated.replace(/services\/config\.js/g, "utils/config.js");
      updated = updated.replace(/(['"/]+)services\//g, "$1utils/");

      if (content !== updated) {
        fs.writeFileSync(currentPath, updated, "utf8");
        logs.push(`Updated links in ${path.basename(currentPath)}`);
      }
    }
  }
};

replaceInFiles(frontendDir);

console.log("Migration script finalize phase 2 complete.");
if (logs.length > 0) console.log(logs.join("\n"));
