const mongoose = require("mongoose");
require("dotenv").config();
const dns = require("dns");

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("Unable to set custom DNS servers:", err.message);
}

async function debugDB() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    const dbName = mongoose.connection.db.databaseName;
    console.log("Connected to Database:", dbName);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Found Collections in Atlas:");
    for (const coll of collections) {
      const count = await mongoose.connection.collection(coll.name).countDocuments();
      console.log(` - ${coll.name}: ${count} records`);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Debug failed:", err.message);
  }
}

debugDB();
