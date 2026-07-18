/**
 * generate-map-test-data.js — Create test donations for map testing
 * Usage: node scripts/generate-map-test-data.js
 *
 * Creates donations with various statuses to test role-based visibility
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../backend/models/User");
const Donation = require("../backend/models/Donation");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/foodbridge";

const KARNATAKA_CITIES = [
  { city: "Bangalore", lat: 12.9716, lng: 77.5946 },
  { city: "Mysore", lat: 12.2958, lng: 76.6394 },
  { city: "Hubli", lat: 15.3647, lng: 75.124 },
  { city: "Mangalore", lat: 12.9141, lng: 74.856 },
  { city: "Belgaum", lat: 15.8497, lng: 74.4977 },
  { city: "Dharwad", lat: 15.4589, lng: 75.0078 },
  { city: "Bellary", lat: 15.0574, lng: 76.8824 },
  { city: "Tumkur", lat: 13.3389, lng: 77.1015 },
  { city: "Shimoga", lat: 13.9299, lng: 75.5681 },
  { city: "Hassan", lat: 13.0034, lng: 76.1014 },
];

const STATUSES = [
  "pending",
  "broadcasted",
  "claimed",
  "accepted",
  "picked_up",
  "in_transit",
];

const FOOD_ITEMS = [
  {
    name: "Veg Biryani",
    category: "Cooked Food",
    quantity: 50,
    unit: "servings",
  },
  {
    name: "Plain Rice",
    category: "Cooked Food",
    quantity: 100,
    unit: "servings",
  },
  {
    name: "Dal Khichdi",
    category: "Cooked Food",
    quantity: 30,
    unit: "servings",
  },
  { name: "Chapathi", category: "Cooked Food", quantity: 100, unit: "pieces" },
  { name: "Rice Bags", category: "Raw Ingredients", quantity: 10, unit: "kg" },
  { name: "Wheat Flour", category: "Raw Ingredients", quantity: 5, unit: "kg" },
  {
    name: "Packed Snacks",
    category: "Packaged",
    quantity: 20,
    unit: "packets",
  },
  { name: "Fruits", category: "Fruits", quantity: 15, unit: "kg" },
];

const DONORS = [
  "Taj West End",
  "Radisson Blu",
  "ITC Gardenia",
  "Leela Palace",
  "Forum Mall Food Court",
  "Mantri Square",
  "Phoenix Marketcity",
  "UB City",
];

const NOTES = [
  "Freshly prepared, temperature maintained",
  "Excess from event function",
  "Daily surplus from restaurant",
  "Hotel excess - fresh items",
];

async function generateDonations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const donor = await User.findOne({ role: "donor" }).limit(1);
    if (!donor) {
      console.log("No donor user found. Creating anonymous reference...");
    }

    const count = STATUSES.length * 3;
    console.log(`Creating ${count} test donations...`);

    await Donation.deleteMany({
      "foodItems.name": { $regex: /^Test/ },
    });

    let created = 0;
    for (let i = 0; i < STATUSES.length; i++) {
      const status = STATUSES[i];
      for (let j = 0; j < 3; j++) {
        const city = KARNATAKA_CITIES[(i + j) % KARNATAKA_CITIES.length];
        const food = FOOD_ITEMS[(i + j) % FOOD_ITEMS.length];
        const donorName = DONORS[(i + j) % DONORS.length];

        const donation = new Donation({
          donor_id: donor?._id || null,
          donorName,
          foodItems: [
            {
              name: food.name,
              category: food.category,
              quantity: food.quantity,
              unit: food.unit,
            },
          ],
          pickupAddress: {
            street: `${100 + created} Test Street`,
            city: city.city,
            state: "Karnataka",
            zipCode: `${560001 + created}`,
          },
          lat: city.lat + (Math.random() - 0.5) * 0.1,
          lng: city.lng + (Math.random() - 0.5) * 0.1,
          pickupTime: new Date(Date.now() + i * 3600000),
          priority: ["low", "medium", "high"][(i + j) % 3],
          status: status,
          notes: NOTES[(i + j) % NOTES.length],
          availableQuantity: food.quantity,
          estimatedServings: food.quantity,
        });

        await donation.save();
        created++;
      }
    }

    console.log(`✅ Created ${created} test donations with various statuses`);

    const counts = await Donation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    console.log("\nCurrent donation counts by status:");
    counts.forEach((c) => console.log(`  ${c._id}: ${c.count}`));

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

generateDonations();
