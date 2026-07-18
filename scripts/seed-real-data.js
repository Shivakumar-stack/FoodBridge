/**
 * seed-real-data.js
 * Purges ALL collections and seeds realistic demo data for FoodBridge.
 * Date range: January 2026 – May 10, 2026
 * Usage: node scripts/seed-real-data.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../backend/models/User");
const Donation = require("../backend/models/Donation");
const Claim = require("../backend/models/Claim");
const Logistics = require("../backend/models/Logistics");
const Notification = require("../backend/models/Notification");
const MealServer = require("../backend/models/MealServer");
const InventoryLog = require("../backend/models/InventoryLog");

// ── helpers ──────────────────────────────────────────────────────────
const PASSWORD = "Password@123";
const hashPw = async () => bcrypt.hash(PASSWORD, 12);

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const CITIES = [
  { city: "Bangalore", state: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946 },
  { city: "Mysore", state: "Karnataka", zip: "570001", lat: 12.2958, lng: 76.6394 },
  { city: "Hubli", state: "Karnataka", zip: "580020", lat: 15.3647, lng: 75.1240 },
  { city: "Mangalore", state: "Karnataka", zip: "575001", lat: 12.9141, lng: 74.8560 },
  { city: "Belgaum", state: "Karnataka", zip: "590001", lat: 15.8497, lng: 74.4977 },
  { city: "Davanagere", state: "Karnataka", zip: "577001", lat: 14.4644, lng: 75.9218 },
  { city: "Shimoga", state: "Karnataka", zip: "577201", lat: 13.9299, lng: 75.5681 },
  { city: "Udupi", state: "Karnataka", zip: "576101", lat: 13.3409, lng: 74.7971 },
];

const STREETS = [
  "MG Road", "Brigade Road", "Jayanagar 4th Block", "Koramangala 5th Block",
  "Rajajinagar 1st Block", "Indiranagar 100ft Road", "Basavanagudi Bull Temple Rd",
  "Whitefield Main Road", "Electronic City Phase 1", "HSR Layout Sector 2",
  "Vijayanagar Main Road", "Sayyaji Rao Road", "Lamington Road", "Station Road",
  "KR Circle", "Mahatma Gandhi Road", "Commercial Street", "Residency Road",
];

const FOOD_ITEMS = [
  { itemName: "Vegetable Biryani", category: "Cooked Food", unit: "servings" },
  { itemName: "Chapati with Dal", category: "Cooked Food", unit: "plates" },
  { itemName: "Sambar Rice", category: "Cooked Food", unit: "servings" },
  { itemName: "Idli Vada Combo", category: "Cooked Food", unit: "plates" },
  { itemName: "Pulao with Raita", category: "Cooked Food", unit: "servings" },
  { itemName: "Curd Rice", category: "Cooked Food", unit: "bowls" },
  { itemName: "Rice Bags (5kg)", category: "Raw Ingredients", unit: "bags" },
  { itemName: "Wheat Flour (10kg)", category: "Raw Ingredients", unit: "bags" },
  { itemName: "Toor Dal (2kg)", category: "Raw Ingredients", unit: "packets" },
  { itemName: "Mixed Vegetables", category: "Vegetables", unit: "kg" },
  { itemName: "Tomatoes", category: "Vegetables", unit: "kg" },
  { itemName: "Onions", category: "Vegetables", unit: "kg" },
  { itemName: "Bananas", category: "Fruits", unit: "dozen" },
  { itemName: "Apples", category: "Fruits", unit: "kg" },
  { itemName: "Milk Packets (500ml)", category: "Dairy", unit: "packets" },
  { itemName: "Paneer (200g blocks)", category: "Dairy", unit: "blocks" },
  { itemName: "Bread Loaves", category: "Baked Goods", unit: "loaves" },
  { itemName: "Biscuit Packets", category: "Packaged", unit: "packets" },
  { itemName: "Juice Tetra Packs", category: "Beverages", unit: "packs" },
  { itemName: "Buttermilk (1L)", category: "Beverages", unit: "bottles" },
];

// ── user definitions ─────────────────────────────────────────────────
const USERS = [
  // Admin
  { firstName: "Rajesh", lastName: "Kumar", email: "admin@foodbridge.org", role: "admin",
    phone: "+91 9845012345", org: { name: "FoodBridge Admin", type: "other" },
    cityIdx: 0, street: "MG Road" },

  // Donors (6)
  { firstName: "Ananya", lastName: "Sharma", email: "ananya.sharma@gmail.com", role: "donor",
    phone: "+91 9900123456", org: { name: "Taj West End Hotel", type: "hotel" },
    cityIdx: 0, street: "Race Course Road" },
  { firstName: "Vikram", lastName: "Reddy", email: "vikram.reddy@outlook.com", role: "donor",
    phone: "+91 9880234567", org: { name: "Radisson Blu Bangalore", type: "hotel" },
    cityIdx: 0, street: "Rajajinagar 1st Block" },
  { firstName: "Priya", lastName: "Nair", email: "priya.nair@yahoo.com", role: "donor",
    phone: "+91 9741345678", org: { name: "Cafe Coffee Day Corporate", type: "corporate" },
    cityIdx: 1, street: "Sayyaji Rao Road" },
  { firstName: "Suresh", lastName: "Gowda", email: "suresh.gowda@gmail.com", role: "donor",
    phone: "+91 8050456789", org: { name: "MTR Foods Pvt Ltd", type: "restaurant" },
    cityIdx: 0, street: "Lalbagh Road" },
  { firstName: "Deepa", lastName: "Hegde", email: "deepa.hegde@gmail.com", role: "donor",
    phone: "+91 7349567890", org: { name: "Udupi Sri Krishna Bhavan", type: "restaurant" },
    cityIdx: 7, street: "Car Street" },
  { firstName: "Karthik", lastName: "Rao", email: "karthik.rao@hotmail.com", role: "donor",
    phone: "+91 9632678901", org: { name: "Hubli Grand Hotel", type: "hotel" },
    cityIdx: 2, street: "Lamington Road" },

  // NGOs (4)
  { firstName: "Meenakshi", lastName: "Iyer", email: "meenakshi@akshayapatra.org", role: "ngo",
    phone: "+91 8042789012", org: { name: "Akshaya Patra Foundation", type: "ngo" },
    cityIdx: 0, street: "Rajajinagar" },
  { firstName: "Abdul", lastName: "Rasheed", email: "abdul@feedingindia.org", role: "ngo",
    phone: "+91 9538890123", org: { name: "Feeding India", type: "ngo" },
    cityIdx: 1, street: "Gokulam Main Road" },
  { firstName: "Lakshmi", lastName: "Devi", email: "lakshmi@robinhood.ngo", role: "ngo",
    phone: "+91 8722901234", org: { name: "Robin Hood Army Karnataka", type: "ngo" },
    cityIdx: 2, street: "Station Road" },
  { firstName: "Naveen", lastName: "Shetty", email: "naveen@annapoorna.org", role: "ngo",
    phone: "+91 9845012346", org: { name: "Annapoorna Trust", type: "ngo" },
    cityIdx: 4, street: "Camp Road" },

  // Volunteers (5)
  { firstName: "Amit", lastName: "Patil", email: "amit.patil@gmail.com", role: "volunteer",
    phone: "+91 9986123450", vehicle: "motorcycle", cityIdx: 0 },
  { firstName: "Sneha", lastName: "Kulkarni", email: "sneha.kulkarni@gmail.com", role: "volunteer",
    phone: "+91 8904234561", vehicle: "car", cityIdx: 0 },
  { firstName: "Rahul", lastName: "Joshi", email: "rahul.joshi@outlook.com", role: "volunteer",
    phone: "+91 7760345672", vehicle: "bicycle", cityIdx: 1 },
  { firstName: "Divya", lastName: "Bhat", email: "divya.bhat@gmail.com", role: "volunteer",
    phone: "+91 9449456783", vehicle: "motorcycle", cityIdx: 2 },
  { firstName: "Manoj", lastName: "Gowda", email: "manoj.gowda@yahoo.com", role: "volunteer",
    phone: "+91 8310567894", vehicle: "car", cityIdx: 4 },
];

// ── Main Seed ────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Purge all collections
  const collections = [User, Donation, Claim, Logistics, Notification, MealServer, InventoryLog];
  for (const Model of collections) {
    await Model.deleteMany({});
  }
  // Also clear any other collections
  try { await mongoose.connection.db.collection("contacts").deleteMany({}); } catch (_) { /* ignore error if collection does not exist */ }
  try { await mongoose.connection.db.collection("requests").deleteMany({}); } catch (_) { /* ignore error if collection does not exist */ }
  try { await mongoose.connection.db.collection("deliveries").deleteMany({}); } catch (_) { /* ignore error if collection does not exist */ }
  try { await mongoose.connection.db.collection("pickups").deleteMany({}); } catch (_) { /* ignore error if collection does not exist */ }
  console.log("All collections purged.");

  const hashed = await hashPw();

  // ── Create Users ───────────────────────────────────────────────────
  const createdUsers = [];
  for (const u of USERS) {
    const loc = CITIES[u.cityIdx];
    const user = await User.create({
      firstName: u.firstName,
      lastName: u.lastName,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      password: hashed,
      phone: u.phone,
      role: u.role,
      city: loc.city,
      organization: u.org ? { name: u.org.name, type: u.org.type } : undefined,
      address: {
        street: u.street || pick(STREETS),
        city: loc.city,
        state: loc.state,
        zipCode: loc.zip,
        country: "India",
      },
      volunteerInfo: u.role === "volunteer" ? {
        isAvailable: true,
        vehicleType: u.vehicle || "none",
        serviceArea: [loc.city],
        completedPickups: rand(5, 40),
        rating: (4 + Math.random()).toFixed(1),
      } : undefined,
      donorInfo: u.role === "donor" ? {
        totalDonations: rand(5, 30),
        mealsProvided: rand(200, 5000),
        isVerified: true,
      } : undefined,
      ngoInfo: u.role === "ngo" ? {
        mission: `Providing meals to underprivileged communities in ${loc.city}`,
        beneficiaries: rand(500, 10000),
        isVerified: true,
      } : undefined,
      status: "active",
      isEmailVerified: true,
      createdAt: randomDate(new Date("2025-11-01"), new Date("2026-01-15")),
    });
    createdUsers.push(user);
  }

  const admin = createdUsers.find(u => u.role === "admin");
  const donors = createdUsers.filter(u => u.role === "donor");
  const ngos = createdUsers.filter(u => u.role === "ngo");
  const volunteers = createdUsers.filter(u => u.role === "volunteer");

  console.log(`Created ${createdUsers.length} users (1 admin, ${donors.length} donors, ${ngos.length} NGOs, ${volunteers.length} volunteers)`);

  // ── Create Meal Servers for NGOs ───────────────────────────────────
  for (const ngo of ngos) {
    const loc = CITIES[USERS.find(u => u.email === ngo.email).cityIdx];
    await MealServer.create({
      ngoId: ngo._id,
      organization_name: ngo.organization.name,
      contact_person: `${ngo.firstName} ${ngo.lastName}`,
      phone: ngo.phone,
      city: loc.city,
      lat: loc.lat + (Math.random() - 0.5) * 0.02,
      lng: loc.lng + (Math.random() - 0.5) * 0.02,
      address: `${pick(STREETS)}, ${loc.city}`,
      capacity: rand(200, 1000),
      mealsServedDaily: rand(50, 300),
      operatingHours: { open: "08:00", close: "20:00" },
      active: true,
    });
  }
  console.log(`Created ${ngos.length} meal servers.`);

  // ── Create Donations ───────────────────────────────────────────────
  const START = new Date("2026-01-05");
  const END = new Date("2026-05-10");
  const TOTAL_DONATIONS = 45;

  // Status distribution
  const statusPlan = [
    ...Array(5).fill("pending"),
    ...Array(3).fill("broadcasted"),
    ...Array(4).fill("claimed"),
    ...Array(4).fill("accepted"),
    ...Array(3).fill("picked_up"),
    ...Array(2).fill("in_transit"),
    ...Array(8).fill("delivered"),
    ...Array(8).fill("closed"),
    ...Array(3).fill("completed"),
    ...Array(5).fill("cancelled"),
  ];

  const allDonations = [];
  const allClaims = [];
  const allLogistics = [];
  const allNotifications = [];
  const allInventoryLogs = [];

  for (let i = 0; i < TOTAL_DONATIONS; i++) {
    const donor = pick(donors);
    const donorDef = USERS.find(u => u.email === donor.email);
    const loc = CITIES[donorDef.cityIdx];
    const status = statusPlan[i] || pick(["pending", "closed"]);
    const createdAt = randomDate(START, END);
    const pickupDatetime = new Date(createdAt.getTime() + rand(2, 48) * 3600000);

    // Pick 1-3 food items
    const numItems = rand(1, 3);
    const itemSet = new Set();
    while (itemSet.size < numItems) itemSet.add(pick(FOOD_ITEMS));
    const items = Array.from(itemSet).map(fi => ({
      itemName: fi.itemName,
      category: fi.category,
      quantity: String(rand(5, 80)),
      unit: fi.unit,
      servings: rand(10, 200),
    }));

    const totalServings = items.reduce((s, it) => s + it.servings, 0);
    const jitterLat = (Math.random() - 0.5) * 0.04;
    const jitterLng = (Math.random() - 0.5) * 0.04;

    const statusHistory = [{ status: "pending", timestamp: createdAt, updatedBy: donor._id, notes: "Donation created" }];

    let claimedBy = null;
    let assignedVolunteer = null;
    let cancelledBy = null;
    let cancellationReason = null;
    const ngo = pick(ngos);
    const vol = pick(volunteers);

    // Build status history chain
    const statusChain = {
      broadcasted: ["broadcasted"],
      claimed: ["broadcasted", "claimed"],
      accepted: ["broadcasted", "claimed", "accepted"],
      picked_up: ["broadcasted", "claimed", "accepted", "picked_up"],
      in_transit: ["broadcasted", "claimed", "accepted", "picked_up", "in_transit"],
      delivered: ["broadcasted", "claimed", "accepted", "picked_up", "delivered"],
      closed: ["broadcasted", "claimed", "accepted", "picked_up", "delivered", "closed"],
      completed: ["broadcasted", "claimed", "accepted", "picked_up", "delivered", "closed", "completed"],
      cancelled: ["broadcasted", "cancelled"],
    };

    const chain = statusChain[status] || [];
    let elapsed = 0;
    for (const s of chain) {
      elapsed += rand(1, 12) * 3600000;
      const actor = s === "claimed" ? ngo._id
        : (s === "accepted" || s === "picked_up" || s === "in_transit" || s === "delivered") ? vol._id
        : s === "cancelled" ? (Math.random() > 0.5 ? donor._id : admin._id)
        : donor._id;
      statusHistory.push({ status: s, timestamp: new Date(createdAt.getTime() + elapsed), updatedBy: actor });

      if (s === "claimed") claimedBy = ngo._id;
      if (s === "accepted") assignedVolunteer = vol._id;
      if (s === "cancelled") {
        cancelledBy = actor;
        cancellationReason = pick(["Item spoiled before pickup", "Donor unavailable", "Incorrect listing", "Schedule conflict"]);
      }
    }

    const donation = {
      donorId: donor._id,
      donorName: donor.organization?.name || `${donor.firstName} ${donor.lastName}`,
      items,
      address: `${pick(STREETS)}`,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      lat: loc.lat + jitterLat,
      lng: loc.lng + jitterLng,
      pickupDatetime,
      status,
      statusHistory,
      claimedBy,
      assignedVolunteer,
      cancelledBy,
      cancellationReason,
      priority: pick(["low", "medium", "high", "critical"]),
      priorityScore: rand(10, 95),
      notes: pick([
        "Please collect before evening",
        "Freshly prepared today",
        "Stored in refrigerator",
        "Available at the back entrance",
        "Call before arriving",
        "",
      ]),
      foodSafety: {
        preparedTime: new Date(pickupDatetime.getTime() - rand(1, 6) * 3600000),
        expiryTime: new Date(pickupDatetime.getTime() + rand(4, 24) * 3600000),
        storageType: pick(["room_temp", "refrigerated", "frozen", "heated"]),
        packaging: pick(["Foil containers", "Plastic boxes", "Paper bags", "Steel vessels"]),
      },
      impact: {
        estimatedServings: totalServings,
        weightKg: rand(5, 100),
        co2Saved: (totalServings * 0.5).toFixed(2),
      },
      createdAt,
      updatedAt: new Date(createdAt.getTime() + (statusHistory.length * rand(1, 6) * 3600000)),
    };

    allDonations.push(donation);
  }

  const insertedDonations = await Donation.insertMany(allDonations);
  console.log(`Created ${insertedDonations.length} donations.`);

  // ── Create Claims, Logistics, Notifications, InventoryLogs ─────────
  for (const d of insertedDonations) {
    const claimedStatuses = ["claimed", "accepted", "picked_up", "in_transit", "delivered", "closed", "completed"];
    if (d.claimedBy && claimedStatuses.includes(d.status)) {
      allClaims.push({ donation: d._id, ngo: d.claimedBy, status: "approved", claimedAt: d.createdAt });

      const logStatus = d.status === "claimed" ? "pending_assignment"
        : d.status === "accepted" ? "assigned"
        : (d.status === "picked_up" || d.status === "in_transit") ? "in_progress"
        : (d.status === "delivered" || d.status === "closed" || d.status === "completed") ? "delivered"
        : "pending_assignment";

      allLogistics.push({
        donation: d._id,
        donor: d.donorId,
        ngo: d.claimedBy,
        volunteer: d.assignedVolunteer || undefined,
        status: logStatus,
        pickupTime: d.pickupDatetime,
        deliveryTime: logStatus === "delivered" ? new Date(d.pickupDatetime.getTime() + rand(1, 6) * 3600000) : undefined,
        notes: `Pickup from: ${d.address}, ${d.city}`,
      });

      // Notification to donor
      allNotifications.push({
        user: d.donorId,
        title: "Donation Update",
        message: `Your donation of ${d.items[0]?.itemName || "food"} has been ${d.status}.`,
        type: "status_update",
        isRead: Math.random() > 0.3,
        meta: { donationId: d._id, status: d.status },
        createdAt: d.updatedAt,
      });

      // Notification to NGO
      allNotifications.push({
        user: d.claimedBy,
        title: "Logistics Update",
        message: `Donation from ${d.donorName} is now ${d.status}.`,
        type: "status_update",
        isRead: Math.random() > 0.4,
        meta: { donationId: d._id, status: d.status },
        createdAt: d.updatedAt,
      });
    }

    if (d.status === "cancelled") {
      allNotifications.push({
        user: d.donorId,
        title: "Donation Cancelled",
        message: d.cancellationReason || "Your donation was cancelled.",
        type: "warning",
        isRead: false,
        meta: { donationId: d._id, status: "cancelled" },
        createdAt: d.updatedAt,
      });

      if (d.claimedBy) {
        allLogistics.push({
          donation: d._id, donor: d.donorId, ngo: d.claimedBy,
          status: "cancelled", pickupTime: d.pickupDatetime,
          notes: `Cancelled: ${d.cancellationReason || "No reason"}`,
        });
      }
    }

    // Inventory logs for completed
    if (["closed", "completed"].includes(d.status) && d.claimedBy) {
      for (const item of d.items) {
        allInventoryLogs.push({
          donationId: d._id,
          itemName: item.itemName,
          category: item.category,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit,
          operationType: "received",
          loggedBy: d.claimedBy,
          city: d.city,
          notes: `Received from ${d.donorName}`,
          createdAt: d.updatedAt,
        });
      }
    }
  }

  if (allClaims.length) await Claim.insertMany(allClaims);
  if (allLogistics.length) await Logistics.insertMany(allLogistics);
  if (allNotifications.length) await Notification.insertMany(allNotifications);
  if (allInventoryLogs.length) await InventoryLog.insertMany(allInventoryLogs);

  console.log(`Created ${allClaims.length} claims, ${allLogistics.length} logistics, ${allNotifications.length} notifications, ${allInventoryLogs.length} inventory logs.`);

  // ── Summary ────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  SEED COMPLETE — Login Credentials");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Password for ALL accounts: ${PASSWORD}\n`);
  for (const u of createdUsers) {
    console.log(`  [${u.role.toUpperCase().padEnd(10)}] ${u.email}`);
  }
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("Disconnected. Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
