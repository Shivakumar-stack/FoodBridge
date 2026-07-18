/**
 * fix-imported-types.js
 * Run AFTER importing CSV files into MongoDB Compass.
 * Fixes field types: string→ObjectId, string→Date, string→Boolean.
 * 
 * Usage: node scripts/fix-imported-types.js
 */
const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/foodbridge";

async function fixCollection(db, collName, fixes) {
  const coll = db.collection(collName);
  const count = await coll.countDocuments();
  if (count === 0) { console.log(`  ⏭ ${collName}: empty, skipping`); return; }

  let modified = 0;
  const cursor = coll.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const update = {};

    for (const fix of fixes) {
      const val = doc[fix.field];
      if (val === undefined || val === null || val === "") continue;

      if (fix.type === "objectid" && typeof val === "string" && /^[a-f0-9]{24}$/i.test(val)) {
        update[fix.field] = new mongoose.Types.ObjectId(val);
      } else if (fix.type === "date" && typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) update[fix.field] = d;
      } else if (fix.type === "boolean" && typeof val === "string") {
        update[fix.field] = val === "true" || val === "1";
      } else if (fix.type === "number" && typeof val === "string") {
        const n = Number(val);
        if (!isNaN(n)) update[fix.field] = n;
      }
    }

    if (Object.keys(update).length > 0) {
      await coll.updateOne({ _id: doc._id }, { $set: update });
      modified++;
    }
  }
  console.log(`  ✔ ${collName}: ${modified}/${count} documents fixed`);
}

async function main() {
  console.log("\n🔧 Fixing field types in MongoDB after CSV import...");
  console.log(`  Connecting to: ${MONGO_URI.replace(/\/\/.*@/, "//***@")}...\n`);
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });
  console.log("  ✔ Connected to MongoDB\n");
  const db = mongoose.connection.db;

  // Users
  await fixCollection(db, "users", [
    { field: "createdAt", type: "date" },
  ]);

  // Notifications  
  await fixCollection(db, "notifications", [
    { field: "user", type: "objectid" },
    { field: "isRead", type: "boolean" },
    { field: "createdAt", type: "date" },
  ]);

  // Claims
  await fixCollection(db, "claims", [
    { field: "donation", type: "objectid" },
    { field: "ngo", type: "objectid" },
    { field: "claimedAt", type: "date" },
    { field: "createdAt", type: "date" },
  ]);

  // Logistics
  await fixCollection(db, "logistics", [
    { field: "donation", type: "objectid" },
    { field: "donor", type: "objectid" },
    { field: "volunteer", type: "objectid" },
    { field: "ngo", type: "objectid" },
    { field: "pickupTime", type: "date" },
    { field: "deliveryTime", type: "date" },
    { field: "createdAt", type: "date" },
  ]);

  // Deliveries
  await fixCollection(db, "deliveries", [
    { field: "donation", type: "objectid" },
    { field: "volunteerId", type: "objectid" },
    { field: "deliveryTime", type: "date" },
    { field: "createdAt", type: "date" },
  ]);

  // Pickups
  await fixCollection(db, "pickups", [
    { field: "donation", type: "objectid" },
    { field: "volunteerId", type: "objectid" },
    { field: "pickupTime", type: "date" },
    { field: "createdAt", type: "date" },
  ]);

  // Inventory Logs
  await fixCollection(db, "inventorylogs", [
    { field: "mealServer", type: "objectid" },
    { field: "donationId", type: "objectid" },
    { field: "loggedBy", type: "objectid" },
    { field: "quantity", type: "number" },
    { field: "createdAt", type: "date" },
  ]);

  // Meal Servers
  await fixCollection(db, "mealservers", [
    { field: "ngoId", type: "objectid" },
    { field: "lat", type: "number" },
    { field: "lng", type: "number" },
    { field: "capacity", type: "number" },
    { field: "mealsServedDaily", type: "number" },
    { field: "active", type: "boolean" },
    { field: "createdAt", type: "date" },
  ]);

  // Volunteers
  await fixCollection(db, "volunteers", [
    { field: "userId", type: "objectid" },
    { field: "isAvailable", type: "boolean" },
    { field: "completedPickups", type: "number" },
    { field: "rating", type: "number" },
    { field: "createdAt", type: "date" },
  ]);

  // Requests
  await fixCollection(db, "requests", [
    { field: "ngoId", type: "objectid" },
    { field: "createdAt", type: "date" },
  ]);

  // Contacts
  await fixCollection(db, "contacts", [
    { field: "createdAt", type: "date" },
  ]);

  console.log("\n✅ All collections fixed! Dashboard should work correctly now.\n");
  await mongoose.disconnect();
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
