const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

// Apply auth middleware to all dashboard routes
router.use(authenticate);

// Global stats (all roles)
router.get("/stats", dashboardController.getGlobalStats);

// Chart data
router.get("/donations", dashboardController.getDonationTrends);
router.get("/weekly-donations", dashboardController.getWeeklyDonations);

// Recent activity
router.get("/recent-donations", dashboardController.getRecentActivity);
router.get("/recent-deliveries", dashboardController.getRecentDeliveries);

// Requests (NGO + Admin)
router.get("/requests", dashboardController.getRequests);
router.post(
  "/requests",
  authorize("ngo", "admin"),
  dashboardController.createRequest,
);

// Admin only
router.get("/users", authorize("admin"), dashboardController.getAllUsers);
router.get(
  "/reports",
  authorize("admin"),
  dashboardController.getSystemReports,
);

module.exports = router;
