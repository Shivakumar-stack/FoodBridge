/**
 * TEST: Dashboard donation item image and Hugging Face AI layout.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DONATIONS_PAGE = path.join(
  ROOT,
  "frontend",
  "dashboard-unified",
  "dashboard_pages",
  "Donations.js",
);
const DASHBOARD_CSS = path.join(ROOT, "frontend", "styles", "dashboard.css");
const DONATE_HTML = path.join(ROOT, "frontend", "pages", "donate.html");
const DASHBOARD_HTML = path.join(ROOT, "frontend", "pages", "dashboard-unified.html");
const DASHBOARD_ROUTER = path.join(ROOT, "frontend", "dashboard-unified", "router.js");
const DASHBOARD_LAYOUT = path.join(ROOT, "frontend", "dashboard-unified", "DashboardLayout.js");
const DONATE_CSS = path.join(ROOT, "frontend", "styles", "styles.css");
const DONATE_JS = path.join(ROOT, "frontend", "utils", "donate.js");

function check(name, passed, failMsg) {
  console.log(`  ${passed ? "PASS" : "FAIL"}: ${name}`);
  if (!passed) console.log(`    ${failMsg}`);
  return passed ? 1 : 0;
}

function runChecks() {
  console.log("===================================================");
  console.log("  TEST 7: Dashboard AI Image Layout");
  console.log("===================================================\n");

  const donationsSource = fs.readFileSync(DONATIONS_PAGE, "utf8");
  const dashboardCss = fs.readFileSync(DASHBOARD_CSS, "utf8");
  const donateHtml = fs.readFileSync(DONATE_HTML, "utf8");
  const dashboardHtml = fs.readFileSync(DASHBOARD_HTML, "utf8");
  const dashboardRouter = fs.readFileSync(DASHBOARD_ROUTER, "utf8");
  const dashboardLayout = fs.readFileSync(DASHBOARD_LAYOUT, "utf8");
  const donateCss = fs.readFileSync(DONATE_CSS, "utf8");
  const donateJs = fs.readFileSync(DONATE_JS, "utf8");

  const checks = [
    {
      name: "Food item details render as cards, not inline AI list text",
      passed:
        donationsSource.includes("renderDonationItemCards") &&
        donationsSource.includes("donation-item-card") &&
        donationsSource.includes("renderItemSummaryCell") &&
        !donationsSource.includes("AI image suggestion:"),
      failMsg: "Expanded donation details still use cramped inline AI text.",
    },
    {
      name: "Every item card can render its own image",
      passed:
        donationsSource.includes("renderItemImage") &&
        donationsSource.includes("this.getImageUrl(item)") &&
        donationsSource.includes("donation-item-media"),
      failMsg: "Per-item images are not rendered from each item image field.",
    },
    {
      name: "Hugging Face analysis has a dedicated panel",
      passed:
        donationsSource.includes("Hugging Face image analysis") &&
        donationsSource.includes("donation-ai-panel") &&
        donationsSource.includes("donation-ai-status"),
      failMsg: "AI analysis does not have a dedicated dashboard panel.",
    },
    {
      name: "Dashboard CSS isolates item media and AI panels",
      passed:
        dashboardCss.includes(".donation-item-card") &&
        dashboardCss.includes(".donation-item-media") &&
        dashboardCss.includes(".donation-ai-panel") &&
        dashboardCss.includes(".donation-ai-status.completed") &&
        dashboardCss.includes(".donation-item-summary-entry"),
      failMsg: "Dashboard spacing/status CSS for item AI cards is missing.",
    },
    {
      name: "Donation item section uses CSS-driven scrolling",
      passed:
        donateHtml.includes('class="donation-items-scroll') &&
        !donateHtml.includes("max-height: 450px; overflow-y: auto") &&
        !donateHtml.includes("sticky bottom-4") &&
        donateHtml.includes("bg-white shadow-sm") &&
        donateCss.includes("max-height: clamp(320px, 52vh, 460px)") &&
        donateCss.includes("overscroll-behavior: contain"),
      failMsg: "Food item scrolling is still inline/fixed or not item-section-only.",
    },
    {
      name: "Donation form clearly labels Hugging Face image analysis",
      passed:
        donateJs.includes("Typed category suggestion") &&
        donateJs.includes("Hugging Face image analysis will run after submission") &&
        donateJs.includes("Queued for Hugging Face image analysis"),
      failMsg: "Donation form image/typed suggestion labels are unclear.",
    },
    {
      name: "Dashboard and donation assets are cache-busted",
      passed:
        dashboardHtml.includes("dashboard.css?v=20260518-row-details") &&
        dashboardHtml.includes("DashboardLayout.js?v=20260518-row-details") &&
        dashboardRouter.includes("?v=20260518-row-details") &&
        dashboardLayout.includes("router.js?v=20260518-row-details") &&
        donateHtml.includes("donate.js?v=20260513-donation-scroll"),
      failMsg: "Browser may continue loading stale dashboard or donation assets.",
    },
  ];

  const passed = checks.reduce(
    (total, item) => total + check(item.name, item.passed, item.failMsg),
    0,
  );

  console.log(`\n  Results: ${passed}/${checks.length} passed`);
  return passed === checks.length;
}

const result = runChecks();

console.log("\n===================================================");
console.log(`  DASHBOARD AI LAYOUT TEST: ${result ? "PASS" : "FAIL"}`);
console.log("===================================================\n");

process.exit(result ? 0 : 1);
