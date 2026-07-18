const Donation = require("../models/Donation");
const Claim = require("../models/Claim");
const mongoose = require("mongoose");
const donationService = require("../services/donationService");
const { sendNotification } = require("../utils/notification");
const visionService = require("../services/visionService");
const geocodingService = require("../services/geocodingService");
const logisticsService = require("../services/logisticsService");
const Logistics = require("../models/Logistics");

/**
 * POST /api/donations
 * Create a new donation with optional image
 */
exports.createDonation = async (req, res, next) => {
  try {
    const rawData = req.body;
    
    // Normalize payload using shared service logic
    const items = donationService.normalizeFoodItemsPayload(rawData.items);
    
    // AI Vision API Integration per item (Async Setup)
    let globalImageUrl = null;
    const aiJobs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = file.secure_url || file.url || file.path || null;
        if (!imageUrl) continue;

        const match = file.fieldname.match(/^items\[(\d+)\]\[image\]$/);
        
        if (match) {
          const index = parseInt(match[1], 10);
          if (items[index]) {
            items[index].image = imageUrl;
            aiJobs.push({ index, imageUrl });
          }
        } else if (file.fieldname === "image") {
          // Backward compatibility for old form submission
          globalImageUrl = imageUrl;
          if (items.length > 0 && !items[0].image) {
            items[0].image = imageUrl;
            aiJobs.push({ index: 0, imageUrl });
          }
        }
      }
    }

    const pickupAddress = donationService.normalizePickupAddressPayload(rawData.pickupAddress || rawData);
    
    // Geocode address to get coordinates for the live map
    if (!pickupAddress.coordinates?.lat || !pickupAddress.coordinates?.lng) {
      const coords = await geocodingService.geocodePickupAddress(pickupAddress);
      if (coords) {
        pickupAddress.coordinates = coords;
      }
    }
    const foodSafety = donationService.normalizeFoodSafetyPayload(rawData.foodSafety, items);
    
    const estimatedServings = donationService.normalizeEstimatedServings(rawData.impact, items);
    
    // Check donor policies (Tier-based limits)
    const donorTier = donationService.getDonorTier(req.user);
    const policy = donationService.DONOR_POLICIES[donorTier];
    
    // Count pending donations for this donor
    const pendingCount = await Donation.countDocuments({
      donorId: req.user._id, 
      status: { $in: ["pending", "broadcasted", "claimed", "accepted"] } 
    });
    
    if (pendingCount >= policy.maxPendingDonations) {
      return res.status(403).json({
        success: false,
        message: `Your account tier (${donorTier}) allows a maximum of ${policy.maxPendingDonations} active donations.`
      });
    }

    const donationData = {
      donorId: req.user._id,
      donorName: req.user.organization?.name || `${req.user.firstName} ${req.user.lastName}`,
      items,
      image: globalImageUrl, // Cloudinary secure URL (backward compatibility)
      address: pickupAddress.address,
      city: pickupAddress.city,
      state: pickupAddress.state,
      zip: pickupAddress.zip,
      lat: pickupAddress.coordinates?.lat,
      lng: pickupAddress.coordinates?.lng,
      pickupDatetime: rawData.pickupDatetime || rawData.pickupTime || new Date(),
      pickupWindow: donationService.normalizePickupWindowPayload(rawData.pickupWindow),
      foodSafety,
      impact: {
        estimatedServings,
        weightKg: Number(rawData.impact?.weightKg) || 0,
        co2Saved: (Number(estimatedServings) * 0.5).toFixed(2), // heuristic
      },
      priority: rawData.priority || "medium",
      notes: rawData.notes,
      status: "pending",
      statusHistory: [{
        status: "pending",
        timestamp: new Date(),
        updatedBy: req.user._id,
        notes: "Donation created"
      }]
    };

    const donation = await Donation.create(donationData);

    // Calculate initial priority score
    donation.priorityScore = donationService.calculatePriorityScore(donation);
    await donation.save();

    // Emit real-time event for live map
    const io = req.app.get("io");
    if (io) {
      io.emit("newDonation", {
        _id: donation._id,
        donorName: donation.donorName,
        city: donation.city,
        status: donation.status,
        lat: donation.lat,
        lng: donation.lng,
        priority: donation.priority,
        createdAt: donation.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      data: donation
    });

    // Run AI analysis in the background so it doesn't delay the response
    if (aiJobs.length > 0) {
      setTimeout(async () => {
        try {
          // Process all vision API requests FIRST to avoid holding a stale document during network latency
          const visionResults = [];
          for (const job of aiJobs) {
            const visionResult = await visionService.analyzeFoodImage(job.imageUrl);
            if (visionResult.success) {
              visionResults.push({ job, visionResult });
            }
          }

          if (visionResults.length === 0) return;

          // Fetch the document AFTER network calls to get the freshest state
          const doc = await Donation.findById(donation._id);
          if (!doc) return;
          
          let updated = false;
          for (const { job, visionResult } of visionResults) {
            if (doc.items[job.index]) {
              doc.items[job.index].aiAnalysis = {
                detectedName: visionResult.detectedName,
                detectedCategory: visionResult.detectedCategory,
                confidence: visionResult.confidence,
                labels: visionResult.labels
              };
              if (visionResult.detectedName) {
                doc.items[job.index].itemName = visionResult.detectedName;
              }
              doc.items[job.index].category = visionResult.detectedCategory;
              doc.items[job.index].specialNotes = (doc.items[job.index].specialNotes ? doc.items[job.index].specialNotes + " | " : "") + 
                                      `[Auto-labeled by Vision API: ${visionResult.labels.slice(0, 3).join(", ")}]`;
              updated = true;
            }
          }
          if (updated) {
            await doc.save();
            if (io) {
              // Notify frontend to refresh dashboard because AI analysis finished
              io.emit("donationUpdated", { _id: doc._id, status: doc.status });
            }
          }
        } catch (err) {
          console.error("Background AI Analysis error:", err);
        }
      }, 0);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/donations
 * List donations with role-aware filtering
 */
exports.getDonations = async (req, res, next) => {
  try {
    const role = req.user.role;
    let query = {};

    if (role === "donor") {
      query.donorId = req.user._id;
    } else if (role === "ngo") {
      // NGOs see available donations OR those they specifically claimed (AUD-04)
      query.$or = [
        { status: { $in: ["pending", "broadcasted"] } },
        { claimedBy: req.user._id } // Fixed IDOR: only see THEIR claims
      ];
    } else if (role === "volunteer") {
      query = donationService.buildVolunteerDonationVisibilityQuery(req.user._id);
    }

    // Apply additional filters (with strict type casting to prevent NoSQL injection via object bypass)
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && status !== "all") {
      query.status = status;
    }
    
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    if (category && category !== "all") {
      query["items.category"] = category;
    }

    if (req.query.city) {
      const cityStr = typeof req.query.city === "string" ? req.query.city : String(req.query.city);
      query.city = new RegExp(cityStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
    }

    const safeLimit = Math.min(parseInt(req.query.limit) || 50, 50);

    const donations = await Donation.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit);
    const sanitized = donations.map((donation) =>
      donationService.sanitizeDonationForUser(donation, req.user),
    );

    res.status(200).json({
      success: true,
      count: sanitized.length,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/donations/:id
 */
exports.getDonationById = async (req, res, next) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate("donorId", "firstName lastName organization donorInfo")
      .populate("assignedVolunteer", "firstName lastName phone");

    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found" });
    }
    if (!donationService.canAccessDonation(req.user, donation)) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this donation",
      });
    }
    const sanitized = donationService.sanitizeDonationForUser(donation, req.user);

    res.status(200).json({
      success: true,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/donations/public-map
 * Public geospatial data for live map
 */
exports.getPublicMapDonations = async (req, res, next) => {
  try {
    const donations = await Donation.find({ 
      status: { $in: ["pending", "broadcasted", "claimed", "accepted", "picked_up", "in_transit"] } 
    })
    .select("donorName items city state zip address lat lng status priority priorityScore impact notes image createdAt")
    .limit(300);

    // Secondary PII filter: Ensure donorName is organization name if available, else mask if it looks like a person
    const sanitizedDonations = donations.map(d => {
      // If it's a 2-word name and no organization, it's likely PII
      if (d.donorName && d.donorName.split(' ').length <= 2 && !d.donorName.toLowerCase().includes('ngo') && !d.donorName.toLowerCase().includes('foundation')) {
        d.donorName = "Individual Donor"; // Masking for public view
      }
      return d;
    });

    res.status(200).json({
      success: true,
      data: sanitizedDonations
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/donations/stats/overview
 */
exports.getDonationStats = async (req, res, next) => {
  try {
    const stats = await Donation.getStatistics();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/donations/stats/weekly
 */
exports.getWeeklyTrends = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const stats = await Donation.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo, $lte: today } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          servings: { $sum: "$impact.estimatedServings" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/donations/:id/status
 */
exports.updateDonationStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { status, notes } = req.body;

    if (!status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    // --- State-machine & Auth checks delegated to LogisticsService ---
    await logisticsService.updateDonationStatus(
      req.params.id,
      status,
      req.user,
      notes,
      session
    );

    await session.commitTransaction();
    session.endSession();

    // Emit real-time event
    const io = req.app.get("io");
    if (io) {
      io.emit("donationStatusUpdated", {
        _id: req.params.id,
        status,
        updatedBy: req.user._id,
      });
    }

    res.status(200).json({
      success: true,
      message: `Donation updated to ${status}`
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(err);
  }
};


/**
 * GET /api/donations/volunteer/available
 */
exports.getAvailableDonationsForVolunteer = async (req, res, next) => {
  try {
    const donations = await Donation.find(
      donationService.buildVolunteerOpenDonationQuery(),
    )
      .sort({ createdAt: 1 })
      .limit(50);

    const sanitized = donations.map((donation) =>
      donationService.sanitizeDonationForUser(donation, req.user),
    );
    res.status(200).json({
      success: true,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/donations/ngo/available
 */
exports.getAvailableDonationsForNgo = async (req, res, next) => {
  try {
    const donations = await Donation.find({
      status: { $in: ["pending", "broadcasted"] },
      claimedBy: null
    }).sort({ createdAt: -1 }).limit(50);

    const sanitized = donations.map((donation) =>
      donationService.sanitizeDonationForUser(donation, req.user),
    );
    res.status(200).json({
      success: true,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/donations/:id/claim
 *
 * Uses atomic findOneAndUpdate to prevent race conditions:
 * The query includes { claimedBy: null } so only the FIRST concurrent
 * request will match. All subsequent requests get null → 409 Conflict.
 */
exports.claimDonation = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic claim: only succeeds if donation exists AND is unclaimed
    const donation = await Donation.findOneAndUpdate(
      {
        _id: req.params.id,
        claimedBy: null,
        status: { $in: ["pending", "broadcasted"] },
      },
      {
        $set: {
          claimedBy: req.user._id,
          status: "claimed",
        },
        $push: {
          statusHistory: {
            status: "claimed",
            timestamp: new Date(),
            updatedBy: req.user._id,
            notes: "Donation claimed by NGO",
          },
        },
      },
      { new: true, session }
    );

    if (!donation) {
      await session.abortTransaction();
      session.endSession();
      // Determine whether it's a 404 or a 409
      const exists = await Donation.findById(req.params.id).lean();
      if (!exists) {
        return res.status(404).json({ success: false, message: "Donation not found" });
      }
      return res.status(409).json({ success: false, message: "Donation already claimed or not in a claimable state" });
    }

    // Create claim record and logistics entry within the same transaction
    const claim = await Claim.create([{
      donation: donation._id,
      ngo: req.user._id,
      status: "approved"
    }], { session });

    // Create Logistics record (donation is already updated atomically above)
    await Logistics.create([{
      donation: donation._id,
      donor: donation.donorId,
      ngo: req.user._id,
      status: "pending_assignment",
      pickupTime: donation.pickupDatetime,
      notes: `Pickup from: ${donation.address || ""}, ${donation.city || ""}`
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Emit real-time event
    const io = req.app.get("io");
    if (io) {
      io.emit("donationClaimed", {
        _id: donation._id,
        status: "claimed",
        claimedBy: req.user._id,
      });
    }

    // Notify the donor that their donation was claimed
    sendNotification(donation.donorId, {
      title: "Donation Update",
      message: "Your donation has been claimed by an NGO.",
      type: "status_update",
      relatedId: donation._id,
      relatedModel: "Donation"
    });

    res.status(200).json({
      success: true,
      message: "Donation claimed successfully",
      data: { donationId: donation._id, claimId: claim[0]._id }
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

/**
 * GET /api/donations/stats/admin
 */
exports.getAdminStats = async (req, res, next) => {
  try {
    const totalDonations = await Donation.countDocuments();
    const activeDonations = await Donation.countDocuments({ status: { $ne: "completed" } });
    
    const impact = await Donation.aggregate([
      { $group: { _id: null, totalServings: { $sum: "$impact.estimatedServings" } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalDonations,
        activeDonations,
        totalServings: impact[0]?.totalServings || 0
      }
    });
  } catch (err) {
    next(err);
  }
};
