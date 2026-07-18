const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

async function checkDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/foodbridge";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const collections = ["User", "Donation", "Volunteer", "Delivery"];
    const results = {};

    for (const col of collections) {
      const count = await mongoose.connection.db
        .collection(col.toLowerCase() + "s")
        .countDocuments();
      results[col] = count;
    }

    console.log("Collection Counts:", JSON.stringify(results, null, 2));

    // Check specific models
    const User = mongoose.model("User", new mongoose.Schema({}), "users");
    const Donation = mongoose.model(
      "Donation",
      new mongoose.Schema({}),
      "donations",
    );

    const userCount = await User.countDocuments();
    const donationCount = await Donation.countDocuments();

    console.log("Model Counts (users/donations):", {
      userCount,
      donationCount,
    });

    process.exit(0);
  } catch (err) {
    console.error("Database Check Failed:", err);
    process.exit(1);
  }
}

checkDatabase();
