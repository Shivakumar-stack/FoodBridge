const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middlewares/auth");
const {
  assignVolunteerToLogistics,
  updateLogisticsStatus,
  getMyLogistics,
  getAllLogistics,
} = require("../controllers/logisticsController");

// Routes for logistics
router.put(
  "/:id/assign",
  authenticate,
  authorize("admin"),
  assignVolunteerToLogistics,
);
router.put(
  "/:id/status",
  authenticate,
  authorize("volunteer"),
  updateLogisticsStatus,
);
router.get("/my-logistics", authenticate, authorize("volunteer"), getMyLogistics);
router.get("/", authenticate, authorize("admin"), getAllLogistics);

module.exports = router;
