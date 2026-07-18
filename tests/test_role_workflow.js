/**
 * TEST: Role Workflow Guards - Authorization and Visibility Validation
 * -------------------------------------------------------------------
 * Verifies that donation lifecycle permissions and role-scoped queries
 * match the intended donor -> NGO -> volunteer -> delivery workflow.
 */

const fs = require("fs");
const path = require("path");

const FILES = {
  logisticsService: path.join(
    __dirname,
    "..",
    "backend",
    "services",
    "logisticsService.js",
  ),
  donationService: path.join(
    __dirname,
    "..",
    "backend",
    "services",
    "donationService.js",
  ),
  donationController: path.join(
    __dirname,
    "..",
    "backend",
    "controllers",
    "donationController.js",
  ),
  dashboardController: path.join(
    __dirname,
    "..",
    "backend",
    "controllers",
    "dashboardController.js",
  ),
};

function load(key) {
  return fs.readFileSync(FILES[key], "utf8");
}

function extractChunk(source, marker, length = 2000) {
  const start = source.indexOf(marker);
  if (start === -1) return "";
  return source.substring(start, start + length);
}

function runChecks() {
  console.log("===================================================");
  console.log("  TEST 5: Role Workflow Guards");
  console.log("===================================================\n");

  const logisticsSource = load("logisticsService");
  const donationServiceSource = load("donationService");
  const donationControllerSource = load("donationController");
  const dashboardSource = load("dashboardController");

  const acceptedChunk = extractChunk(logisticsSource, 'if (newStatus === "accepted")');
  const closedChunk = extractChunk(logisticsSource, 'else if (newStatus === "closed")');
  const volunteerQueryChunk = extractChunk(
    donationServiceSource,
    "function buildVolunteerOpenDonationQuery()",
  );
  const recentDeliveriesChunk = extractChunk(
    dashboardSource,
    "exports.getRecentDeliveries = async",
  );

  const checks = [
    {
      name: "Cancellation restricted to donor or admin",
      test: () =>
        logisticsSource.includes(
          "Only the donor or an admin can cancel this donation.",
        ),
      failMsg: "FAIL: Donation cancellation is still not ownership-scoped",
    },
    {
      name: "Direct accept transition restricted to volunteers",
      test: () =>
        acceptedChunk.includes('if (userRole !== "volunteer")') &&
        !acceptedChunk.includes('userRole !== "volunteer" && userRole !== "admin"'),
      failMsg: "FAIL: Admins can still accept pickups directly via donation status",
    },
    {
      name: "Volunteer open queue only includes claimed, unassigned donations",
      test: () =>
        volunteerQueryChunk.includes('status: "claimed"') &&
        volunteerQueryChunk.includes("assignedVolunteer: null") &&
        volunteerQueryChunk.includes("assigned_volunteer: null"),
      failMsg: "FAIL: Volunteer queue still includes donations outside the claim-ready state",
    },
    {
      name: "Volunteer donation visibility uses shared workflow query",
      test: () =>
        donationControllerSource.includes(
          "buildVolunteerDonationVisibilityQuery(req.user._id)",
        ) &&
        dashboardSource.includes("buildVolunteerDonationVisibilityQuery(userId)"),
      failMsg: "FAIL: Volunteer-facing endpoints are not consistently using the same workflow filter",
    },
    {
      name: "Volunteer access checks use claimed-only queue logic",
      test: () =>
        donationServiceSource.includes("isVolunteerQueueDonation") &&
        donationServiceSource.includes('return status === "claimed" && isDonationUnassigned(donation);'),
      failMsg: "FAIL: Volunteer object-level access still allows pre-claim donations",
    },
    {
      name: "Recent deliveries endpoint only returns delivered logistics",
      test: () => recentDeliveriesChunk.includes('status: "delivered"'),
      failMsg: "FAIL: Recent deliveries endpoint still returns non-delivered logistics records",
    },
    {
      name: "Recent deliveries are scoped to the requesting role",
      test: () =>
        dashboardSource.includes("function buildLogisticsVisibilityQuery(role, userId)") &&
        recentDeliveriesChunk.includes("buildLogisticsVisibilityQuery(role, userId)"),
      failMsg: "FAIL: Recent deliveries endpoint is still globally readable",
    },
    {
      name: "Admin close flow fulfills the claiming NGO, not the acting admin",
      test: () =>
        closedChunk.includes("donation.claimedBy || actorId"),
      failMsg: "FAIL: Closing a donation as admin still misattributes NGO fulfillment",
    },
  ];

  let passed = 0;

  checks.forEach((check) => {
    const result = check.test();
    console.log(`  ${result ? "PASS" : "FAIL"}: ${check.name}`);
    if (!result) {
      console.log(`    ${check.failMsg}`);
    } else {
      passed += 1;
    }
  });

  console.log(`\n  Results: ${passed}/${checks.length} passed`);
  return passed === checks.length;
}

const result = runChecks();

console.log("\n===================================================");
console.log(`  ROLE WORKFLOW TEST: ${result ? "PASS" : "FAIL"}`);
console.log("===================================================\n");

process.exit(result ? 0 : 1);
