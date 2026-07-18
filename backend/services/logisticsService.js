const Donation = require("../models/Donation");
const Logistics = require("../models/Logistics");
const Request = require("../models/Request");
const MealServer = require("../models/MealServer");
const InventoryLog = require("../models/InventoryLog");
const { sendNotification } = require("../utils/notification");
const logger = require("../config/logger");

/**
 * Logistics Service
 * Centralizes the state machine logic for Donations, Logistics, and Claims.
 * Ensures data consistency across multiple collections.
 */
class LogisticsService {
  /**
   * Validates if a donation status transition is allowed.
   */
  validateDonationTransition(currentStatus, newStatus) {
    const transitions = {
      pending: ["broadcasted", "claimed", "cancelled"],
      broadcasted: ["claimed", "cancelled"],
      claimed: ["accepted", "cancelled"],
      accepted: ["picked_up", "cancelled"],
      picked_up: ["in_transit", "delivered", "closed", "cancelled"],
      in_transit: ["delivered", "closed", "cancelled"],
      delivered: ["closed", "completed", "cancelled"],
      closed: ["completed"],
      completed: [],
      cancelled: [],
    };

    const allowed = transitions[currentStatus] || [];
    return allowed.includes(newStatus);
  }

  /**
   * Handles a status change for a donation and syncs associated records.
   */
  async updateDonationStatus(donationId, newStatus, user, notes = "", session = null) {
    let donation = await Donation.findById(donationId).session(session);
    if (!donation) throw new Error("Donation not found");

    if (!this.validateDonationTransition(donation.status, newStatus)) {
      throw new Error(`Invalid status transition from ${donation.status} to ${newStatus}`);
    }

    const actorId = user._id || user.id;
    const userIdStr = String(actorId);
    const userRole = String(user.role || "").toLowerCase().trim();

    // Atomic locks for critical assignments
    if (newStatus === "accepted") {
      if (userRole !== "volunteer") {
        throw new Error("Only volunteers can accept pickups.");
      }
      // Attempt atomic lock
      const lockedDonation = await Donation.findOneAndUpdate(
        {
          _id: donationId,
          status: "claimed",
          assignedVolunteer: null,
        },
        { assignedVolunteer: actorId },
        { session, new: true }
      );
      if (!lockedDonation) {
        throw new Error("This donation pickup has already been accepted by another volunteer.");
      }
      donation = lockedDonation;
    } else if (newStatus === "picked_up" || newStatus === "delivered") {
      const assignedVolunteerId =
        donation.assignedVolunteer || donation.assigned_volunteer;
      if (userRole !== "admin" && String(assignedVolunteerId) !== userIdStr) {
        throw new Error("Only the assigned volunteer can update delivery progress.");
      }
    } else if (newStatus === "cancelled") {
      const donorId = donation.donorId;
      const isDonor = String(donorId) === userIdStr;
      if (userRole !== "admin" && !isDonor) {
        throw new Error("Only the donor or an admin can cancel this donation.");
      }
    } else if (newStatus === "closed") {
      const claimedById = donation.claimedBy?._id ? donation.claimedBy._id.toString() : donation.claimedBy?.toString();
      if (userRole !== "admin" && claimedById !== userIdStr) {
        throw new Error("Only the claiming NGO can confirm receipt.");
      }
      // NGO confirms receipt
      await this.handleFulfillment(donation, donation.claimedBy || actorId, session);
    }

    // Sync with Logistics record if it exists
    const logistics = await Logistics.findOne({ donation: donation._id }).session(session);
    if (logistics) {
      this.syncLogisticsStatus(logistics, donation, newStatus, actorId);
      await logistics.save({ session });
    }

    // Update donation status and history using findOneAndUpdate to avoid versioning conflicts
    const statusUpdate = { status: newStatus };
    if (newStatus === "cancelled") {
      statusUpdate.cancelledBy = actorId;
      if (notes) {
        statusUpdate.cancellationReason = notes;
      }
    }

    donation = await Donation.findOneAndUpdate(
      { _id: donationId },
      {
        $set: statusUpdate,
        $push: {
          statusHistory: {
            status: newStatus,
            timestamp: new Date(),
            updatedBy: actorId,
            notes,
          }
        }
      },
      { session, new: true }
    );

    // Send notifications (Async, don't block)
    this.notifyStatusChange(donation, newStatus);

    return donation;
  }

  /**
   * Syncs Logistics status based on Donation status
   */
  syncLogisticsStatus(logistics, donation, donationStatus, userId) {
    switch (donationStatus) {
      case "accepted":
        logistics.status = "assigned";
        logistics.volunteer = userId;
        break;
      case "picked_up":
        logistics.status = "in_progress";
        break;
      case "delivered":
      case "closed":
      case "completed":
        logistics.status = "delivered";
        if (!logistics.deliveryTime) logistics.deliveryTime = new Date();
        break;
      case "cancelled":
        logistics.status = "cancelled";
        break;
    }
  }

  /**
   * Creates a Logistics record when a donation is claimed.
   */
  async handleDonationClaim(donation, claim, ngoId, session) {
    // Generate Logistics automatically
    const logistics = await Logistics.create([{
      donation: donation._id,
      donor: donation.donorId,
      ngo: ngoId,
      status: "pending_assignment",
      pickupTime: donation.pickupDatetime,
      notes: `Pickup from: ${donation.address || ""}, ${donation.city || ""}`
    }], { session });

    donation.status = "claimed";
    donation.claimedBy = ngoId;
    donation.statusHistory.push({
      status: "claimed",
      timestamp: new Date(),
      updatedBy: ngoId,
      notes: "Donation claimed by NGO"
    });

    await donation.save({ session });
    return logistics[0];
  }

