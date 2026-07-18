const mongoose = require("mongoose");
const dns = require("dns");
require("dotenv").config();

const User = require("../backend/models/User");
const Donation = require("../backend/models/Donation");
const Claim = require("../backend/models/Claim");
const Logistics = require("../backend/models/Logistics");
const donationService = require("../backend/services/donationService");

const PASSWORD = "Password@123";
const DEMO_TAG = "DEMO_SEED";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (_error) {
  // Native resolver fallback is fine.
}

function futureHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function upsertUser(user) {
  let doc = await User.findOne({ email: user.email }).select("+password");
  if (!doc) {
    doc = new User(user);
  } else {
    Object.assign(doc, user);
  }
  doc.password = PASSWORD;
  doc.status = "active";
  doc.isEmailVerified = true;
  await doc.save();
  return doc;
}

async function createDonation(template, users) {
  const donor = users[template.donor];
  const ngo = template.ngo ? users[template.ngo] : null;
  const volunteer = template.volunteer ? users[template.volunteer] : null;

  const donation = new Donation({
    donorId: donor._id,
    donorName: donor.organization?.name || donor.name,
    claimedBy: ngo?._id || null,
    assignedVolunteer: volunteer?._id || null,
    items: template.items,
    address: template.address,
    city: template.city,
    state: "Karnataka",
    zip: template.zip,
    lat: template.lat,
    lng: template.lng,
    pickupDatetime: template.pickupDatetime,
    status: template.status,
    priority: template.priority,
    notes: `${DEMO_TAG}: ${template.notes}`,
    impact: {
      estimatedServings: template.servings,
      weightKg: template.weightKg,
      co2Saved: Math.round(template.servings * 0.5),
    },
    statusHistory: [
      {
        status: "pending",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedBy: donor._id,
        notes: "Demo donation created",
      },
    ],
  });

  if (template.status !== "pending") {
    donation.statusHistory.push({
      status: template.status,
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      updatedBy: ngo?._id || volunteer?._id || donor._id,
      notes: `Demo status set to ${template.status}`,
    });
  }

  donation.priorityScore = donationService.calculatePriorityScore(donation);
  await donation.save();

  if (ngo) {
    await Claim.create({
      donation: donation._id,
      ngo: ngo._id,
      status: "approved",
      notes: "Demo approved claim",
    });
  }

  if (ngo || volunteer) {
    const logisticsStatus =
      template.status === "claimed"
        ? "pending_assignment"
        : ["accepted"].includes(template.status)
          ? "assigned"
          : ["picked_up", "in_transit"].includes(template.status)
            ? "in_progress"
            : ["delivered", "closed", "completed"].includes(template.status)
              ? "delivered"
              : "pending_assignment";

    await Logistics.create({
      donation: donation._id,
      donor: donor._id,
      ngo: ngo?._id || null,
      volunteer: volunteer?._id || undefined,
      status: logisticsStatus,
      pickupTime: template.pickupDatetime,
      deliveryTime: logisticsStatus === "delivered" ? new Date() : undefined,
      dropoffLocation: ngo
        ? {
            address: `${ngo.organization?.name || ngo.name} Distribution Center`,
            city: template.city,
            state: "Karnataka",
            zipCode: template.zip,
          }
        : undefined,
      notes: "Demo logistics record",
    });
  }

  return donation;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGO_URI or MONGODB_URI is required.");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const oldDemoDonations = await Donation.find({
    notes: new RegExp(`^${DEMO_TAG}:`),
  }).select("_id");
  const oldDonationIds = oldDemoDonations.map((donation) => donation._id);
  if (oldDonationIds.length) {
    await Promise.all([
      Claim.deleteMany({ donation: { $in: oldDonationIds } }),
      Logistics.deleteMany({ donation: { $in: oldDonationIds } }),
      Donation.deleteMany({ _id: { $in: oldDonationIds } }),
    ]);
  }

  const users = {};
  users.admin = await upsertUser({
    name: "Demo Admin",
    firstName: "Demo",
    lastName: "Admin",
    email: "admin@foodbridge.demo",
    role: "admin",
    phone: "9000000001",
    city: "Bangalore",
  });
  users.ngo = await upsertUser({
    name: "Akshaya Demo Trust",
    firstName: "Akshaya",
    lastName: "Trust",
    email: "ngo@foodbridge.demo",
    role: "ngo",
    phone: "9000000002",
    city: "Bangalore",
    organization: { name: "Akshaya Demo Trust", type: "ngo" },
    ngoInfo: { mission: "Serve surplus meals to shelters", isVerified: true },
  });
  users.volunteer = await upsertUser({
    name: "Demo Volunteer",
    firstName: "Demo",
    lastName: "Volunteer",
    email: "volunteer@foodbridge.demo",
    role: "volunteer",
    phone: "9000000003",
    city: "Bangalore",
    volunteerInfo: {
      isAvailable: true,
      vehicleType: "motorcycle",
      serviceArea: ["Bangalore", "Indiranagar", "Koramangala"],
    },
  });
  users.donor = await upsertUser({
    name: "Demo Kitchen",
    firstName: "Demo",
    lastName: "Kitchen",
    email: "donor@foodbridge.demo",
    role: "donor",
    phone: "9000000004",
    city: "Bangalore",
    organization: { name: "Demo Kitchen", type: "restaurant" },
    donorInfo: { isVerified: true, totalDonations: 24 },
  });
  users.donor2 = await upsertUser({
    name: "Campus Canteen",
    firstName: "Campus",
    lastName: "Canteen",
    email: "donor2@foodbridge.demo",
    role: "donor",
    phone: "9000000005",
    city: "Mysore",
    organization: { name: "Campus Canteen", type: "corporate" },
    donorInfo: { isVerified: true, totalDonations: 12 },
  });

  const templates = [
    {
      donor: "donor",
      status: "pending",
      priority: "critical",
      city: "Bangalore",
      address: "MG Road, Bangalore",
      zip: "560001",
      lat: 12.9716,
      lng: 77.5946,
      pickupDatetime: futureHours(2),
      items: [{ itemName: "Vegetable Biryani", category: "Cooked Food", quantity: "45", unit: "kg", servings: 280 }],
      servings: 280,
      weightKg: 45,
      notes: "Fresh lunch surplus ready for NGO claim",
    },
    {
      donor: "donor2",
      ngo: "ngo",
      status: "claimed",
      priority: "high",
      city: "Mysore",
      address: "Gokulam Main Road, Mysore",
      zip: "570002",
      lat: 12.3051,
      lng: 76.6551,
      pickupDatetime: futureHours(4),
      items: [{ itemName: "Chapati and Dal", category: "Cooked Food", quantity: "120", unit: "meals", servings: 120 }],
      servings: 120,
      weightKg: 30,
      notes: "Claimed by NGO and waiting for volunteer acceptance",
    },
    {
      donor: "donor",
      ngo: "ngo",
      volunteer: "volunteer",
      status: "accepted",
      priority: "medium",
      city: "Bangalore",
      address: "Indiranagar, Bangalore",
      zip: "560038",
      lat: 12.9784,
      lng: 77.6408,
      pickupDatetime: futureHours(1),
      items: [{ itemName: "Fruit Boxes", category: "Fruits", quantity: "35", unit: "boxes", servings: 140 }],
      servings: 140,
      weightKg: 25,
      notes: "Volunteer assigned and ready to mark picked up",
    },
    {
      donor: "donor",
      ngo: "ngo",
      volunteer: "volunteer",
      status: "picked_up",
      priority: "medium",
      city: "Bangalore",
      address: "Koramangala, Bangalore",
      zip: "560034",
      lat: 12.9352,
      lng: 77.6245,
      pickupDatetime: futureHours(0.5),
      items: [{ itemName: "Packed Sandwiches", category: "Packaged", quantity: "90", unit: "packs", servings: 90 }],
      servings: 90,
      weightKg: 18,
      notes: "In field transit and ready to mark delivered",
    },
    {
      donor: "donor2",
      ngo: "ngo",
      volunteer: "volunteer",
      status: "delivered",
      priority: "low",
      city: "Mysore",
      address: "VV Mohalla, Mysore",
      zip: "570002",
      lat: 12.3212,
      lng: 76.6421,
      pickupDatetime: futureHours(-2),
      items: [{ itemName: "Milk and Bread", category: "Dairy", quantity: "60", unit: "sets", servings: 60 }],
      servings: 60,
      weightKg: 20,
      notes: "Delivered and waiting for NGO receipt confirmation",
    },
  ];

  const donations = [];
  for (const template of templates) {
    donations.push(await createDonation(template, users));
  }

  console.log("Demo population ready.");
  console.log("Accounts:");
  console.log("  admin@foodbridge.demo / Password@123");
  console.log("  ngo@foodbridge.demo / Password@123");
  console.log("  volunteer@foodbridge.demo / Password@123");
  console.log("  donor@foodbridge.demo / Password@123");
  console.log(`Seeded ${donations.length} demo donations.`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Demo seed failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // Ignore disconnect failure.
  }
  process.exit(1);
});
