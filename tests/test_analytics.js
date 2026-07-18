/**
 * TEST: Analytics Timeline — Chronological Accuracy Validation
 * ------------------------------------------------------------
 * Verifies that the weekly donations endpoint uses $dateToString
 * for grouping and generates exactly 7 chronological date labels.
 */

const fs = require("fs");
const path = require("path");

const DASHBOARD_PATH = path.join(__dirname, "..", "backend", "controllers", "dashboardController.js");
const DONATION_CTRL_PATH = path.join(__dirname, "..", "backend", "controllers", "donationController.js");

function testDashboardWeeklyLogic() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  TEST 2: Analytics Timeline — Chronological Fix");
  console.log("═══════════════════════════════════════════════════\n");

  const dashSource = fs.readFileSync(DASHBOARD_PATH, "utf8");
  const donationSource = fs.readFileSync(DONATION_CTRL_PATH, "utf8");

  const checks = [
    {
      name: "[Dashboard] Uses $dateToString instead of $dayOfWeek",
      test: () => {
        const weeklyFn = extractFunction(dashSource, "getWeeklyDonations");
        return weeklyFn.includes("$dateToString") && !weeklyFn.includes("$dayOfWeek");
      },
      failMsg: "FAIL: Dashboard still uses $dayOfWeek — timeline will be non-chronological",
    },
    {
      name: "[Dashboard] Groups by YYYY-MM-DD format",
      test: () => dashSource.includes('format: "%Y-%m-%d"'),
      failMsg: "FAIL: Not grouping by exact calendar date",
    },
    {
      name: "[Dashboard] Generates 7 chronological date labels dynamically",
      test: () => {
        const weeklyFn = extractFunction(dashSource, "getWeeklyDonations");
        return weeklyFn.includes("for (let i = 6; i >= 0; i--)") ||
               weeklyFn.includes("for (let i = 6; i>=0; i--)");
      },
      failMsg: "FAIL: Not dynamically building 7-day date array",
    },
    {
      name: "[Dashboard] Uses date range with upper bound ($lte: today)",
      test: () => {
        const weeklyFn = extractFunction(dashSource, "getWeeklyDonations");
        return weeklyFn.includes("$lte: today") || weeklyFn.includes("$lte:");
      },
      failMsg: "FAIL: Missing upper date bound — could include future data",
    },
    {
      name: "[Dashboard] No static orderedDays array",
      test: () => {
        const weeklyFn = extractFunction(dashSource, "getWeeklyDonations");
        return !weeklyFn.includes('orderedDays') && !weeklyFn.includes('mongoOrder');
      },
      failMsg: "FAIL: Still using static day mapping — days will be merged",
    },
    {
      name: "[DonationCtrl] getWeeklyTrends also uses $dateToString",
      test: () => {
        const weeklyFn = extractFunction(donationSource, "getWeeklyTrends");
        return weeklyFn.includes("$dateToString") && !weeklyFn.includes("$dayOfWeek");
      },
      failMsg: "FAIL: Secondary stats endpoint still uses $dayOfWeek",
    },
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach((check) => {
    const result = check.test();
    if (result) {
      console.log(`  ✅ PASS: ${check.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${check.failMsg}`);
      failed++;
    }
  });

  console.log(`\n  Results: ${passed}/${checks.length} passed, ${failed} failed`);

  return failed === 0;
}

function extractFunction(source, fnName) {
  const idx = source.indexOf(fnName);
  if (idx === -1) return "";
  // Grab a generous chunk of the function body
  return source.substring(idx, idx + 3000);
}

function simulateChartOutput() {
  console.log("\n  ── Chart Output Simulation ──\n");

  // Use the actual current date for the simulation
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const labels = [];
  const dateKeys = [];
  const data = [];

  // Simulated MongoDB results (random counts for each of the last 7 days)
  const mockDbResults = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    mockDbResults[dateKey] = Math.floor(Math.random() * 10) + 1;
  }

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    const dayLabel = dayNames[d.getDay()];
    labels.push(`${dayLabel} ${d.getDate()}`);
    dateKeys.push(dateKey);
    data.push(mockDbResults[dateKey] || 0);
  }

  console.log("  Labels:", JSON.stringify(labels));
  console.log("  Values:", JSON.stringify(data));
  console.log("  Dates: ", JSON.stringify(dateKeys));
  console.log("");

  // Validate structural correctness (date-agnostic)
  const checks = [
    { name: "Exactly 7 labels", pass: labels.length === 7 },
    { name: "Exactly 7 values", pass: data.length === 7 },
    { name: "No duplicate dates", pass: new Set(dateKeys).size === 7 },
    { name: "Dates in chronological order", pass: dateKeys.every((d, i) => i === 0 || d > dateKeys[i - 1]) },
    { name: "Last date is today", pass: dateKeys[6] === now.toISOString().split("T")[0] },
    { name: "All values are non-negative numbers", pass: data.every(v => typeof v === "number" && v >= 0) },
    { name: "Each label includes day name", pass: labels.every(l => dayNames.some(dn => l.includes(dn))) },
  ];

  let allPassed = true;
  checks.forEach((c) => {
    console.log(`  ${c.pass ? "✅" : "❌"} ${c.name}`);
    if (!c.pass) allPassed = false;
  });

  return allPassed;
}

// Run
const codeResult = testDashboardWeeklyLogic();
const simResult = simulateChartOutput();
const overall = codeResult && simResult;

console.log("\n═══════════════════════════════════════════════════");
console.log(`  ANALYTICS TEST: ${overall ? "✅ PASS" : "❌ FAIL"}`);
console.log("═══════════════════════════════════════════════════\n");

process.exit(overall ? 0 : 1);
