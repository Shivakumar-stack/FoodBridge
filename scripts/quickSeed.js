/**
 * Quick script to create admin + sample data for testing
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/foodbridge";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected");

  const db = mongoose.connection.db;

  // Create admin user with pre-hashed password
  const salt = await bcrypt.genSalt(12);
  const hashedPw = await bcrypt.hash("admin123", salt);

  await db.collection("users").updateOne(
    { email: "admin@foodbridge.com" },
    {
      $setOnInsert: {
        email: "admin@foodbridge.com",
        password: hashedPw,
        role: "admin",
        name: "Admin User",
        firstName: "Admin",
        lastName: "User",
        city: "Delhi",
        phone: "555-9999",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log("✅ Admin user: admin@foodbridge.com / admin123");

  // Create a test donor
  const donorPw = await bcrypt.hash("donor123", salt);
  await db.collection("users").updateOne(
    { email: "donor@test.com" },
    {
      $setOnInsert: {
        email: "donor@test.com",
        password: donorPw,
        role: "donor",
        name: "Test Donor",
        firstName: "Test",
        lastName: "Donor",
        city: "Mumbai",
        phone: "555-1111",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log("✅ Donor user: donor@test.com / donor123");

  // Create sample donations with variety of dates
  const donations = [];
  const items = [
    "Rice",
    "Dal",
    "Bread",
    "Vegetables",
    "Fruits",
    "Milk",
    "Canned Food",
    "Water",
  ];
  const statuses = ["pending", "broadcasted", "completed", "closed"];
  const cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Pune"];

  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const created = new Date();
    created.setDate(created.getDate() - daysAgo);

    donations.push({
      donorName: `Donor ${i + 1}`,
      address: `${100 + i} Main Street`,
      city: cities[i % cities.length],
      state: "Maharashtra",
      zip: `40000${i}`,
      status: statuses[i % statuses.length],
      priority: ["low", "medium", "high"][i % 3],
      items: [
        {
          itemName: items[i % items.length],
          category: "food",
          quantity: Math.floor(Math.random() * 50) + 5,
          unit: "kg",
        },
      ],
      createdAt: created,
      updatedAt: created,
    });
  }

  const existingCount = await db.collection("donations").countDocuments();
  if (existingCount < 5) {
    await db.collection("donations").insertMany(donations);
    console.log(`✅ Inserted ${donations.length} sample donations`);
  } else {
    console.log(`ℹ Already ${existingCount} donations in DB, skipping`);
  }

  // Create sample deliveries
  const deliveries = [];
  for (let i = 0; i < 10; i++) {
    deliveries.push({
      delivery_id: `DEL-${1000 + i}`,
      delivery_status: ["delivered", "en_route", "assigned"][i % 3],
      pickup_time: new Date(Date.now() - Math.random() * 86400000 * 5),
      delivery_time: new Date(),
      deliveryNotes: `Delivery note ${i + 1}`,
      createdAt: new Date(),
    });
  }

  const existingDeliveries = await db.collection("deliveries").countDocuments();
  if (existingDeliveries < 5) {
    await db.collection("deliveries").insertMany(deliveries);
    console.log(`✅ Inserted ${deliveries.length} sample deliveries`);
  } else {
    console.log(`ℹ Already ${existingDeliveries} deliveries in DB, skipping`);
  }

  // Summary
  console.log("\n📊 Database Summary:");
  console.log(`   Users: ${await db.collection("users").countDocuments()}`);
  console.log(
    `   Donations: ${await db.collection("donations").countDocuments()}`,
  );
  console.log(
    `   Deliveries: ${await db.collection("deliveries").countDocuments()}`,
  );

  await mongoose.disconnect();
  console.log("✅ Done!");
}

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
