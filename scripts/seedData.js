/**
 * seedData.js — Import CSV data into MongoDB
 * Usage: node scripts/seedData.js
 */
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../backend/models/User");
const Donation = require("../backend/models/Donation");
const Delivery = require("../backend/models/Delivery");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/foodbridge";

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    if (vals.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx];
    });
    rows.push(obj);
  }
  return rows;
}

async function seedUsers() {
  const csvPath = path.join(__dirname, "..", "dataset", "users.csv");
  if (!fs.existsSync(csvPath)) {
    console.log("  ⚠ users.csv not found, skipping");
    return 0;
  }

  const rows = parseCSV(csvPath);
  const salt = await bcrypt.genSalt(10);
  let count = 0;

  // Process in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const ops = batch.map((r) => ({
      updateOne: {
        filter: { email: r.email },
        update: {
          $setOnInsert: {
            email: r.email,
            password: bcrypt.hashSync(r.password || "password123", salt),
            role: r.role,
            name: `${r.firstName} ${r.lastName}`.trim(),
            firstName: r.firstName,
            lastName: r.lastName,
            organizationName: r.organizationName || undefined,
            city: r.city,
            phone: r.phone,
          },
        },
        upsert: true,
      },
    }));

    const result = await User.bulkWrite(ops);
    count += result.upsertedCount;
  }

  return count;
}

async function seedDonations() {
  const csvPath = path.join(__dirname, "..", "dataset", "donations.csv");
  if (!fs.existsSync(csvPath)) {
    console.log("  ⚠ donations.csv not found, skipping");
    return 0;
  }

  const rows = parseCSV(csvPath);
  let count = 0;

  // Group by donation _id
  const donationMap = {};
  rows.forEach((r) => {
    if (!donationMap[r._id]) {
      // Distribute creation dates across last 30 days for realistic chart data
      const daysAgo = Math.floor(Math.random() * 30);
      const created = new Date();
      created.setDate(created.getDate() - daysAgo);

      donationMap[r._id] = {
        donorName: r.donorName,
        address: r.address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        status: r.status || "pending",
        priority: r.priority || "medium",
        notes: r.notes || "",
        items: [],
        createdAt: created,
      };
    }
    donationMap[r._id].items.push({
      itemName: r.itemName,
      category: r.category,
      quantity: parseInt(r.quantity) || 1,
      unit: r.unit || "units",
    });
  });

  for (const data of Object.values(donationMap)) {
    try {
      await Donation.findOneAndUpdate(
        {
          donorName: data.donorName,
          "items.0.itemName": data.items[0]?.itemName,
        },
        {
          $setOnInsert: {
            donorName: data.donorName,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            status: data.status,
            priority: data.priority,
            notes: data.notes,
            items: data.items,
            createdAt: data.createdAt,
          },
        },
        { upsert: true, new: true },
      );
      count++;
    } catch (e) {
      // Skip duplicates silently
    }
  }

  return count;
}

async function seedDeliveries() {
  const csvPath = path.join(__dirname, "..", "dataset", "deliveries.csv");
  if (!fs.existsSync(csvPath)) {
    console.log("  ⚠ deliveries.csv not found, skipping");
    return 0;
  }

  const rows = parseCSV(csvPath);
  let count = 0;

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const ops = batch.map((r) => ({
      updateOne: {
        filter: { delivery_id: r.delivery_id },
        update: {
          $setOnInsert: {
            delivery_id: r.delivery_id,
            donation_id: r.donation_id,
            volunteer_id: r.volunteer_id,
            ngo_id: r.ngo_id,
            delivery_status: r.delivery_status || "delivered",
            pickup_time: r.pickup_time ? new Date(r.pickup_time) : new Date(),
            delivery_time: r.delivery_time
              ? new Date(r.delivery_time)
              : new Date(),
            deliveryNotes: r.deliveryNotes || "",
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    try {
      const result = await Delivery.bulkWrite(ops);
      count += result.upsertedCount;
    } catch (e) {
      // Schema mismatch — try individual inserts
      for (const r of batch) {
        try {
          await Delivery.findOneAndUpdate(
            { delivery_id: r.delivery_id },
            {
              $setOnInsert: {
                delivery_id: r.delivery_id,
                delivery_status: r.delivery_status || "delivered",
                deliveryNotes: r.deliveryNotes || "",
              },
            },
            { upsert: true },
          );
          count++;
        } catch (e2) {
          /* skip */
        }
      }
    }
  }

  return count;
}

async function createAdmin() {
  const salt = await bcrypt.genSalt(10);
  const result = await User.findOneAndUpdate(
    { email: "admin@foodbridge.com" },
    {
      $setOnInsert: {
        email: "admin@foodbridge.com",
        password: bcrypt.hashSync("admin123", salt),
        role: "admin",
        name: "Admin User",
        firstName: "Admin",
        lastName: "User",
        city: "AdminCity",
        phone: "555-9999",
      },
    },
    { upsert: true, new: true },
  );
  return result;
}

async function main() {
  console.log("\n🌱 FoodBridge Database Seeder");
  console.log("━".repeat(40));

  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to MongoDB`);

    console.log("\n📋 Seeding Users...");
    const userCount = await seedUsers();
    console.log(`   ➜ ${userCount} new users inserted`);

    console.log("🍲 Seeding Donations...");
    const donationCount = await seedDonations();
    console.log(`   ➜ ${donationCount} donations processed`);

    console.log("🚚 Seeding Deliveries...");
    const deliveryCount = await seedDeliveries();
    console.log(`   ➜ ${deliveryCount} deliveries processed`);

    console.log("🔑 Creating Admin User...");
    await createAdmin();
    console.log(`   ➜ Admin: admin@foodbridge.com / admin123`);

    console.log("\n" + "━".repeat(40));
    console.log("✅ Seeding complete!");
    console.log(`   Users: ${await User.countDocuments()}`);
    console.log(`   Donations: ${await Donation.countDocuments()}`);
    console.log(`   Deliveries: ${await Delivery.countDocuments()}`);
  } catch (err) {
    console.error("❌ Seeding error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

main();
