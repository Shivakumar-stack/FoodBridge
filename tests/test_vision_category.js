/**
 * TEST: Hugging Face vision integration and donation category update.
 */

const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..");

function modulePath(relativePath) {
  return path.join(ROOT, relativePath);
}

function clearModule(relativePath) {
  const resolved = require.resolve(modulePath(relativePath));
  delete require.cache[resolved];
}

function stubModule(relativePath, exports) {
  const resolved = require.resolve(modulePath(relativePath));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
}

async function testVisionServiceUsesRouterAndMapsCategory() {
  clearModule("backend/services/visionService.js");

  const originalFetch = global.fetch;
  const originalKey = process.env.HUGGINGFACE_API_KEY;
  const calls = [];

  process.env.HUGGINGFACE_API_KEY = "hf_test_token";
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (calls.length === 1) {
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from("fake-image"),
      };
    }

    return {
      ok: true,
      json: async () => [
        { label: "Granny Smith", score: 0.91 },
        { label: "banana", score: 0.04 },
      ],
    };
  };

  try {
    const visionService = require(modulePath("backend/services/visionService.js"));
    const result = await visionService.analyzeFoodImage("https://res.cloudinary.com/demo/image/upload/v1/apple.webp");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.detectedCategory, "Fruits");
    assert.strictEqual(result.detectedName, "Granny Smith");
    assert.strictEqual(result.confidence, 0.91);
    assert.deepStrictEqual(result.labels.slice(0, 2), ["granny smith", "banana"]);
    assert.strictEqual(
      calls[0].url,
      "https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto,w_768,c_limit/v1/apple.webp",
    );
    assert.strictEqual(
      calls[1].url,
      "https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224",
    );
    assert.strictEqual(calls[1].options.headers.Authorization, "Bearer hf_test_token");
  } finally {
    global.fetch = originalFetch;
    process.env.HUGGINGFACE_API_KEY = originalKey;
    clearModule("backend/services/visionService.js");
  }
}

async function testDonationCreationUpdatesPrimaryItemCategory() {
  let createdDonationData = null;

  stubModule("backend/models/Donation.js", {
    countDocuments: async () => 0,
    create: async (data) => {
      createdDonationData = data;
      return {
        ...data,
        _id: "donation-id",
        save: async () => {},
      };
    },
  });
  stubModule("backend/models/Claim.js", {});
  stubModule("backend/models/Logistics.js", {});
  stubModule("backend/services/visionService.js", {
    analyzeFoodImage: async () => ({
      success: true,
      detectedCategory: "Fruits",
      detectedName: "Granny Smith",
      confidence: 0.91,
      labels: ["granny smith", "banana", "orange"],
    }),
  });
  stubModule("backend/services/geocodingService.js", {
    geocodePickupAddress: async () => null,
    GEOCODE_DEFAULT_COUNTRY: "India",
    extractCoordinates: () => null,
  });
  stubModule("backend/services/logisticsService.js", {
    updateDonationStatus: async () => {},
  });
  stubModule("backend/utils/notification.js", {
    sendNotification: () => {},
  });
  clearModule("backend/controllers/donationController.js");

  try {
    const donationController = require(modulePath("backend/controllers/donationController.js"));
    const req = {
      body: {
        items: [
          {
            itemName: "Food tray",
            category: "Other",
            quantity: "5",
            unit: "kg",
          },
        ],
        address: "1 Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        zip: "560001",
        pickupDatetime: new Date(Date.now() + 3600000).toISOString(),
      },
      file: {
        secure_url: "https://res.cloudinary.test/food.jpg",
      },
      user: {
        _id: "user-id",
        firstName: "Test",
        lastName: "Donor",
        role: "donor",
        donorInfo: {},
      },
      app: {
        get: () => null,
      },
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };

    await donationController.createDonation(req, res, (err) => {
      throw err;
    });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDonationData.items[0].itemName, "Granny Smith");
    assert.strictEqual(createdDonationData.items[0].category, "Fruits");
    assert.match(
      createdDonationData.items[0].specialNotes,
      /Auto-labeled by Vision API: granny smith, banana, orange/,
    );
    assert.strictEqual(res.body.data.items[0].itemName, "Granny Smith");
    assert.strictEqual(res.body.data.items[0].category, "Fruits");
  } finally {
    [
      "backend/controllers/donationController.js",
      "backend/models/Donation.js",
      "backend/models/Claim.js",
      "backend/models/Logistics.js",
      "backend/services/visionService.js",
      "backend/services/geocodingService.js",
      "backend/services/logisticsService.js",
      "backend/utils/notification.js",
    ].forEach(clearModule);
  }
}

(async () => {
  await testVisionServiceUsesRouterAndMapsCategory();
  await testDonationCreationUpdatesPrimaryItemCategory();
  console.log("VISION CATEGORY TEST: PASS");
})().catch((error) => {
  console.error("VISION CATEGORY TEST: FAIL");
  console.error(error);
  process.exit(1);
});
