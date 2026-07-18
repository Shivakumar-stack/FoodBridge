const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");
const featuresDir = path.join(frontendDir, "features");
const layoutsDir = path.join(frontendDir, "layouts");

// Create target dirs
["ngo", "volunteer", "dashboard", "auth"].forEach((f) => {
  fs.mkdirSync(path.join(featuresDir, f), { recursive: true });
});
fs.mkdirSync(layoutsDir, { recursive: true });

let moves = [];

// 1. Feature folders
const featureMap = {
  ngo: "ngo",
  volunteer: "volunteer",
  dashboard: "dashboard",
  auth: "auth",
};

Object.entries(featureMap).forEach(([oldDir, newDir]) => {
  const oldPath = path.join(frontendDir, oldDir);
  const newPath = path.join(featuresDir, newDir);
  if (fs.existsSync(oldPath)) {
    const files = fs.readdirSync(oldPath);
    for (const file of files) {
      const src = path.join(oldPath, file);
      const dest = path.join(newPath, file);
      if (!fs.statSync(src).isDirectory()) {
        fs.renameSync(src, dest);
        moves.push({
          from: `${oldDir}/${file}`,
          to: `features/${newDir}/${file}`,
        });
      }
    }
  }
});

// 2. Layouts
const componentsDir = path.join(frontendDir, "components");
if (fs.existsSync(componentsDir)) {
  const files = fs.readdirSync(componentsDir);
  for (const file of files) {
    if (
      file.includes("footer") ||
      file.includes("navbar") ||
      file.includes("header")
    ) {
      const src = path.join(componentsDir, file);
      const dest = path.join(layoutsDir, file);
      fs.renameSync(src, dest);
      moves.push({ from: `components/${file}`, to: `layouts/${file}` });
    }
  }
}

// 3. Update references
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
      moves.forEach((m) => {
        // regex carefully matches from references
        // matches ../ngo/ngo-claims.js or ngo/ngo-claims.js
        // but we might need a simpler replace
        const fromRegex = new RegExp(`(['"\\/\\.])(${m.from})`, "g");
        updated = updated.replace(fromRegex, `$1${m.to}`);

        // Also handles ../auth/login.js to ../features/auth/login.js
        const fromRegex2 = new RegExp(`(['"\\.\\/]+)(${m.from})`, "g");
        updated = updated.replace(fromRegex2, (_match, prefix) => {
          return prefix + m.to;
        });
      });
      if (content !== updated) {
        fs.writeFileSync(currentPath, updated, "utf8");
      }
    }
  }
};

replaceInFiles(frontendDir);

console.log(
  `Moved files:\n${moves.map((m) => m.from + " -> " + m.to).join("\n")}`,
);
console.log("Migration script step 2 complete.");
