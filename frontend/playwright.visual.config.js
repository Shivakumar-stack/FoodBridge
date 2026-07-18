const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: ["**/visual-snapshots.spec.js"],
  outputDir: "./test-results-playwright",
  timeout: 60000,
  expect: {
    timeout: 5000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5500",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node ./node_modules/live-server/live-server.js --port=5500 --host=127.0.0.1 --no-browser --entry-file=pages/index.html",
    url: "http://127.0.0.1:5500/pages/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
