const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const dns = require("dns");

// Fix for Atlas SRV resolution issues on some Windows environments
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("Failed to set custom DNS servers, SRV resolution might fail:", err.message);
}

const DATASET_DIR = path.join(__dirname, "../dataset");
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI.includes("127.0.0.1") || MONGO_URI.includes("localhost")) {
  console.error("Error: MONGO_URI is missing or pointing to local. Please set it to your new Atlas URI in .env.");
  process.exit(1);
}

console.log(`Using Atlas URI: ${MONGO_URI.substring(0, 30)}...`);

function generateObjectId() {
  return new mongoose.Types.ObjectId();
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

const LIMIT = 15;

async function runMigration() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB Atlas successfully.");

    // 1. Users
    console.log("Processing Users...");
    const userData = fs.readFileSync(path.join(DATASET_DIR, "users.csv"), "utf8");
    const userLines = userData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const users = [];
    const donorIds = [];
    const volunteerIds = [];
    const ngoIds = [];

    for (const line of userLines) {
      const v = line.split(",");
      const password = await hashPassword(v[2] || "password123");
      const user = {
        _id: new mongoose.Types.ObjectId(v[0]),
        email: v[1],
        password: password,
        role: v[3],
        firstName: v[4],
        lastName: v[5],
        name: `${v[4]} ${v[5]}`,
        organization: { name: v[6] || "", type: v[3] === "ngo" ? "ngo" : "other" },
        city: v[7],
        address: { city: v[7], state: "TestState", country: "India", location: { type: "Point", coordinates: [0, 0] } },
        phone: v[8],
        status: "active",
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      users.push(user);
      if (v[3] === "donor") donorIds.push(user._id);
      if (v[3] === "volunteer") volunteerIds.push(user._id);
      if (v[3] === "ngo") ngoIds.push(user._id);
    }
    await mongoose.connection.collection("users").deleteMany({});
    await mongoose.connection.collection("users").insertMany(users);
    console.log(`Imported ${users.length} Users`);

    // 2. Volunteers (Existing)
    console.log("Processing Volunteers...");
    const volData = fs.readFileSync(path.join(DATASET_DIR, "volunteers.csv"), "utf8");
    const volLines = volData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const volunteers = volLines.map(line => {
      const v = line.split(",");
      return {
        _id: new mongoose.Types.ObjectId(v[0]),
        user: new mongoose.Types.ObjectId(v[1]),
        firstName: v[2],
        lastName: v[3],
        phone: v[4],
        city: v[5],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    await mongoose.connection.collection("volunteers").deleteMany({});
    await mongoose.connection.collection("volunteers").insertMany(volunteers);
    console.log(`Imported ${volunteers.length} Volunteers`);

    // 3. Donations (Existing)
    console.log("Processing Donations...");
    const donData = fs.readFileSync(path.join(DATASET_DIR, "donations.csv"), "utf8");
    const donLines = donData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const donationIds = [];
    const donations = donLines.map(line => {
      const v = line.split(",");
      donationIds.push(new mongoose.Types.ObjectId(v[0]));
      return {
        _id: donationIds[donationIds.length - 1],
        donor_id: new mongoose.Types.ObjectId(v[1]),
        donorName: v[2],
        address: v[3],
        city: v[4],
        state: v[5],
        zip: v[6],
        status: v[7],
        priority: v[8],
        notes: v[9],
        items: [{ itemName: v[10], category: v[11], quantity: v[12], unit: v[13] }],
        pickup_datetime: new Date(),
        impact: { estimatedServings: 40, weightKg: 10 },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    await mongoose.connection.collection("donations").deleteMany({});
    await mongoose.connection.collection("donations").insertMany(donations);
    console.log(`Imported ${donations.length} Donations`);

    // 4. MealServers (Existing)
    console.log("Processing MealServers...");
    const msData = fs.readFileSync(path.join(DATASET_DIR, "meal_servers.csv"), "utf8");
    const msLines = msData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const mealServerIds = [];
    const mealServers = msLines.map(line => {
      const v = line.split(",");
      mealServerIds.push(new mongoose.Types.ObjectId(v[0]));
      return {
        _id: mealServerIds[mealServerIds.length - 1],
        ngo_id: new mongoose.Types.ObjectId(v[1]),
        organization_name: v[2],
        contact_person: v[3],
        phone: v[4],
        city: v[5],
        address: v[6],
        capacity: parseInt(v[7]),
        mealsServedDaily: parseInt(v[8]),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    await mongoose.connection.collection("mealservers").deleteMany({});
    await mongoose.connection.collection("mealservers").insertMany(mealServers);
    console.log(`Imported ${mealServers.length} MealServers`);

    // 5. Deliveries (Existing)
    console.log("Processing Deliveries...");
    const delData = fs.readFileSync(path.join(DATASET_DIR, "deliveries.csv"), "utf8");
    const delLines = delData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const deliveries = delLines.map(line => {
      const v = line.split(",");
      return {
        delivery_id: v[0],
        donation_id: new mongoose.Types.ObjectId(v[1]),
        volunteer_id: new mongoose.Types.ObjectId(v[2]),
        ngo_id: new mongoose.Types.ObjectId(v[3]),
        delivery_status: v[4],
        pickup_time: new Date(v[5]),
        delivery_time: new Date(v[6]),
        deliveryNotes: v[7],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    await mongoose.connection.collection("deliveries").deleteMany({});
    await mongoose.connection.collection("deliveries").insertMany(deliveries);
    console.log(`Imported ${deliveries.length} Deliveries`);

    // 6. InventoryLogs (Existing)
    console.log("Processing InventoryLogs...");
    const invData = fs.readFileSync(path.join(DATASET_DIR, "inventory_logs.csv"), "utf8");
    const invLines = invData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const inventoryLogs = invLines.map(line => {
      const v = line.split(",");
      return {
        mealServer: new mongoose.Types.ObjectId(v[0]),
        donation_id: new mongoose.Types.ObjectId(v[1]),
        itemName: v[2],
        category: v[3],
        quantity: v[4],
        unit: v[5],
        operationType: v[6],
        loggedBy: new mongoose.Types.ObjectId(v[7]),
        city: v[8],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    await mongoose.connection.collection("inventorylogs").deleteMany({});
    await mongoose.connection.collection("inventorylogs").insertMany(inventoryLogs);
    console.log(`Imported ${inventoryLogs.length} InventoryLogs`);

    // --- Generated Categories ---

    // 7. Requests (Generated)
    console.log("Generating Requests...");
    const requests = [];
    for (let i = 0; i < LIMIT; i++) {
      requests.push({
        _id: generateObjectId(),
        ngoId: ngoIds[i % ngoIds.length],
        ngoName: `NGO ${i + 1}`,
        foodNeeded: "Bread and Vegetables",
        quantity: "50 kg",
        location: "TestCity",
        urgency: "medium",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await mongoose.connection.collection("requests").deleteMany({});
    await mongoose.connection.collection("requests").insertMany(requests);
    console.log(`Imported ${requests.length} Requests`);

    // 8. Claims (Generated)
    console.log("Generating Claims...");
    const claims = [];
    for (let i = 0; i < LIMIT; i++) {
      claims.push({
        _id: generateObjectId(),
        donation: donationIds[i % donationIds.length],
        ngo: ngoIds[i % ngoIds.length],
        status: "pending",
        message: "We can distribute this food in our area.",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await mongoose.connection.collection("claims").deleteMany({});
    await mongoose.connection.collection("claims").insertMany(claims);
    console.log(`Imported ${claims.length} Claims`);

    // 9. Contacts (Generated)
    console.log("Generating Contacts...");
    const contacts = [];
    for (let i = 0; i < LIMIT; i++) {
      contacts.push({
        _id: generateObjectId(),
        name: `Contact User ${i + 1}`,
        email: `contact${i + 1}@example.com`,
        subject: "General Inquiry",
        message: "Hello, I would like to know more about FoodBridge.",
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await mongoose.connection.collection("contacts").deleteMany({});
    await mongoose.connection.collection("contacts").insertMany(contacts);
    console.log(`Imported ${contacts.length} Contacts`);

    // 10. Notifications (Generated)
    console.log("Generating Notifications...");
    const notifications = [];
    for (let i = 0; i < LIMIT; i++) {
      notifications.push({
        _id: generateObjectId(),
        recipient: users[i % users.length]._id,
        title: "New Donation Available",
        message: "A donor in your city just posted a new donation.",
        type: "donation",
        read: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await mongoose.connection.collection("notifications").deleteMany({});
    await mongoose.connection.collection("notifications").insertMany(notifications);
    console.log(`Imported ${notifications.length} Notifications`);

    // 11. Pickups (Generated)
    console.log("Generating Pickups...");
    const pickups = [];
    for (let i = 0; i < LIMIT; i++) {
      pickups.push({
        _id: generateObjectId(),
        donation: donationIds[i % donationIds.length],
        donor: donorIds[i % donorIds.length],
        volunteer: volunteerIds[i % volunteerIds.length],
        status: "assigned",
        pickupTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await mongoose.connection.collection("pickups").deleteMany({});
    await mongoose.connection.collection("pickups").insertMany(pickups);
    console.log(`Imported ${pickups.length} Pickups`);

    console.log("\n--- Migration Complete: 15 records per category pushed to Atlas ---");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
