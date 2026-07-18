const mongoose = require("mongoose");

/**
 * Donation Schema - Tracks food donations from donors to NGOs
 */
const donationSchema = new mongoose.Schema(
  {
    // Reference to the donor
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    donorName: {
      type: String,
      required: true,
    },
    // Reference to the NGO user that claimed this donation
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Food details
    items: [
      {
        itemName: {
          type: String,
          required: true,
          trim: true,
        },
        category: {
          type: String,
          enum: [
            "Cooked Food",
            "Raw Ingredients",
            "Packaged",
            "Baked Goods",
            "Beverages",
            "Dairy",
            "Fruits",
            "Vegetables",
            "Other",
          ],
          required: true,
        },
        quantity: {
          type: String,
          required: true,
        },
        unit: {
          type: String,
          required: true,
        },
        servings: {
          type: Number,
          default: 0,
        },
        allergens: [String],
        specialNotes: String,
        image: {
          type: String,
          default: null,
        },
        aiAnalysis: {
          detectedName: String,
          detectedCategory: String,
          confidence: Number,
          labels: [String]
        }
      },
    ],
    // Image URL for the donation (via Cloudinary) - kept for backward compatibility
    image: {
      type: String,
      default: null,
    },
    // Pickup location
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    lat: { type: Number },
    lng: { type: Number },
    // Pickup schedule
    pickupDatetime: {
      type: Date,
      required: true,
    },
    pickupWindow: {
      start: Date,
      end: Date,
    },
    // Status tracking
    status: {
      type: String,
      enum: [
        "pending",
        "broadcasted",
        "claimed",
        "accepted",
        "picked_up",
        "in_transit",
        "delivered",
        "closed",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    assignedVolunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Status history for tracking
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "pending",
            "broadcasted",
            "claimed",
            "accepted",
            "picked_up",
            "in_transit",
            "delivered",
            "closed",
            "completed",
            "cancelled",
          ],
        },
        timestamp: { type: Date, default: Date.now },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],
    // Food safety information
    foodSafety: {
      preparedTime: Date,
      expiryTime: Date,
      storageType: {
        type: String,
        enum: ["room_temp", "refrigerated", "frozen", "heated"],
      },
      temperature: Number,
      packaging: String,
    },
    // Impact metrics
    impact: {
      estimatedServings: Number,
      weightKg: Number,
      co2Saved: Number,
    },
    // Smart prioritization score for volunteer pickup queues
    priorityScore: {
      type: Number,
      default: 0,
    },
    // User-defined urgency level for the donation
    priority: {
      type: String,
      enum: [
        "low",
        "medium",
        "high",
        "critical",
        "Fast Track (+2h)",
        "Priority (+4h)",
        "Tomorrow Morning",
      ],
      default: "medium",
    },
    // Additional information
    notes: String,
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringSchedule: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
      },
      daysOfWeek: [Number], // 0-6 for Sunday-Saturday
    },
    // Cancellation reason
    cancellationReason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Ratings and feedback
    ratings: {
      donorRating: { type: Number, min: 1, max: 5 },
      donorFeedback: String,
      volunteerRating: { type: Number, min: 1, max: 5 },
      volunteerFeedback: String,
      ngoRating: { type: Number, min: 1, max: 5 },
      ngoFeedback: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret) {

        // AUD-02: Normalize backend field names to match frontend data contract.
        // Frontend expects `foodItems` (array), `pickupAddress` (object), and `donor` (object).
        // Backend stores `items`, `address`, `city`, `state`, `zip`, `lat`, `lng`, `donorId`.

        // Map items → foodItems
        if (ret.items && !ret.foodItems) {
          ret.foodItems = ret.items.map((item) => ({
            name: item.itemName,
            itemName: item.itemName,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            servings: item.servings,
            allergens: item.allergens,
            specialNotes: item.specialNotes,
          }));
        }

        // Map address fields → pickupAddress
        if (!ret.pickupAddress) {
          // Use undefined (not null) for missing coords so Number(undefined)=NaN
          // correctly triggers the city-fallback path in the frontend map.
          const hasLat = ret.lat != null && Number.isFinite(Number(ret.lat));
          const hasLng = ret.lng != null && Number.isFinite(Number(ret.lng));
          ret.pickupAddress = {
            street: ret.address || "",
            address: ret.address || "",
            city: ret.city || "",
            state: ret.state || "",
            zipCode: ret.zip || "",
            coordinates: {
              lat: hasLat ? Number(ret.lat) : undefined,
              lng: hasLng ? Number(ret.lng) : undefined,
            },
          };
          // Also add lat/lng at pickupAddress level for direct access
          if (hasLat) ret.pickupAddress.lat = Number(ret.lat);
          if (hasLng) ret.pickupAddress.lng = Number(ret.lng);
        }

        // Map donorId → donor (when not populated)
        if (ret.donorId && !ret.donor) {
          if (typeof ret.donorId === "object" && ret.donorId.firstName) {
            // Already populated by Mongoose
            ret.donor = ret.donorId;
          } else {
            ret.donor = { _id: ret.donorId };
          }
        }

        // Normalize pickup time field for frontend
        if (ret.pickupDatetime && !ret.pickupTime) {
          ret.pickupTime = ret.pickupDatetime;
        }

        // Ensure estimatedServings is accessible at top level
        if (ret.impact?.estimatedServings != null && ret.estimatedServings == null) {
          ret.estimatedServings = ret.impact.estimatedServings;
        }

        return ret;
      },
    },
  },
);

// Indexes
donationSchema.index({ donorId: 1 });
donationSchema.index({ status: 1 });
donationSchema.index({ pickupDatetime: 1 });
donationSchema.index({ city: 1 });
donationSchema.index({ createdAt: -1 });

// Virtual for time remaining until pickup
donationSchema.virtual("timeUntilPickup").get(function () {
  return this.pickupDatetime - new Date();
});

// Method to check if donation is expired
donationSchema.methods.isExpired = function () {
  return new Date() > this.foodSafety.expiryTime;
};

// Static method to get donation statistics
donationSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalServings: { $sum: "$impact.estimatedServings" },
      },
    },
  ]);

  return stats;
};

// PERFORMANCE: Add indexes for frequently queried fields
// Status + creation date for list filtering and sorting
donationSchema.index({ status: 1, createdAt: -1 });
// Claimed by user for user's donations list
donationSchema.index({ claimedBy: 1 });
// Status history timestamps for audit trails
donationSchema.index({ "statusHistory.timestamp": 1 });

module.exports = mongoose.model("Donation", donationSchema);
