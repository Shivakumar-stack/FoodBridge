/**
 * TEST: Live-map donation API contract.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function runChecks() {
  console.log("===================================================");
  console.log("  TEST 8: Live Map Contract");
  console.log("===================================================\n");

  const Donation = require(path.join(ROOT, "backend", "models", "Donation.js"));
  const controllerSource = fs.readFileSync(
    path.join(ROOT, "backend", "controllers", "donationController.js"),
    "utf8",
  );

  const donation = new Donation({
    donorId: "507f1f77bcf86cd799439011",
    donorName: "Demo Kitchen",
    items: [
      {
        itemName: "Fruit box",
        category: "Fruits",
        quantity: "3",
        unit: "kg",
        image: "https://res.cloudinary.test/fruit.jpg",
        aiSuggestion: {
          status: "completed",
          detectedName: "Apple",
          detectedCategory: "Fruits",
          confidence: 0.91,
          labels: ["apple"],
        },
      },
    ],
    image: "https://res.cloudinary.test/fruit.jpg",
    address: "1 Test Street",
    city: "Bengaluru",
    state: "Karnataka",
    zip: "560001",
    lat: 12.9716,
    lng: 77.5946,
    pickupDatetime: new Date(Date.now() + 3600000),
  });

  const apiShape = donation.toJSON();
  assert.ok(Array.isArray(apiShape.foodItems), "foodItems must be exposed");
  assert.strictEqual(apiShape.foodItems[0].image, "https://res.cloudinary.test/fruit.jpg");
  assert.strictEqual(apiShape.foodItems[0].aiSuggestion.status, "completed");
  assert.strictEqual(apiShape.pickupAddress.coordinates.lat, 12.9716);
  assert.strictEqual(apiShape.pickupAddress.coordinates.lng, 77.5946);

  assert.ok(
    controllerSource.includes("getPublicMapDonations") &&
      controllerSource.includes("lat lng") &&
      controllerSource.includes("items") &&
      controllerSource.includes("image"),
    "public map query must select location, items, and image fields",
  );

  console.log("  PASS: Donation JSON exposes foodItems with image and aiSuggestion");
  console.log("  PASS: Donation JSON exposes pickupAddress coordinates");
  console.log("  PASS: Public map query selects location, item, and image fields");

  return true;
}

try {
  runChecks();
  console.log("\n===================================================");
  console.log("  LIVE MAP CONTRACT TEST: PASS");
  console.log("===================================================\n");
} catch (error) {
  console.error("  FAIL:", error.message);
  console.log("\n===================================================");
  console.log("  LIVE MAP CONTRACT TEST: FAIL");
  console.log("===================================================\n");
  process.exit(1);
}
