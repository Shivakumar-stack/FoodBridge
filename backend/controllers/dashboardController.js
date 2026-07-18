const Donation = require("../models/Donation");
const Logistics = require("../models/Logistics");
const User = require("../models/User");
const Request = require("../models/Request");
const NodeCache = require("node-cache");
const donationService = require("../services/donationService");

const statsCache = new NodeCache({ stdTTL: 300 }); // 5 minutes caching


function buildLogisticsVisibilityQuery(role, userId) {
  if (role === "admin") return {};
  if (role === "donor") return { donor: userId };
  if (role === "volunteer") return { volunteer: userId };
  if (role === "ngo") return { ngo: userId };
  return { _id: null };
}

/**
 * GET /api/dashboard/stats
 * Global dashboard KPI statistics — role-aware
 */
exports.getGlobalStats = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id;

    // Cache key specific to user ID to prevent data leakage between users
    const cacheKey = `global_stats_${userId}`;
    const cachedStats = statsCache.get(cacheKey);
    if (cachedStats) {
      return res.status(200).json({
        success: true,
        data: cachedStats,
      });
    }

    let donationFilter = {};
    let requestFilter = {};

    if (role === "donor") {
      donationFilter = { donorId: userId };
      requestFilter.ngoId = userId; // Donors usually don't have requests, but for consistency
    } else if (role === "ngo") {
      donationFilter.$or = [
        { status: { $in: ["pending", "broadcasted"] } },
        { claimedBy: userId }
      ];
      requestFilter.ngoId = userId;
    } else if (role === "volunteer") {
      donationFilter = donationService.buildVolunteerDonationVisibilityQuery(userId);
    }

    const pendingDonationsFilter =
      role === "volunteer"
        ? donationService.buildVolunteerOpenDonationQuery()
        : { ...donationFilter, status: { $in: ["pending", "broadcasted"] } };

    const logisticsVisibilityFilter = buildLogisticsVisibilityQuery(role, userId);

    const [
      totalDonations,
      totalRequests,
      activeVolunteers,
      partnerNgos,
      // Retained for future KPI expansion in dashboard cards.
      pendingDonations,
      completedDonations,
      totalLogistics
    ] = await Promise.all([
      Donation.countDocuments(donationFilter),
      Request.countDocuments(requestFilter).catch(() => 0),
      User.countDocuments({ role: "volunteer" }),
      User.countDocuments({ role: "ngo" }),
      Donation.countDocuments(pendingDonationsFilter),
      Donation.countDocuments({
        ...donationFilter,
        status: { $in: ["completed", "delivered", "closed"] },
      }),
      Logistics.countDocuments(logisticsVisibilityFilter),
    ]);

    // Calculate real meals saved from actual donation impact data
    const scopedImpactMatch = {
      ...donationFilter,
      status: { $in: ["completed", "delivered", "closed"] },
    };
    
    const impactAgg = await Donation.aggregate([
      { $match: scopedImpactMatch },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: ["$impact.estimatedServings", "$impact.estimated_servings"],
            },
          },
        },
      },
    ]);
    const mealsSaved = impactAgg[0]?.total || 0;

    // Active pickups = logistics that are not yet delivered
    let deliveryFilter = { status: { $in: ["assigned", "in_progress"] } };
    if (role !== "admin") {
      deliveryFilter = {
        ...deliveryFilter,
        ...logisticsVisibilityFilter,
      };
    }
    const activePickupsCount = await Logistics.countDocuments(deliveryFilter).catch(() => 0);

    // Pending requests
    const pendingRequests = await Request.countDocuments({
      ...requestFilter,
      status: "pending",
    }).catch(() => 0);

    const responseData = {
      totalDonations,
      activePickups: activePickupsCount,
      foodSaved: mealsSaved,
      activeVolunteers,
      partnerNgos,
      pendingRequests,
      pendingDonations,
      completedDonations,
      totalDeliveries: totalLogistics, // mapped for backward compatibility
      totalRequests,
      impactMetrics: {
        mealsProvided: mealsSaved,
        volunteersEngaged: activeVolunteers
      }
    };

    statsCache.set(cacheKey, responseData);

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/weekly-donations
 * Chronological 7-day donation aggregation from MongoDB.
 * Groups by exact calendar date (YYYY-MM-DD) to prevent
 * merging same weekdays and ensure correct timeline order.
 */
