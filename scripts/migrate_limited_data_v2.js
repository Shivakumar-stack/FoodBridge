const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();
const dns = require("dns");

// Models
const User = require("../backend/models/User");
const Donation = require("../backend/models/Donation");
const Volunteer = require("../backend/models/Volunteer");
const MealServer = require("../backend/models/MealServer");
const Delivery = require("../backend/models/Delivery");
const InventoryLog = require("../backend/models/InventoryLog");
const Request = require("../backend/models/Request");
const Claim = require("../backend/models/Claim");
const Contact = require("../backend/models/Contact");
const Notification = require("../backend/models/Notification");
const Pickup = require("../backend/models/Pickup");

// Fix for Atlas SRV resolution issues on some Windows environments
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("Unable to set custom DNS servers:", err.message);
}

const DATASET_DIR = path.join(__dirname, "../dataset");
const MONGO_URI = process.env.MONGO_URI;

const LIMIT = 15;

async function runMigration() {
  try {
    console.log(`Connecting to: ${MONGO_URI.substring(0, 40)}...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // Drop database to ensure clean state
    console.log("Cleaning database...");
    await mongoose.connection.db.dropDatabase();
    console.log("Database cleared.");

    // 1. Users
    console.log("Pushing Users...");
    const userData = fs.readFileSync(path.join(DATASET_DIR, "users.csv"), "utf8");
    const userLines = userData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const users = [];
    const donorIds = [];
    const volunteerIds = [];
    const ngoIds = [];

    for (const line of userLines) {
      const v = line.split(",");
      const user = new User({
        _id: new mongoose.Types.ObjectId(v[0]),
        email: v[1],
        password: v[2] || "password123",
        role: v[3],
        firstName: v[4],
        lastName: v[5],
        name: `${v[4]} ${v[5]}`.trim(),
        organization: { name: v[6] || "" },
        city: v[7],
        address: { city: v[7], state: "TestState" },
        phone: v[8]
      });
      await user.save();
      users.push(user);
      if (v[3] === "donor") donorIds.push(user._id);
      if (v[3] === "volunteer") volunteerIds.push(user._id);
      if (v[3] === "ngo") ngoIds.push(user._id);
    }

    // 2. Volunteers
    console.log("Pushing Volunteers...");
    const volData = fs.readFileSync(path.join(DATASET_DIR, "volunteers.csv"), "utf8");
    const volLines = volData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    for (const line of volLines) {
      const v = line.split(",");
      await new Volunteer({
        _id: new mongoose.Types.ObjectId(v[0]),
        user_id: new mongoose.Types.ObjectId(v[1]),
        name: `${v[2]} ${v[3]}`.trim(),
        phone: v[4],
        city: v[5] || "TestCity",
        currentLocation: { type: "Point", coordinates: [0, 0] }
      }).save();
    }

    // 3. Donations
    console.log("Pushing Donations...");
    const donData = fs.readFileSync(path.join(DATASET_DIR, "donations.csv"), "utf8");
    const donLines = donData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const donationIds = [];
    for (const line of donLines) {
      const v = line.split(",");
      const d = new Donation({
        _id: new mongoose.Types.ObjectId(v[0]),
        donor_id: new mongoose.Types.ObjectId(v[1]),
        donorName: v[2],
        address: v[3],
        city: v[4],
        state: v[5],
        zip: v[6],
        status: "pending",
        priority: "medium",
        notes: v[9],
        items: [{ itemName: v[10], category: v[11], quantity: v[12], unit: v[13] }],
        pickup_datetime: new Date()
      });
      await d.save();
      donationIds.push(d._id);
    }

    // 4. MealServers
    console.log("Pushing MealServers...");
    const msData = fs.readFileSync(path.join(DATASET_DIR, "meal_servers.csv"), "utf8");
    const msLines = msData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    const mealServerIds = [];
    for (const line of msLines) {
      const v = line.split(",");
      const ms = new MealServer({
        _id: new mongoose.Types.ObjectId(v[0]),
        ngo_id: new mongoose.Types.ObjectId(v[1]),
        organization_name: v[2],
        contact_person: v[3],
        phone: v[4],
        city: v[5],
        address: v[6],
        capacity: parseInt(v[7]) || 100,
        mealsServedDaily: parseInt(v[8]) || 0
      });
      await ms.save();
      mealServerIds.push(ms._id);
    }

    // 5. Deliveries
    console.log("Pushing Deliveries...");
    const delData = fs.readFileSync(path.join(DATASET_DIR, "deliveries.csv"), "utf8");
    const delLines = delData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    for (const line of delLines) {
      const v = line.split(",");
      await new Delivery({
        delivery_id: v[0],
        donation_id: new mongoose.Types.ObjectId(v[1]),
        volunteer_id: new mongoose.Types.ObjectId(v[2]),
        ngo_id: new mongoose.Types.ObjectId(v[3]),
        delivery_status: "assigned",
        pickup_time: new Date(),
        delivery_time: new Date()
      }).save();
    }

    // 6. InventoryLogs
    console.log("Pushing InventoryLogs...");
    const invData = fs.readFileSync(path.join(DATASET_DIR, "inventory_logs.csv"), "utf8");
    const invLines = invData.split("\n").filter(l => l.trim() !== "").slice(1, LIMIT + 1);
    for (const line of invLines) {
      const v = line.split(",");
      await new InventoryLog({
        mealServer: new mongoose.Types.ObjectId(v[0]),
        donation_id: new mongoose.Types.ObjectId(v[1]),
        itemName: v[2],
        category: v[3],
        quantity: parseInt(v[4]) || 0,
        unit: v[5],
        operationType: "received",
        loggedBy: new mongoose.Types.ObjectId(v[7]),
        city: v[8]
      }).save();
    }

    // 7. Requests
    console.log("Pushing Requests...");
    for (let i = 0; i < LIMIT; i++) {
      await new Request({
        ngoId: ngoIds[i % ngoIds.length],
        ngoName: `NGO ${i + 1}`,
        foodNeeded: "Assorted Meals",
        quantity: "50 servings",
        location: "TestCity",
        urgency: "medium",
        status: "pending"
      }).save();
    }

    // 8. Claims
    console.log("Pushing Claims...");
    for (let i = 0; i < LIMIT; i++) {
      try {
        await new Claim({
          donation: donationIds[i % donationIds.length],
          ngo: ngoIds[i % ngoIds.length],
          status: "pending"
        }).save();
      } catch (e) {
        console.warn("Skipping claim insert due to error:", e.message);
      }
    }

    // 9. Contacts
    console.log("Pushing Contacts...");
    for (let i = 0; i < LIMIT; i++) {
      await new Contact({
        type: "general",
        name: `Contact ${i + 1}`,
        email: `contact${i + 1}@test.com`,
        subject: "Question",
        message: "Test message",
        status: "new"
      }).save();
    }

    // 10. Notifications
    console.log("Pushing Notifications...");
    for (let i = 0; i < LIMIT; i++) {
      await new Notification({
        user: users[i % users.length]._id,
        title: "Test Alert",
        message: "This is a test notification",
        type: "info",
        isRead: false
      }).save();
    }

    // 11. Pickups
    console.log("Pushing Pickups...");
    for (let i = 0; i < LIMIT; i++) {
      await new Pickup({
        donation: donationIds[i % donationIds.length],
        donor: donorIds[i % donorIds.length],
        volunteer: volunteerIds[i % volunteerIds.length],
        status: "assigned",
        pickupTime: new Date()
      }).save();
    }

    console.log("\n--- Migration SUCCESS: All 11 categories pushed via Models ---");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration FAILED:", err);
    process.exit(1);
  }
}

runMigration();
