const mongoose = require("mongoose");
require("dotenv").config();
const dns = require("dns");

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("Unable to set custom DNS servers:", err.message);
}

async function verifyCounts() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    console.log("Connected to Atlas for verification.");
    
    const collections = [
      "users", "volunteers", "donations", "mealservers", "deliveries", 
      "inventorylogs", "requests", "claims", "contacts", "notifications", "pickups"
    ];
    
    console.log("\nRecord Counts:");
    for (const collName of collections) {
      const count = await mongoose.connection.collection(collName).countDocuments();
      console.log(`${collName.padEnd(15)}: ${count}`);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Verification failed:", err.message);
  }
}

verifyCounts();
