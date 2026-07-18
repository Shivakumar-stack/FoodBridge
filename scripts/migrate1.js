const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");

// Create target dirs
const targetDirs = [
  "components",
  "features",
  "pages",
  "layouts",
  "services",
  "hooks",
  "store",
  "utils",
  "styles",
  "assets",
  "config",
];
targetDirs.forEach((dir) => {
  const fullPath = path.join(frontendDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Move images to assets/images
const imagesOldPath = path.join(frontendDir, "images");
const imagesNewPath = path.join(frontendDir, "assets", "images");

if (fs.existsSync(imagesOldPath)) {
  console.log(`Moving ${imagesOldPath} to ${imagesNewPath}`);
  fs.renameSync(imagesOldPath, imagesNewPath);

  // Update references
  const replaceInFiles = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const currentPath = path.join(dir, file);
      const stat = fs.statSync(currentPath);
      if (stat.isDirectory()) {
        replaceInFiles(currentPath);
      } else if ([".html", ".js", ".css"].includes(path.extname(currentPath))) {
        let content = fs.readFileSync(currentPath, "utf8");
        let updated = content.replace(
          /(['"]\/?\.\.\/)images\//g,
          "$1assets/images/",
        );
        updated = updated.replace(/(['"]\/?)images\//g, "$1assets/images/");
        if (content !== updated) {
          fs.writeFileSync(currentPath, updated, "utf8");
          console.log(`Updated references in ${currentPath}`);
        }
      }
    }
  };
  replaceInFiles(frontendDir);
}

// Backend missing dirs
const backendDir = path.join(projectRoot, "backend");
["validators", "jobs", "scripts"].forEach((dir) => {
  const fullPath = path.join(backendDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

console.log("Migration script complete.");
