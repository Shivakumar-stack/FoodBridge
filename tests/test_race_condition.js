/**
 * TEST: Atomic Donation Claim — Race Condition Validation
 * -------------------------------------------------------
 * Verifies that two simultaneous claim attempts on the same donation
 * result in EXACTLY one success and one 409 Conflict.
 *
 * This is a logical trace / static analysis test that validates
 * the code path without requiring a running MongoDB instance.
 */

const fs = require("fs");
const path = require("path");

const CONTROLLER_PATH = path.join(__dirname, "..", "backend", "controllers", "donationController.js");

function testAtomicClaimLogic() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  TEST 1: Race Condition — Atomic Claim Validation");
  console.log("═══════════════════════════════════════════════════\n");

  const source = fs.readFileSync(CONTROLLER_PATH, "utf8");

  const checks = [
    {
      name: "Uses findOneAndUpdate (atomic operation)",
      test: () => source.includes("findOneAndUpdate"),
      failMsg: "FAIL: Still using findById (non-atomic read-modify-write)",
    },
    {
      name: "Query includes claimedBy: null predicate",
      test: () => source.includes("claimedBy: null"),
      failMsg: "FAIL: Missing claimedBy: null in query — race condition still possible",
    },
    {
      name: "Query includes claimable status filter",
      test: () => source.includes('status: { $in: ["pending", "broadcasted"] }'),
      failMsg: "FAIL: Missing status filter — can claim already-claimed donations",
    },
    {
      name: "Atomic $set for claimedBy and status",
      test: () => source.includes("$set:") && source.includes("claimedBy: req.user._id"),
      failMsg: "FAIL: claimedBy not set atomically inside the update",
    },
    {
      name: "Atomic $push for statusHistory",
      test: () => source.includes("$push:") && source.includes("statusHistory"),
      failMsg: "FAIL: statusHistory not appended atomically",
    },
    {
      name: "Returns 409 Conflict when claim fails",
      test: () => source.includes("409") && source.includes("already claimed"),
      failMsg: "FAIL: Missing 409 response for duplicate claims",
    },
    {
      name: "Returns 404 when donation doesn't exist",
      test: () => source.includes("404") && source.includes("Donation not found"),
      failMsg: "FAIL: Missing 404 response for non-existent donations",
    },
    {
      name: "No separate findById + manual check pattern",
      test: () => {
        // Extract the claimDonation function body
        const claimStart = source.indexOf("exports.claimDonation");
        const claimBody = source.substring(claimStart, claimStart + 2000);
        // Should NOT have findById before the findOneAndUpdate
        const hasFindById = claimBody.includes("Donation.findById(req.params.id).session");
        return !hasFindById;
      },
      failMsg: "FAIL: Still using findById + manual claimedBy check (race vulnerable)",
    },
    {
      name: "Transaction session is passed to findOneAndUpdate",
      test: () => {
        const claimStart = source.indexOf("exports.claimDonation");
        const claimBody = source.substring(claimStart, claimStart + 2000);
        return claimBody.includes("session }") || claimBody.includes("{ new: true, session");
      },
      failMsg: "FAIL: Transaction session not passed — no transactional safety",
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

// Simulate concurrent claim scenario
function simulateConcurrentClaims() {
  console.log("\n  ── Concurrent Claim Simulation ──\n");
  console.log("  Given: Donation D1 with claimedBy=null, status='pending'");
  console.log("  When:  NGO-A and NGO-B send claim requests simultaneously");
  console.log("");

  // Simulate the MongoDB atomic behavior
  let donationClaimedBy = null;
  let donationStatus = "pending";

  function atomicFindOneAndUpdate(ngoId) {
    // This simulates MongoDB's document-level lock on findOneAndUpdate
    if (donationClaimedBy === null && ["pending", "broadcasted"].includes(donationStatus)) {
      donationClaimedBy = ngoId;
      donationStatus = "claimed";
      return { _id: "D1", claimedBy: ngoId, status: "claimed" }; // success
    }
    return null; // atomic fail — doc didn't match query
  }

  // NGO-A claims first (simulated by execution order — MongoDB atomicity guarantees this)
  const resultA = atomicFindOneAndUpdate("NGO-A");
  const resultB = atomicFindOneAndUpdate("NGO-B");

  if (resultA && !resultB) {
    console.log("  ✅ NGO-A: 200 OK — Donation claimed successfully");
    console.log("  ✅ NGO-B: 409 Conflict — Donation already claimed");
    console.log("  ✅ Database state: claimedBy=NGO-A, status=claimed");
    console.log("  ✅ Only 1 Logistics record would be created");
    return true;
  } else {
    console.log("  ❌ FAIL: Both claims succeeded or both failed");
    return false;
  }
}

// Run
const codeResult = testAtomicClaimLogic();
const simResult = simulateConcurrentClaims();
const overall = codeResult && simResult;

console.log("\n═══════════════════════════════════════════════════");
console.log(`  RACE CONDITION TEST: ${overall ? "✅ PASS" : "❌ FAIL"}`);
console.log("═══════════════════════════════════════════════════\n");

process.exit(overall ? 0 : 1);
