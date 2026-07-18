const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });
const User = require("../backend/models/User");

async function testUserCounts() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/foodbridge";
    await mongoose.connect(mongoUri);

    const donorCount = await User.countDocuments({ role: "donor" });
    const ngoCount = await User.countDocuments({ role: "ngo" });
    const allRoles = await User.distinct("role");

    console.log("User Stats:", {
      donorCount,
      ngoCount,
      allRoles,
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testUserCounts();
