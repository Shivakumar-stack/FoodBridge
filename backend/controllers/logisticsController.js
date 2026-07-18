const mongoose = require("mongoose");
const Logistics = require("../models/Logistics");
const User = require("../models/User");
const logisticsService = require("../services/logisticsService");
const routeService = require("../services/routeService");


// @desc    Assign a volunteer to a logistics
// @route   PUT /api/logistics/:id/assign
// @access  Private (Admin)
exports.assignVolunteerToLogistics = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const logistics = await Logistics.findById(req.params.id).session(session);

    if (!logistics) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Logistics not found" });
    }

    const { volunteerId } = req.body;
    const volunteer = await User.findById(volunteerId).session(session);

    if (!volunteer || volunteer.role !== "volunteer") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    // In our system, assigning a volunteer to logistics is equivalent to the donation being 'accepted' by that volunteer
    const updatedDonation = await logisticsService.updateDonationStatus(
      logistics.donation,
      "accepted",
      volunteer, // Pass the volunteer object as the user context
      "Assigned by admin",
      session
    );

    await session.commitTransaction();
    session.endSession();

    // Emit real-time event for live map
    const io = req.app.get("io");
    if (io) {
      io.emit("donationStatusUpdated", {
        _id: updatedDonation._id,
        status: updatedDonation.status,
        assignedVolunteer: volunteerId,
      });
    }

    res.json({ success: true, data: updatedDonation });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("Assign volunteer error:", error);
    res.status(error.status || 500).json({ 
      success: false, 
      message: error.message || "Server Error" 
    });
  }
};


// @desc    Update logistics status
// @route   PUT /api/logistics/:id/status
// @access  Private (Volunteer)
exports.updateLogisticsStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const logistics = await Logistics.findById(req.params.id).session(session);

    if (!logistics) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Logistics not found" });
    }

    // Make sure the logged in user is the assigned volunteer
    if (!logistics.volunteer || logistics.volunteer.toString() !== (req.user._id || req.user.id).toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this logistics",
      });
    }

    const { status } = req.body;

    const { logistics: updatedLogistics, donation } = await logisticsService.updateLogisticsStatus(
      req.params.id,
      status,
      req.user,
      session
    );

    await session.commitTransaction();
    session.endSession();

    // Emit real-time event for live map
    const io = req.app.get("io");
    if (io && donation) {
      io.emit("donationStatusUpdated", {
        _id: donation._id,
        status: donation.status,
      });
    }

    res.json({ success: true, data: updatedLogistics });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("Update logistics status error:", error);
    res.status(error.status || 500).json({ 
      success: false, 
      message: error.message || "Server Error" 
    });
  }
};


// @desc    Get all logistics for the logged in volunteer
// @route   GET /api/logistics/my-logistics
// @access  Private (Volunteer)
exports.getMyLogistics = async (req, res) => {
  try {
    const logistics = await Logistics.find({ volunteer: req.user.id }).populate({
      path: "donation",
      select: "address items city state zip",
    });

    // Mapbox Algorithmic Routing Integration
    if (logistics.length > 1) {
      // Simulating passing multiple pickup locations to the API
      const waypoints = logistics.map(l => l.pickupLocation || l.donation?.address);
      const optimizedRoute = await routeService.optimizeVolunteerRoute(null, null, waypoints);
      
      return res.json({ 
        success: true, 
        data: logistics,
        optimization: optimizedRoute
      });
    }

    res.json({ success: true, data: logistics });
  } catch (error) {
    console.error("Get my logistics error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get all logistics
// @route   GET /api/logistics
// @access  Private (Admin)
exports.getAllLogistics = async (req, res) => {
  try {
    const logistics = await Logistics.find().populate(
      "donation volunteer assignedBy",
    );
    res.json({ success: true, data: logistics });
  } catch (error) {
    console.error("Get all logistics error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
