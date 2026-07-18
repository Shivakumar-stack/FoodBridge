const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const {
  getLatestNotifications,
  markAsRead,
  clearNotifications,
} = require("../controllers/notificationController");

router.get("/", authenticate, getLatestNotifications);
router.put("/read", authenticate, markAsRead);
router.delete("/", authenticate, clearNotifications);

module.exports = router;
