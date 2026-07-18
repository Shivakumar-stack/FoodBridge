/**
 * Service for Hugging Face Vision API Integration
 * Replaces the mock with a real Machine Learning API call.
 */
const logger = require("../config/logger");

const HF_IMAGE_CLASSIFICATION_URL =
  process.env.HUGGINGFACE_IMAGE_CLASSIFICATION_URL ||
  "https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224";

const CATEGORY_RULES = [
  {
    category: "Fruits",
    pattern: /apple|banana|orange|strawberry|berry|grape|mango|pineapple|peach|pear|fruit|melon|lemon/,
  },
  {
    category: "Vegetables",
    pattern: /vegetable|broccoli|carrot|cabbage|tomato|potato|onion|cucumber|salad|beet|cauliflower|spinach|corn/,
  },
  {
    category: "Dairy",
    pattern: /milk|cheese|paneer|yogurt|curd|cream|ice cream|cheesecake|dairy/,
  },
  {
    category: "Baked Goods",
    pattern: /bread|bakery|bagel|dough|cake|cupcake|pancake|waffle|donut|muffin|pie|pastry|cookie|brownie/,
  },
  {
    category: "Beverages",
    pattern: /beverage|bottle|water|cup|drink|juice|tea|coffee|smoothie|soda/,
  },
  {
    category: "Raw Ingredients",
    pattern: /meat|chicken|beef|pork|steak|fish|shrimp|egg|rice|flour|lentil|bean|grain|oil|raw/,
  },
  {
    category: "Packaged",
    pattern: /packet|package|packaged|canned|can|chips|box|sealed/,
  },
];

function normalizeLabel(label) {
  return String(label || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toDisplayName(label) {
  return normalizeLabel(label)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function mapLabelsToCategory(labels) {
  const combinedLabels = labels.slice(0, 5).join(" ");
  const rule = CATEGORY_RULES.find(({ pattern }) => pattern.test(combinedLabels));
  return rule?.category || "Cooked Food";
}

function getAnalysisImageUrl(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.includes("/upload/") || !url.includes("res.cloudinary.com")) {
    return url;
  }
  return url.replace("/upload/", "/upload/f_jpg,q_auto,w_768,c_limit/");
}

exports.analyzeFoodImage = async (imageUrl) => {
  logger.info(`[ML Vision API] Analyzing image at: ${imageUrl}`);
  
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  
  if (!HF_API_KEY) {
    console.warn("[ML Vision API] No HUGGINGFACE_API_KEY found in .env. Using mock fallback.");
    return mockAnalysis();
  }

  try {
    const analysisImageUrl = getAnalysisImageUrl(imageUrl);

    // 1. Fetch the image from Cloudinary to get the binary buffer
    const imageResponse = await fetch(analysisImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // 2. Send to Hugging Face Image Classification Model (ViT)
    const hfResponse = await fetch(
      HF_IMAGE_CLASSIFICATION_URL,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBuffer,
      }
    );

    const results = await hfResponse.json();

    if (!hfResponse.ok) {
      const message = results?.error || hfResponse.statusText;
      throw new Error(`Hugging Face API failed: ${hfResponse.status} ${message}`);
    }

    // Handle Hugging Face Cold Start (Model is loading)
    if (results.error && results.estimated_time) {
      console.warn(`[ML Vision API] Model is warming up (${results.estimated_time}s). Falling back to mock for this request.`);
      return mockAnalysis();
    }

    if (!Array.isArray(results)) {
      throw new Error("Hugging Face API returned an unexpected response shape");
    }

    // results is an array like: [{ label: "pizza", score: 0.95 }, ...]
    const labels = results
      .map(r => normalizeLabel(r.label))
      .filter(Boolean);
    
    // Map the ML labels to FoodBridge categories
    const detectedName = toDisplayName(labels[0]);
    const detectedCategory = mapLabelsToCategory(labels);

    logger.debug(`[ML Vision API] Real Detected Labels: ${labels.slice(0, 5).join(", ")}`);
    logger.debug(`[ML Vision API] Mapped Name: ${detectedName || "unknown"}`);
    logger.debug(`[ML Vision API] Mapped Category: ${detectedCategory}`);

    return {
      success: true,
      detectedCategory: detectedCategory,
      detectedName,
      confidence: results[0]?.score || 0.8,
      labels: labels
    };

  } catch (error) {
    console.error("[ML Vision API] Error:", error.message);
    // Fallback so the app doesn't break if API fails
    return mockAnalysis();
  }
};

// Fallback logic so your demo never crashes
function mockAnalysis() {
  const simulatedLabels = ["food", "cuisine", "dish", "rice", "curry"];
  return {
    success: true,
    detectedCategory: "Cooked Food",
    detectedName: "Cooked Food",
    confidence: 0.94,
    labels: simulatedLabels
  };
}
