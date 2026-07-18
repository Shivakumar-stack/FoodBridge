/**
 * fixTypesRoute.js — Temporary admin route to fix field types
 * Mount this ONCE, run, then remove.
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

async function fixCollection(db, collName, fixes) {
  const coll = db.collection(collName);
  const count = await coll.countDocuments();
  if (count === 0) return `${collName}: empty`;

  let modified = 0;
  const docs = await coll.find({}).toArray();
  for (const doc of docs) {
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
  return `${collName}: ${modified}/${count} fixed`;
}

router.get("/fix-types", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const results = [];

    results.push(await fixCollection(db, "users", [
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "notifications", [
      { field: "user", type: "objectid" },
      { field: "isRead", type: "boolean" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "claims", [
      { field: "donation", type: "objectid" },
      { field: "ngo", type: "objectid" },
      { field: "claimedAt", type: "date" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "logistics", [
      { field: "donation", type: "objectid" },
      { field: "donor", type: "objectid" },
      { field: "volunteer", type: "objectid" },
      { field: "ngo", type: "objectid" },
      { field: "pickupTime", type: "date" },
      { field: "deliveryTime", type: "date" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "deliveries", [
      { field: "donation", type: "objectid" },
      { field: "volunteerId", type: "objectid" },
      { field: "deliveryTime", type: "date" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "pickups", [
      { field: "donation", type: "objectid" },
      { field: "volunteerId", type: "objectid" },
      { field: "pickupTime", type: "date" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "inventorylogs", [
      { field: "mealServer", type: "objectid" },
      { field: "donationId", type: "objectid" },
      { field: "loggedBy", type: "objectid" },
      { field: "quantity", type: "number" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "mealservers", [
      { field: "ngoId", type: "objectid" },
      { field: "lat", type: "number" },
      { field: "lng", type: "number" },
      { field: "capacity", type: "number" },
      { field: "mealsServedDaily", type: "number" },
      { field: "active", type: "boolean" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "volunteers", [
      { field: "userId", type: "objectid" },
      { field: "isAvailable", type: "boolean" },
      { field: "completedPickups", type: "number" },
      { field: "rating", type: "number" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "requests", [
      { field: "ngoId", type: "objectid" },
      { field: "createdAt", type: "date" },
    ]));
    results.push(await fixCollection(db, "contacts", [
      { field: "createdAt", type: "date" },
    ]));

    // Fix admin location
    const updateResult = await db.collection("users").updateOne(
      { email: "admin@foodbridge.org" },
      { $set: { 
          "address.street": "Bangalore Main Office, Karnataka",
          "address.location": { type: "Point", coordinates: [77.5946, 12.9716] } 
        } 
      }
    );
    results.push(`admin location updated: ${updateResult.modifiedCount}`);

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/debug-types", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const sampleNotif = await db.collection("notifications").findOne({});
    const sampleDon = await db.collection("donations").findOne({});
    const sampleUser = await db.collection("users").findOne({});
    const sampleClaim = await db.collection("claims").findOne({});
    const sampleRequest = await db.collection("requests").findOne({});

    const typeOf = (val) => {
      if (val === null || val === undefined) return "null";
      if (val instanceof mongoose.Types.ObjectId) return "ObjectId";
      if (val instanceof Date) return "Date";
      return typeof val;
    };

    res.json({
      notification: sampleNotif ? {
        _id: typeOf(sampleNotif._id),
        user: typeOf(sampleNotif.user),
        user_value: String(sampleNotif.user),
        isRead: typeOf(sampleNotif.isRead),
        isRead_value: sampleNotif.isRead,
        createdAt: typeOf(sampleNotif.createdAt),
        title: sampleNotif.title,
      } : "empty",
      donation: sampleDon ? {
        _id: typeOf(sampleDon._id),
        donorId: typeOf(sampleDon.donorId),
        donorId_value: String(sampleDon.donorId),
        status: sampleDon.status,
        items_type: Array.isArray(sampleDon.items) ? "array" : typeof sampleDon.items,
        items_length: sampleDon.items?.length,
        createdAt: typeOf(sampleDon.createdAt),
        image: sampleDon.image ? "exists" : "missing",
      } : "empty",
      user: sampleUser ? {
        _id: typeOf(sampleUser._id),
        _id_value: String(sampleUser._id),
        role: sampleUser.role,
        email: sampleUser.email,
        createdAt: typeOf(sampleUser.createdAt),
      } : "empty",
      claim: sampleClaim ? {
        _id: typeOf(sampleClaim._id),
        donation: typeOf(sampleClaim.donation),
        ngo: typeOf(sampleClaim.ngo),
        createdAt: typeOf(sampleClaim.createdAt),
      } : "empty",
      requestKeys: sampleRequest ? Object.keys(sampleRequest) : [],
      requestSample: sampleRequest
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