  /**
   * Handles a status change for logistics and syncs associated records.
   */
   async updateLogisticsStatus(logisticsId, newStatus, user, session = null) {
    const logistics = await Logistics.findById(logisticsId).session(session);
    if (!logistics) throw new Error("Logistics not found");

    if (logistics.volunteer.toString() !== user.id) {
      throw new Error("Not authorized to update this logistics record");
    }

    logistics.status = newStatus;
    if (newStatus === "delivered") {
      logistics.deliveryTime = new Date();
    }

    await logistics.save({ session });

    // Sync with Donation record
    const donation = await Donation.findById(logistics.donation).session(session);
    if (donation) {
      let donationStatus = donation.status;
      if (newStatus === "in_progress") donationStatus = "picked_up";
      if (newStatus === "delivered") donationStatus = "delivered"; // Removed auto-closed to allow NGO to confirm
      if (newStatus === "cancelled") donationStatus = "cancelled";

      if (donationStatus !== donation.status) {
        donation.status = donationStatus;
        donation.statusHistory.push({
          status: donationStatus,
          timestamp: new Date(),
          updatedBy: user.id,
          notes: `Status updated via logistics transition to ${newStatus}`,
        });
        await donation.save({ session });

        // Notify relevant parties about the status change
        this.notifyStatusChange(donation, donationStatus);
      }
    }

    return { logistics, donation };
  }



  /**
   * Handles side effects of a completed handoff (Inventory and Requests).
   */
  async handleFulfillment(donation, ngoId, session) {
    // 1. Auto-fulfill matching requests for this NGO
    await this.fulfillMatchingRequests(donation, ngoId, session);

    // 2. Log into Meal Server inventory
    await this.logInventoryArrival(donation, ngoId, session);
  }

  /**
   * Finds matching pending requests for an NGO and marks them as fulfilled.
   */
  async fulfillMatchingRequests(donation, ngoId, session) {
    const items = donation.items || [];
    const itemNames = items.map(i => new RegExp(i.itemName, "i"));

    // Find pending requests from this NGO that match any item in the donation
    const requests = await Request.find({
      ngoId,
      status: "pending",
      foodNeeded: { $in: itemNames }
    }).session(session);

    for (const req of requests) {
      req.status = "fulfilled";
      await req.save({ session });
      
      logger.info(`[Logistics] Auto-fulfilled request ${req._id} for NGO ${ngoId}`);
    }
  }

  /**
   * Logs the donated items into the NGO's default meal server inventory.
   */
  async logInventoryArrival(donation, ngoId, session) {
    // Find the NGO's default meal server (first active one in their city)
    const mealServer = await MealServer.findOne({
      ngoId: ngoId,
      active: true,
      city: donation.city
    }).session(session);

    if (!mealServer) {
      logger.info(`[Logistics] No active meal server found for NGO ${ngoId} in ${donation.city}. Skipping inventory log.`);
      return;
    }

    const logs = donation.items.map(item => ({
      mealServer: mealServer._id,
      donationId: donation._id,
      itemName: item.itemName,
      category: item.category || "Other",
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit || "kg",
      operationType: "received",
      loggedBy: ngoId,
      city: donation.city,
      notes: `Donation received from ${donation.donorName}`
    }));

    if (logs.length > 0) {
      await InventoryLog.insertMany(logs, { session });
      console.log(`[Logistics] Logged ${logs.length} items to MealServer ${mealServer.organization_name}`);
    }
  }

  /**
   * Notifies relevant parties about a status change.
   */
  notifyStatusChange(donation, status) {
    const donorMessages = {
      claimed: "Your donation has been claimed by an NGO.",
      accepted: "A volunteer has been assigned to pick up your donation.",
      picked_up: "Your donation has been picked up and is on its way.",
      delivered: "Your donation has been successfully delivered.",
      closed: "The donation cycle is now complete.",
    };

    const ngoMessages = {
      accepted: "A volunteer has been assigned to pick up the donation.",
      picked_up: "The donation has been picked up and is on its way.",
      delivered: "The donation has been successfully delivered to your facility.",
      closed: "The donation cycle is now complete.",
    };

    const volunteerMessages = {
      delivered: "You successfully delivered the donation. Thank you!",
      closed: "The donation cycle you helped with is now complete.",
    };

    // Notify Donor
    if (donorMessages[status] && donation.donorId) {
      sendNotification(donation.donorId, {
        title: "Donation Update",
        message: donorMessages[status],
        type: "status_update",
        relatedId: donation._id,
        relatedModel: "Donation"
      });
    }

    // Notify Claiming NGO
    if (ngoMessages[status] && donation.claimedBy) {
      sendNotification(donation.claimedBy, {
        title: "Logistics Update",
        message: ngoMessages[status],
        type: "status_update",
        relatedId: donation._id,
        relatedModel: "Donation"
      });
    }

    // Notify Assigned Volunteer
    const volunteerId = donation.assignedVolunteer;
    if (volunteerMessages[status] && volunteerId) {
      sendNotification(volunteerId, {
        title: "Delivery Update",
        message: volunteerMessages[status],
        type: "status_update",
        relatedId: donation._id,
        relatedModel: "Donation"
      });
    }
  }
}

module.exports = new LogisticsService();
