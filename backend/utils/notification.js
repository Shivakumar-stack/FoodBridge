const Notification = require("../models/Notification");
const { getIO } = require("../services/socketService");
const logger = require("../config/logger");

/**
 * Send a notification to a specific user
 * @param {string} userId - ID of the user to notify
 * @param {object} data - { title, message, type, relatedId, relatedModel }
 */
const sendNotification = async (userId, data) => {
  try {
    if (!userId) {
      logger.warn("[Notification] Skipped: no userId provided");
      return null;
    }

    // Safely extract ID string (handles ObjectId, populated doc, or string)
    const userIdStr = userId._id ? userId._id.toString() : userId.toString();

    // 1. Save to database — use the `meta` field from the schema
    const notification = await Notification.create({
      user: userId,
      title: data.title,
      message: data.message,
      type: data.type || "alert",
      meta: {
        donationId: data.relatedId || null,
        status: data.type || null,
      }
    });

    // 2. Emit via socket
    const io = getIO();
    if (io) {
      // Emit to the user's private room
      io.to(userIdStr).emit("notification", {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        isRead: false
      });
      logger.debug(`Socket notification emitted to user ${userIdStr}`);
    }

    return notification;
  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error.message || error);
  }
};

/**
 * Send notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {object} data - Notification data
 */
const notifyMany = async (userIds, data) => {
  if (!Array.isArray(userIds)) return;
  return Promise.all(userIds.map(id => sendNotification(id, data)));
};

module.exports = {
  sendNotification,
  notifyMany
};
