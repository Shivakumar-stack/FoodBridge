const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });
const Donation = require("../backend/models/Donation");
const User = require("../backend/models/User");

async function testAggregation() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/foodbridge";
    await mongoose.connect(mongoUri);

    // Simulate Admin (empty matchQuery)
    const matchQuery = {};

    const totalDonations = await Donation.countDocuments(matchQuery);
    const impactAgg = await Donation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalServings: { $sum: "$impact.estimatedServings" },
        },
      },
    ]);
    const foodItems = impactAgg.length > 0 ? impactAgg[0].totalServings : 0;
    const activeDonors = await User.countDocuments({ role: "donor" });
    const impactCommunities = await User.countDocuments({ role: "ngo" });

    console.log("Aggregation Results (Admin Simulation):", {
      totalDonations,
      foodItems,
      activeDonors,
      impactCommunities,
    });

    // Sample donation to check structure
    const sample = await Donation.findOne();
    console.log(
      "Sample Donation impact field:",
      sample ? sample.impact : "None",
    );

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testAggregation();
