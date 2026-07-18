const mongoose = require("mongoose");

/**
 * Request Schema - NGO food requests
 */
const requestSchema = new mongoose.Schema(
  {
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ngoName: {
      type: String,
      required: true,
    },
    foodNeeded: {
      type: String,
      required: [true, "Food description is required"],
      trim: true,
    },
    quantity: {
      type: String,
      required: [true, "Quantity is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "fulfilled", "cancelled"],
      default: "pending",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

requestSchema.index({ ngoId: 1 });
requestSchema.index({ status: 1 });
requestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Request", requestSchema);