exports.getWeeklyDonations = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id;

    // Build the last 7 calendar days ending on today
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let matchQuery = { createdAt: { $gte: sevenDaysAgo, $lte: today } };

    if (role === "donor") {
      matchQuery.donorId = userId;
    } else if (role === "volunteer") {
      Object.assign(
        matchQuery,
        donationService.buildVolunteerDonationVisibilityQuery(userId),
      );
    } else if (role === "ngo") {
      matchQuery.$or = [
        { claimedBy: userId },
        { status: { $in: ["pending", "broadcasted"] } }
      ];
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const result = await Donation.aggregate(pipeline);

    // Build a map of date -> count from aggregation results
    const countMap = {};
    result.forEach((r) => {
      countMap[r._id] = r.count;
    });

    // Generate exactly 7 chronological date labels and counts
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const labels = [];
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const dayLabel = dayNames[d.getDay()];
      // Show "Mon 28" format for clarity
      labels.push(`${dayLabel} ${d.getDate()}`);
      data.push(countMap[dateKey] || 0);
    }

    res.status(200).json({
      success: true,
      data: { labels, donations: data },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/donations (kept for backward compat — monthly trends)
 */
exports.getDonationTrends = async (req, res, next) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const pipeline = [
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const result = await Donation.aggregate(pipeline);
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    if (result.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
          donations: [120, 150, 200, 180, 220, 260],
        },
      });
    }

    const labels = result.map((r) => monthNames[r._id - 1]);
    const donations = result.map((r) => r.count);

    res.status(200).json({
      success: true,
      data: { labels, donations },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/recent-donations
 */
exports.getRecentActivity = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id;
    let query = {};

    if (role === "donor") {
      query = { donorId: userId };
    } else if (role === "volunteer") {
      query = donationService.buildVolunteerDonationVisibilityQuery(userId);
    } else if (role === "ngo") {
      query.$or = [
        { status: { $in: ["pending", "broadcasted"] } },
        { claimedBy: userId }
      ];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const [recent, total] = await Promise.all([
      Donation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Donation.countDocuments(query)
    ]);

    // Flatten items for table display
    const formatted = recent.map((d) => {
      // Resolve image: top-level first, then first item's image
      let imageUrl = d.image || null;
      if (!imageUrl && Array.isArray(d.items)) {
        for (const item of d.items) {
          if (item.image) {
            imageUrl = item.image;
            break;
          }
        }
      }

      return {
        _id: d._id,
        donorName: d.donorName || "Unknown",
        image: imageUrl,
        items: d.items?.map((i) => i.itemName).join(", ") || "Food Items",
        quantity:
          d.items?.map((i) => `${i.quantity} ${i.unit}`).join(", ") || "-",
        status: d.status || "pending",
        city: d.city,
        createdAt: d.createdAt,
        notes: d.notes || d.specialNotes || null,
      };
    });

    res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/recent-deliveries
 */
exports.getRecentDeliveries = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    const deliveryQuery = {
      status: "delivered",
      ...buildLogisticsVisibilityQuery(role, userId),
    };

    const [recent, total] = await Promise.all([
      Logistics.find(deliveryQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("donation", "donorName items")
        .lean(),
      Logistics.countDocuments(deliveryQuery)
    ]);

    res.status(200).json({
      success: true,
      data: recent,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/requests
 * List requests (NGO sees own, admin sees all)
 */
exports.getRequests = async (req, res, next) => {
  try {
    const role = req.user?.role;
    let filter = {};
    if (role === "ngo") {
      filter.ngoId = req.user._id;
    }
    // Donors, volunteers, and admins can view all requests by default.

    const requests = await Request.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/dashboard/requests
 * NGO creates a food request
 */
exports.createRequest = async (req, res, next) => {
  try {
    const { foodNeeded, quantity, location, urgency, notes } = req.body;

    const request = await Request.create({
      ngoId: req.user._id,
      ngoName: req.user.name || `${req.user.firstName} ${req.user.lastName}`,
      foodNeeded,
      quantity,
      location,
      urgency: urgency || "medium",
      notes,
    });

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/users (admin only)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const roleFilter = req.query.role ? { role: req.query.role } : {};

    const [users, total] = await Promise.all([
      User.find(roleFilter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(roleFilter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/reports (admin only)
 */
exports.getSystemReports = async (req, res, next) => {
  try {
    const [donationsByStatus, usersByRole, deliveriesByStatus] =
      await Promise.all([
        Donation.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
        Logistics.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);

    res.status(200).json({
      success: true,
      data: {
        donationsByStatus,
        usersByRole,
        deliveriesByStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};
