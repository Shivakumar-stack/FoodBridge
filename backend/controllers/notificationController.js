const Notification = require("../models/Notification");

exports.getLatestNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;

    await Notification.updateMany(
      { _id: { $in: notificationIds }, user: req.user._id },
      { $set: { isRead: true } },
    );

    res.json({
      success: true,
      message: "Notifications marked as read",
    });
  } catch (error) {
    console.error("Mark notifications as read error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.deleteMany({ user: userId });

    res.json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("Clear notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
