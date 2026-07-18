/**
 * TEST: Transaction Safety & Atomic Locks
 * -------------------------------------------------------------------
 * Verifies that high-risk endpoints use Mongoose transactions
 * and atomic locks (findOneAndUpdate) to prevent race conditions.
 */

const fs = require("fs");
const path = require("path");

const DONATION_CTRL_PATH = path.join(__dirname, "..", "backend", "controllers", "donationController.js");
const LOGISTICS_CTRL_PATH = path.join(__dirname, "..", "backend", "controllers", "logisticsController.js");

function runTransactionSafetyTests() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  TEST 6: Transaction Safety & Atomic Locks");
  console.log("═══════════════════════════════════════════════════\n");

  const donationSource = fs.readFileSync(DONATION_CTRL_PATH, "utf8");
  const logisticsSource = fs.readFileSync(LOGISTICS_CTRL_PATH, "utf8");

  let allPassed = true;

  const checks = [
    {
      name: "claimDonation uses atomic findOneAndUpdate lock",
      test: () => donationSource.includes("findOneAndUpdate") && donationSource.includes("claimedBy: null"),
      failMsg: "Missing atomic lock on claim operation. Race conditions are possible."
    },
    {
      name: "claimDonation initiates Mongoose Transaction",
      test: () => donationSource.includes("session.startTransaction()") && donationSource.includes("session.commitTransaction()"),
      failMsg: "claimDonation is missing transaction wrappers."
    },
    {
      name: "claimDonation creates Claim and Logistics within session",
      test: () => donationSource.includes("Claim.create") && donationSource.includes("Logistics.create") && donationSource.includes("{ session }"),
      failMsg: "Claim and Logistics creation must be part of the session transaction."
    },
    {
      name: "claimDonation aborts transaction accurately on failure",
      test: () => donationSource.includes("session.abortTransaction()"),
      failMsg: "Missing abortTransaction in error handling."
    },
    {
      name: "updateDonationStatus operates within a transaction",
      test: () => {
         const chunk = donationSource.substring(donationSource.indexOf("updateDonationStatus"));
         return chunk.includes("session.startTransaction()") && chunk.includes("session.commitTransaction()");
      },
      failMsg: "updateDonationStatus missing transaction boundaries."
    },
    {
      name: "assignVolunteerToLogistics operates within a transaction",
      test: () => logisticsSource.includes("session.startTransaction()") && logisticsSource.includes("session.commitTransaction()"),
      failMsg: "assignVolunteerToLogistics missing transaction boundaries."
    },
    {
      name: "updateLogisticsStatus operates within a transaction",
      test: () => {
         const chunk = logisticsSource.substring(logisticsSource.indexOf("updateLogisticsStatus"));
         return chunk.includes("session.startTransaction()") && chunk.includes("session.commitTransaction()");
      },
      failMsg: "updateLogisticsStatus missing transaction boundaries."
    },
    {
      name: "Controllers handle 'inTransaction()' safety checks in catch blocks",
      test: () => donationSource.includes("session.inTransaction()") && logisticsSource.includes("session.inTransaction()"),
      failMsg: "Missing inTransaction() verification before aborting in catch blocks."
    }
  ];

  checks.forEach((check) => {
    const result = check.test();
    console.log(`  ${result ? "✅" : "❌"} ${check.name}`);
    if (!result) {
      console.log(`     -> ${check.failMsg}`);
      allPassed = false;
    }
  });

  return allPassed;
}

const result = runTransactionSafetyTests();

console.log("\n═══════════════════════════════════════════════════");
console.log(`  TRANSACTION SAFETY TEST: ${result ? "✅ PASS" : "❌ FAIL"}`);
console.log("═══════════════════════════════════════════════════\n");

process.exit(result ? 0 : 1);