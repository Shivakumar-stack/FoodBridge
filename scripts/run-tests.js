const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const testsDir = path.join(__dirname, "..", "tests");

if (!fs.existsSync(testsDir)) {
  console.error("Tests directory not found.");
  process.exit(1);
}

const testFiles = fs
  .readdirSync(testsDir)
  .filter((file) => /^test_.*\.js$/i.test(file))
  .sort();

if (testFiles.length === 0) {
  console.error("No test files found in tests/.");
  process.exit(1);
}

let failed = false;

for (const file of testFiles) {
  console.log(`\n[run-tests] Running ${file}`);
  const result = spawnSync(process.execPath, [path.join(testsDir, file)], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    failed = true;
    break;
  }
}

process.exit(failed ? 1 : 0);
