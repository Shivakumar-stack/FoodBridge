/**
 * generate-dataset-json.js
 * Generates realistic JSON dataset files for MongoDB Compass import.
 * Output: dataset/*.json  (one file per collection)
 * Usage:  node scripts/generate-dataset-json.js
 *
 * NOTE: Uses JSON format because donations/logistics have nested arrays
 *       (items, statusHistory) that CSV cannot represent.
 *       In Compass: Database → Collection → Add Data → Import JSON.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const OUT_DIR = path.resolve(__dirname, "..", "dataset");

// ── Helpers ──────────────────────────────────────────────────────────
const PASSWORD = "Password@123";
const oid = () => crypto.randomBytes(12).toString("hex"); // 24-char fake ObjectId
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const CITIES = [
  { city: "Bangalore", state: "Karnataka", zip: "560001", lat: 12.9716, lng: 77.5946 },
  { city: "Mysore",    state: "Karnataka", zip: "570001", lat: 12.2958, lng: 76.6394 },
  { city: "Hubli",     state: "Karnataka", zip: "580020", lat: 15.3647, lng: 75.1240 },
  { city: "Mangalore", state: "Karnataka", zip: "575001", lat: 12.9141, lng: 74.8560 },
  { city: "Belgaum",   state: "Karnataka", zip: "590001", lat: 15.8497, lng: 74.4977 },
  { city: "Davanagere",state: "Karnataka", zip: "577001", lat: 14.4644, lng: 75.9218 },
  { city: "Shimoga",   state: "Karnataka", zip: "577201", lat: 13.9299, lng: 75.5681 },
  { city: "Udupi",     state: "Karnataka", zip: "576101", lat: 13.3409, lng: 74.7971 },
];

const STREETS = [
  "MG Road", "Brigade Road", "Jayanagar 4th Block", "Koramangala 5th Block",
  "Rajajinagar 1st Block", "Indiranagar 100ft Road", "Basavanagudi Bull Temple Rd",
  "Whitefield Main Road", "Electronic City Phase 1", "HSR Layout Sector 2",
  "Vijayanagar Main Road", "Sayyaji Rao Road", "Lamington Road", "Station Road",
  "KR Circle", "Mahatma Gandhi Road", "Commercial Street", "Residency Road",
  "Race Course Road", "Lalbagh Road", "Car Street", "Camp Road",
  "Gokulam Main Road", "Dharwad Road", "Manipal Main Road",
];

const FOOD_ITEMS = [
  { itemName: "Vegetable Biryani",    category: "Cooked Food",     unit: "servings" },
  { itemName: "Chapati with Dal",     category: "Cooked Food",     unit: "plates" },
  { itemName: "Sambar Rice",          category: "Cooked Food",     unit: "servings" },
  { itemName: "Idli Vada Combo",      category: "Cooked Food",     unit: "plates" },
  { itemName: "Pulao with Raita",     category: "Cooked Food",     unit: "servings" },
  { itemName: "Curd Rice",            category: "Cooked Food",     unit: "bowls" },
  { itemName: "Paneer Butter Masala", category: "Cooked Food",     unit: "servings" },
  { itemName: "Roti with Sabzi",      category: "Cooked Food",     unit: "plates" },
  { itemName: "Rice Bags (5kg)",      category: "Raw Ingredients", unit: "bags" },
  { itemName: "Wheat Flour (10kg)",   category: "Raw Ingredients", unit: "bags" },
  { itemName: "Toor Dal (2kg)",       category: "Raw Ingredients", unit: "packets" },
  { itemName: "Cooking Oil (5L)",     category: "Raw Ingredients", unit: "cans" },
  { itemName: "Mixed Vegetables",     category: "Vegetables",      unit: "kg" },
  { itemName: "Tomatoes",             category: "Vegetables",      unit: "kg" },
  { itemName: "Onions",               category: "Vegetables",      unit: "kg" },
  { itemName: "Potatoes",             category: "Vegetables",      unit: "kg" },
  { itemName: "Bananas",              category: "Fruits",          unit: "dozen" },
  { itemName: "Apples",               category: "Fruits",          unit: "kg" },
  { itemName: "Oranges",              category: "Fruits",          unit: "kg" },
  { itemName: "Milk Packets (500ml)", category: "Dairy",           unit: "packets" },
  { itemName: "Paneer (200g blocks)", category: "Dairy",           unit: "blocks" },
  { itemName: "Curd (1kg)",           category: "Dairy",           unit: "packets" },
  { itemName: "Bread Loaves",         category: "Baked Goods",     unit: "loaves" },
  { itemName: "Cake Slices",          category: "Baked Goods",     unit: "pieces" },
  { itemName: "Biscuit Packets",      category: "Packaged",        unit: "packets" },
  { itemName: "Instant Noodle Packs", category: "Packaged",        unit: "packets" },
  { itemName: "Juice Tetra Packs",    category: "Beverages",       unit: "packs" },
  { itemName: "Buttermilk (1L)",      category: "Beverages",       unit: "bottles" },
  { itemName: "Mineral Water (1L)",   category: "Beverages",       unit: "bottles" },
];

// ── User Definitions ─────────────────────────────────────────────────
const USER_DEFS = [
  // Admin
  { firstName: "Rajesh", lastName: "Kumar", email: "admin@foodbridge.org", role: "admin",
    phone: "+91 9845012345", orgName: "FoodBridge Admin", orgType: "other", cityIdx: 0, street: "MG Road" },
  // Donors (6)
  { firstName: "Ananya", lastName: "Sharma", email: "ananya.sharma@gmail.com", role: "donor",
    phone: "+91 9900123456", orgName: "Taj West End Hotel", orgType: "hotel", cityIdx: 0, street: "Race Course Road" },
  { firstName: "Vikram", lastName: "Reddy", email: "vikram.reddy@outlook.com", role: "donor",
    phone: "+91 9880234567", orgName: "Radisson Blu Bangalore", orgType: "hotel", cityIdx: 0, street: "Rajajinagar 1st Block" },
  { firstName: "Priya", lastName: "Nair", email: "priya.nair@yahoo.com", role: "donor",
    phone: "+91 9741345678", orgName: "Cafe Coffee Day Corporate", orgType: "corporate", cityIdx: 1, street: "Sayyaji Rao Road" },
  { firstName: "Suresh", lastName: "Gowda", email: "suresh.gowda@gmail.com", role: "donor",
    phone: "+91 8050456789", orgName: "MTR Foods Pvt Ltd", orgType: "restaurant", cityIdx: 0, street: "Lalbagh Road" },
  { firstName: "Deepa", lastName: "Hegde", email: "deepa.hegde@gmail.com", role: "donor",
    phone: "+91 7349567890", orgName: "Udupi Sri Krishna Bhavan", orgType: "restaurant", cityIdx: 7, street: "Car Street" },
  { firstName: "Karthik", lastName: "Rao", email: "karthik.rao@hotmail.com", role: "donor",
    phone: "+91 9632678901", orgName: "Hubli Grand Hotel", orgType: "hotel", cityIdx: 2, street: "Lamington Road" },
  // NGOs (4)
  { firstName: "Meenakshi", lastName: "Iyer", email: "meenakshi@akshayapatra.org", role: "ngo",
    phone: "+91 8042789012", orgName: "Akshaya Patra Foundation", orgType: "ngo", cityIdx: 0, street: "Rajajinagar" },
  { firstName: "Abdul", lastName: "Rasheed", email: "abdul@feedingindia.org", role: "ngo",
    phone: "+91 9538890123", orgName: "Feeding India", orgType: "ngo", cityIdx: 1, street: "Gokulam Main Road" },
  { firstName: "Lakshmi", lastName: "Devi", email: "lakshmi@robinhood.ngo", role: "ngo",
    phone: "+91 8722901234", orgName: "Robin Hood Army Karnataka", orgType: "ngo", cityIdx: 2, street: "Station Road" },
  { firstName: "Naveen", lastName: "Shetty", email: "naveen@annapoorna.org", role: "ngo",
    phone: "+91 9845012346", orgName: "Annapoorna Trust", orgType: "ngo", cityIdx: 4, street: "Camp Road" },
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

// ──────────────────────────────────────────────────────────────────────
async function generate() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  // ── 1. USERS ───────────────────────────────────────────────────────
  const users = USER_DEFS.map((u) => {
    const loc = CITIES[u.cityIdx];
    const id = oid();
    const createdAt = randomDate(new Date("2025-11-01"), new Date("2026-01-15"));
    return {
      _id: id,
      name: `${u.firstName} ${u.lastName}`,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: hashedPassword,
      phone: u.phone,
      role: u.role,
      city: loc.city,
      organization: { name: u.orgName || "", type: u.orgType || "other" },
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
        rating: parseFloat((4 + Math.random()).toFixed(1)),
      } : { isAvailable: false, vehicleType: "none", serviceArea: [], completedPickups: 0, rating: 5 },
      donorInfo: u.role === "donor" ? {
        totalDonations: rand(5, 30),
        mealsProvided: rand(200, 5000),
        isVerified: true,
      } : { totalDonations: 0, mealsProvided: 0, isVerified: false },
      ngoInfo: u.role === "ngo" ? {
        mission: `Providing meals to underprivileged communities in ${loc.city}`,
        beneficiaries: rand(500, 10000),
        isVerified: true,
      } : {},
      status: "active",
      isEmailVerified: true,
      loginCount: rand(5, 50),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    };
  });

  const admin    = users.find(u => u.role === "admin");
  const donors   = users.filter(u => u.role === "donor");
  const ngos     = users.filter(u => u.role === "ngo");
  const vols     = users.filter(u => u.role === "volunteer");

  // ── 2. MEAL SERVERS ────────────────────────────────────────────────
  const mealservers = ngos.map((ngo) => {
    const def = USER_DEFS.find(d => d.email === ngo.email);
    const loc = CITIES[def.cityIdx];
    return {
      _id: oid(),
      ngoId: ngo._id,
      organization_name: ngo.organization.name,
      contact_person: ngo.name,
      phone: ngo.phone,
      city: loc.city,
      lat: loc.lat + (Math.random() - 0.5) * 0.02,
      lng: loc.lng + (Math.random() - 0.5) * 0.02,
      address: `${pick(STREETS)}, ${loc.city}`,
      capacity: rand(200, 1000),
      mealsServedDaily: rand(50, 300),
      operatingHours: { open: "08:00", close: "20:00" },
      active: true,
      createdAt: new Date("2025-12-01").toISOString(),
      updatedAt: new Date("2025-12-01").toISOString(),
    };
  });

  // ── 3. DONATIONS ───────────────────────────────────────────────────
  const START = new Date("2026-01-05");
  const END   = new Date("2026-05-10");
  const TOTAL = 45;

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

  const donations = [];
  const claims    = [];
  const logistics = [];
  const notifications = [];
  const inventorylogs = [];

  for (let i = 0; i < TOTAL; i++) {
    const donor = pick(donors);
    const donorDef = USER_DEFS.find(d => d.email === donor.email);
    const loc = CITIES[donorDef.cityIdx];
    const status = statusPlan[i] || pick(["pending", "closed"]);
    const createdAt = randomDate(START, END);
    const pickupDatetime = new Date(createdAt.getTime() + rand(2, 48) * 3600000);

    const numItems = rand(1, 3);
    const itemSet = new Set();
    while (itemSet.size < numItems) itemSet.add(pick(FOOD_ITEMS));
    const items = Array.from(itemSet).map(fi => ({
      itemName: fi.itemName,
      category: fi.category,
      quantity: String(rand(5, 80)),
      unit: fi.unit,
      servings: rand(10, 200),
      allergens: [],
      specialNotes: "",
    }));

    const totalServings = items.reduce((s, it) => s + it.servings, 0);
    const jLat = (Math.random() - 0.5) * 0.04;
    const jLng = (Math.random() - 0.5) * 0.04;

    const donationId = oid();
    const statusHistory = [{
      status: "pending", timestamp: createdAt.toISOString(),
      updatedBy: donor._id, notes: "Donation created"
    }];

    let claimedBy = null;
    let assignedVolunteer = null;
    let cancelledBy = null;
    let cancellationReason = null;
    const ngo = pick(ngos);
    const vol = pick(vols);

    const chains = {
      pending:     [],
      broadcasted: ["broadcasted"],
      claimed:     ["broadcasted", "claimed"],
      accepted:    ["broadcasted", "claimed", "accepted"],
      picked_up:   ["broadcasted", "claimed", "accepted", "picked_up"],
      in_transit:  ["broadcasted", "claimed", "accepted", "picked_up", "in_transit"],
      delivered:   ["broadcasted", "claimed", "accepted", "picked_up", "delivered"],
      closed:      ["broadcasted", "claimed", "accepted", "picked_up", "delivered", "closed"],
      completed:   ["broadcasted", "claimed", "accepted", "picked_up", "delivered", "closed", "completed"],
      cancelled:   ["broadcasted", "cancelled"],
    };

    let elapsed = 0;
    for (const s of (chains[status] || [])) {
      elapsed += rand(1, 12) * 3600000;
      const actor = s === "claimed" ? ngo._id
        : ["accepted","picked_up","in_transit","delivered"].includes(s) ? vol._id
        : s === "cancelled" ? (Math.random() > 0.5 ? donor._id : admin._id)
        : s === "closed" ? ngo._id
        : donor._id;
      statusHistory.push({
        status: s, timestamp: new Date(createdAt.getTime() + elapsed).toISOString(),
        updatedBy: actor,
      });
      if (s === "claimed") claimedBy = ngo._id;
      if (s === "accepted") assignedVolunteer = vol._id;
      if (s === "cancelled") {
        cancelledBy = actor;
        cancellationReason = pick([
          "Item spoiled before pickup", "Donor unavailable",
          "Incorrect listing", "Schedule conflict",
        ]);
      }
    }

    const updatedAt = new Date(createdAt.getTime() + elapsed + rand(1,4)*3600000);

    donations.push({
      _id: donationId,
      donorId: donor._id,
      donorName: donor.organization.name || donor.name,
      items,
      image: null,
      address: pick(STREETS),
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      lat: loc.lat + jLat,
      lng: loc.lng + jLng,
      pickupDatetime: pickupDatetime.toISOString(),
      pickupWindow: {
        start: pickupDatetime.toISOString(),
        end: new Date(pickupDatetime.getTime() + 4 * 3600000).toISOString(),
      },
      status,
      statusHistory,
      claimedBy,
      assignedVolunteer,
      cancelledBy,
      cancellationReason,
      priority: pick(["low", "medium", "high", "critical"]),
      priorityScore: rand(10, 95),
      notes: pick([
        "Please collect before evening", "Freshly prepared today",
        "Stored in refrigerator", "Available at the back entrance",
        "Call before arriving", "Handle with care — glass containers", "",
      ]),
      foodSafety: {
        preparedTime: new Date(pickupDatetime.getTime() - rand(1,6)*3600000).toISOString(),
        expiryTime: new Date(pickupDatetime.getTime() + rand(4,24)*3600000).toISOString(),
        storageType: pick(["room_temp", "refrigerated", "frozen", "heated"]),
        packaging: pick(["Foil containers", "Plastic boxes", "Paper bags", "Steel vessels"]),
      },
      impact: {
        estimatedServings: totalServings,
        weightKg: rand(5, 100),
        co2Saved: parseFloat((totalServings * 0.5).toFixed(2)),
      },
      isRecurring: false,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    // ── Claims & Logistics ──
    const claimedStatuses = ["claimed","accepted","picked_up","in_transit","delivered","closed","completed"];
    if (claimedBy && claimedStatuses.includes(status)) {
      claims.push({
        _id: oid(),
        donation: donationId,
        ngo: claimedBy,
        status: "approved",
        claimedAt: createdAt.toISOString(),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });

      const logStatus = status === "claimed" ? "pending_assignment"
        : status === "accepted" ? "assigned"
        : ["picked_up","in_transit"].includes(status) ? "in_progress"
        : ["delivered","closed","completed"].includes(status) ? "delivered"
        : "pending_assignment";

      logistics.push({
        _id: oid(),
        logisticsId: `LOG-${Date.now()}-${rand(1000,9999)}`,
        donation: donationId,
        donor: donor._id,
        ngo: claimedBy,
        volunteer: assignedVolunteer || undefined,
        status: logStatus,
        pickupTime: pickupDatetime.toISOString(),
        deliveryTime: logStatus === "delivered"
          ? new Date(pickupDatetime.getTime() + rand(1,6)*3600000).toISOString()
          : undefined,
        notes: `Pickup from: ${pick(STREETS)}, ${loc.city}`,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    }

    if (status === "cancelled" && claimedBy) {
      logistics.push({
        _id: oid(),
        logisticsId: `LOG-${Date.now()}-${rand(1000,9999)}`,
        donation: donationId, donor: donor._id, ngo: claimedBy,
        status: "cancelled", pickupTime: pickupDatetime.toISOString(),
        notes: `Cancelled: ${cancellationReason || "No reason"}`,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    }

    // ── Notifications ──
    if (claimedBy) {
      notifications.push({
        _id: oid(),
        user: donor._id,
        title: "Donation Update",
        message: `Your donation of ${items[0].itemName} has been ${status}.`,
        type: "status_update",
        isRead: Math.random() > 0.3,
        meta: { donationId, status },
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
      notifications.push({
        _id: oid(),
        user: claimedBy,
        title: "Logistics Update",
        message: `Donation from ${donor.organization.name || donor.name} is now ${status}.`,
        type: "status_update",
        isRead: Math.random() > 0.4,
        meta: { donationId, status },
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    }
    if (status === "cancelled") {
      notifications.push({
        _id: oid(),
        user: donor._id,
        title: "Donation Cancelled",
        message: cancellationReason || "Your donation was cancelled.",
        type: "warning",
        isRead: false,
        meta: { donationId, status: "cancelled" },
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    }

    // ── Inventory Logs for closed/completed ──
    if (["closed","completed"].includes(status) && claimedBy) {
      const ms = mealservers.find(m => m.ngoId === claimedBy);
      for (const item of items) {
        inventorylogs.push({
          _id: oid(),
          mealServer: ms ? ms._id : undefined,
          donationId,
          itemName: item.itemName,
          category: item.category,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit,
          operationType: "received",
          loggedBy: claimedBy,
          city: loc.city,
          notes: `Received from ${donor.organization.name || donor.name}`,
          timestamp: updatedAt.toISOString(),
          createdAt: updatedAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        });
      }
    }
  }

  // ── Write files ────────────────────────────────────────────────────
  const files = {
    "users.json":         users,
    "donations.json":     donations,
    "claims.json":        claims,
    "logistics.json":     logistics,
    "notifications.json": notifications,
    "mealservers.json":   mealservers,
    "inventorylogs.json": inventorylogs,
  };

  for (const [filename, data] of Object.entries(files)) {
    const filePath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`  ✔ ${filename.padEnd(24)} → ${data.length} records`);
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  ALL FILES WRITTEN TO: ${OUT_DIR}`);
  console.log(`  Password for ALL accounts: ${PASSWORD}`);
  console.log(`══════════════════════════════════════════════════`);
  console.log(`\n  Import order in MongoDB Compass:`);
  console.log(`    1. users           → "users" collection`);
  console.log(`    2. mealservers     → "mealservers" collection`);
  console.log(`    3. donations       → "donations" collection`);
  console.log(`    4. claims          → "claims" collection`);
  console.log(`    5. logistics       → "logistics" collection`);
  console.log(`    6. notifications   → "notifications" collection`);
  console.log(`    7. inventorylogs   → "inventorylogs" collection`);
  console.log(`\n  Steps: Open Compass → Select "foodbridge" DB`);
  console.log(`         → Click collection → Add Data → Import JSON File\n`);
}

generate().catch(err => { console.error("Failed:", err); process.exit(1); });
