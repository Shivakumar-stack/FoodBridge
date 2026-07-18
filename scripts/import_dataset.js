const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const DATASET_DIR = path.join(__dirname, "../dataset");
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/foodbridge";

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

async function importUsers() {
  console.log("Starting Users import...");
  const data = fs.readFileSync(path.join(DATASET_DIR, "users.csv"), "utf8");
  const lines = data.split("\n").filter((line) => line.trim() !== "");
  
  const docs = [];
  console.log(`Processing ${lines.length - 1} users...`);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const v = line.split(",");
    if (v.length < 3) continue;
    
    // Hash password (serial to avoid overwhelming CPU)
    const hashedPassword = await hashPassword(v[2] || "password123");
    
    docs.push({
      _id: new mongoose.Types.ObjectId(v[0]),
      email: v[1],
      password: hashedPassword,
      role: v[3],
      firstName: v[4],
      lastName: v[5],
      name: `${v[4]} ${v[5]}`,
      organization: { 
        name: v[6],
        type: "other"
      },
      city: v[7],
      address: { 
        city: v[7], 
        state: "TestState",
        country: "India",
        location: { type: "Point", coordinates: [0, 0] }
      },
      phone: v[8],
      donorInfo: {
        totalDonations: v[3] === "donor" ? 1 : 0,
        mealsProvided: v[3] === "donor" ? 40 : 0,
        isVerified: false
      },
      volunteerInfo: {
        completedPickups: v[3] === "volunteer" ? 1 : 0,
        rating: 5,
        isAvailable: true,
        vehicleType: "none",
        serviceArea: []
      },
      ngoInfo: { beneficiaries: v[3] === "ngo" ? 500 : 0, isVerified: true },
      status: "active",
      loginCount: 0,
      isEmailVerified: true,
      avatar: "",
      __v: 0
    });
    
    if (i % 100 === 0) {
      console.log(`Processed ${i} users...`);
    }
  }
  
  const coll = mongoose.connection.collection("users");
  await coll.deleteMany({});
  if (docs.length > 0) {
    await coll.insertMany(docs);
  }
  console.log(`Imported ${docs.length} Users`);
}

async function importDonations() {
  console.log("Starting Donations import...");
  const data = fs.readFileSync(path.join(DATASET_DIR, "donations.csv"), "utf8");
  const lines = data.split("\n").filter((line) => line.trim() !== "");
  
  const docs = lines.slice(1).map((line) => {
    const v = line.split(",");
    return {
      _id: new mongoose.Types.ObjectId(v[0]),
      donor_id: new mongoose.Types.ObjectId(v[1]),
      donorName: v[2],
      address: v[3],
      city: v[4],
      state: v[5],
      zip: v[6],
      status: v[7],
      priority: v[8],
      notes: v[9],
      items: [
        { itemName: v[10], category: v[11], quantity: v[12], unit: v[13] },
      ],
      pickup_datetime: new Date(),
      impact: { estimatedServings: 40, weightKg: 10 },
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    };
  });
  
  const coll = mongoose.connection.collection("donations");
  await coll.deleteMany({});
  if (docs.length > 0) {
    await coll.insertMany(docs);
  }
  console.log(`Imported ${docs.length} Donations`);
}

async function runImport() {
  try {
    console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    await importUsers();
    await importDonations();

    const simpleFiles = [
      { coll: "volunteers", file: "volunteers.csv" },
      { coll: "deliveries", file: "deliveries.csv" },
      { coll: "mealservers", file: "meal_servers.csv" },
      { coll: "inventorylogs", file: "inventory_logs.csv" },
    ];

    for (const f of simpleFiles) {
      console.log(`Starting ${f.coll} import...`);
      const data = fs.readFileSync(path.join(DATASET_DIR, f.file), "utf8");
      const lines = data.split("\n").filter((line) => line.trim() !== "");
      const headers = lines[0].split(",");
      
      const docs = lines.slice(1).map((line) => {
        const values = line.split(",");
        const doc = {};
        headers.forEach((h, i) => (doc[h.trim()] = values[i]));
        // Try to cast _id if it looks like one
        if (doc._id && doc._id.length === 24) {
          try {
            doc._id = new mongoose.Types.ObjectId(doc._id);
          } catch (e) {
            console.warn("Skipping invalid _id during import:", doc._id);
          }
        }
        doc.createdAt = new Date();
        doc.updatedAt = new Date();
        doc.__v = 0;
        return doc;
      });
      
      const coll = mongoose.connection.collection(f.coll);
      await coll.deleteMany({});
      if (docs.length > 0) {
        await coll.insertMany(docs);
      }
      console.log(`Imported ${docs.length} into ${f.coll}`);
    }

    console.log("\n--- All data imported successfully with ObjectId casting ---");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Import failed:", err);
    process.exit(1);
  }
}

runImport();
