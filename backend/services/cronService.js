const cron = require("node-cron");
const Donation = require("../models/Donation");
const logger = require("../config/logger");

const NON_EXPIRABLE_STATUSES = ["delivered", "cancelled", "expired", "closed", "completed"];

async function runAutoExpireJob() {
  try {
    // Find donations past their pickup time that are still in active states
    const expiredDonations = await Donation.find({
      pickupDatetime: { $lt: new Date() },
      status: { $nin: NON_EXPIRABLE_STATUSES },
    });

    if (expiredDonations.length === 0) return;

    let updatedCount = 0;

    for (const donation of expiredDonations) {
      donation.status = "cancelled";
      donation.priorityScore = 0;
      donation.cancellationReason = "Auto-expired: pickup time has passed";
      donation.statusHistory.push({
        status: "cancelled",
        timestamp: new Date(),
        notes: "Auto-expired by system: pickup window elapsed",
      });
      await donation.save();
      updatedCount++;
    }

    if (updatedCount > 0) {
      logger.info(
        `Auto-expire job updated ${updatedCount} donation(s)`,
      );
    }
  } catch (error) {
    logger.error("Auto-expire background job error:", error);
  }
}

/**
 * Initialize all cron jobs
 * The auto-expire job runs every 10 minutes
 */
const initializeCronJobs = () => {
  if (process.env.NODE_ENV !== "test") {
    logger.info("Initializing background cron jobs...");

    // Run every 10 minutes
    cron.schedule("*/10 * * * *", runAutoExpireJob);

    // Initial warmup run 15 seconds after boot
    setTimeout(runAutoExpireJob, 15 * 1000);
  }
};

module.exports = {
  initializeCronJobs,
  runAutoExpireJob,
};
