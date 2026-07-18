const mongoose = require("mongoose");

/**
 * Logistics Schema
 * Unified source of truth for the end-to-end transport of a donation.
 */
const logisticsSchema = new mongoose.Schema(
  {
    logisticsId: {
      type: String,
      unique: true,
      required: true,
      default: () => `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    },
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
    },
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: [
        "pending_assignment",
        "assigned",
        "in_progress",
        "delivered",
        "failed",
        "cancelled",
      ],
      default: "pending_assignment",
    },
    pickupTime: {
      type: Date,
    },
    deliveryTime: {
      type: Date,
    },
    dropoffLocation: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
        },
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    proofOfDelivery: String, // URL to image/signature
  },
  { timestamps: true },
);

logisticsSchema.index({ donation: 1 });
logisticsSchema.index({ donor: 1 });
logisticsSchema.index({ volunteer: 1 });
logisticsSchema.index({ ngo: 1 });
logisticsSchema.index({ status: 1 });

module.exports = mongoose.model("Logistics", logisticsSchema);
