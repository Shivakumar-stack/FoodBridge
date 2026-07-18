const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");
const pagesDir = path.join(frontendDir, "pages");

const filesToMove = [
  {
    src: path.join(frontendDir, "auth", "login.html"),
    dest: path.join(pagesDir, "login.html"),
  },
  {
    src: path.join(frontendDir, "ngo", "ngo-claims.html"),
    dest: path.join(pagesDir, "ngo-claims.html"),
  },
  {
    src: path.join(frontendDir, "volunteer", "volunteer.html"),
    dest: path.join(pagesDir, "volunteer.html"),
  },
  {
    src: path.join(frontendDir, "dashboard-unified", "index.html"),
    dest: path.join(pagesDir, "dashboard-unified.html"),
  },
];

let filesMoved = [];

filesToMove.forEach((info) => {
  if (fs.existsSync(info.src)) {
    fs.renameSync(info.src, info.dest);
    filesMoved.push(path.basename(info.src));

    // Very basic relative path fixing for the moved file itself
    let content = fs.readFileSync(info.dest, "utf8");
    // If it was in one directory deep (like auth/), it used ../ for root.
    // Now it's in pages/, which is also one directory deep.
    // So actually, relative paths from these files might still be correct if they were parallel!
    // auth/login.html -> ../css/styles.css (if moved to pages/login.html -> still ../css/styles.css)
    // Wait, yes! Both `auth/` and `pages/` are immediate children of `frontend/`. Relative distances are identical! No rewiring in the HTML needed except if it referenced siblings.
    // If auth/login.html had `<script src="login.js"></script>`, it now needs `<script src="../auth/login.js"></script>`.
    content = content.replace(/(src|href)="([^"/]+)"/g, (match, attr, val) => {
      // Ignore if it's external, absolute, or already relative out
      if (val.startsWith("http") || val.startsWith("/") || val.startsWith("."))
        return match;
      // E.g. "login.js" in auth/login.html -> "../auth/login.js"
      const originalFolder = path.basename(path.dirname(info.src));
      return `${attr}="../${originalFolder}/${val}"`;
    });
    fs.writeFileSync(info.dest, content, "utf8");
  }
});

// Update global links
const replaceInFiles = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const currentPath = path.join(dir, file);
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      replaceInFiles(currentPath);
    } else if ([".html", ".js"].includes(path.extname(currentPath))) {
      let content = fs.readFileSync(currentPath, "utf8");
      let updated = content
        .replace(/auth\/login\.html/g, "pages/login.html")
        .replace(/ngo\/ngo-claims\.html/g, "pages/ngo-claims.html")
        .replace(/volunteer\/volunteer\.html/g, "pages/volunteer.html")
        .replace(
          /dashboard-unified\/index\.html/g,
          "pages/dashboard-unified.html",
        );
      if (content !== updated) {
        fs.writeFileSync(currentPath, updated, "utf8");
      }
    }
  }
};

replaceInFiles(frontendDir);

console.log(`Moved HTML files: ${filesMoved.join(", ")}`);
console.log("Migration script step 1 complete.");
