const mongoose = require("mongoose");
require("dotenv").config();

async function testAtlas() {
  const uri = process.env.MONGO_URI;
  console.log("Testing connection to:", uri.substring(0, 30));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("SUCCESS: Connected to MongoDB Atlas");
    await mongoose.disconnect();
  } catch (err) {
    console.error("FAILURE: Could not connect to Atlas", err.message);
  }
}

testAtlas();
