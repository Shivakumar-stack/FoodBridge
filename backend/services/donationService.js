const {
  GEOCODE_DEFAULT_COUNTRY,
  extractCoordinates,
} = require("./geocodingService");

const VALID_FOOD_CATEGORIES = new Set([
  "Cooked Food",
  "Raw Ingredients",
  "Packaged",
  "Baked Goods",
  "Beverages",
  "Dairy",
  "Fruits",
  "Vegetables",
  "Other",
]);

const VALID_STORAGE_TYPES = new Set([
  "room_temp",
  "refrigerated",
  "frozen",
  "heated",
]);

const DONOR_POLICIES = {
  starter: {
    tier: "starter",
    maxDailyDonations: 2,
    minIntervalMinutes: 180,
    maxItems: 5,
    maxServings: 150,
    maxPendingDonations: 3,
  },
  growing: {
    tier: "growing",
    maxDailyDonations: 4,
    minIntervalMinutes: 90,
    maxItems: 10,
    maxServings: 350,
    maxPendingDonations: 6,
  },
  verified: {
    tier: "verified",
    maxDailyDonations: 10,
    minIntervalMinutes: 30,
    maxItems: 20,
    maxServings: 1000,
    maxPendingDonations: 12,
  },
  trusted: {
    tier: "trusted",
    maxDailyDonations: 25,
    minIntervalMinutes: 0,
    maxItems: 40,
    maxServings: 3000,
    maxPendingDonations: 30,
  },
};

function normalizeStatusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeRequestedStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (!value) return null;

  if (["pending"].includes(value)) return "pending";
  if (["claimed", "accepted", "picked_up", "in_transit"].includes(value))
    return "claimed";
  if (["closed", "delivered"].includes(value)) return "closed";
  if (["cancelled", "expired"].includes(value)) return "cancelled";

  return null;
}

function calculatePriorityScore(donation, referenceDate = new Date()) {
  const pickupDate = new Date(donation?.pickupDatetime);
  if (Number.isNaN(pickupDate.getTime())) return 0;

  const hoursLeft =
    (pickupDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= 0) return 0;

  const servings = Number(donation?.impact?.estimatedServings) || 0;
  let score = 0;

  // Urgency boost
  if (hoursLeft < 6) score += 50;
  else if (hoursLeft < 24) score += 30;

  // High serving boost
  if (servings > 100) score += 40;
  else if (servings > 50) score += 20;

  // Pending boost
  if (donation?.status === "pending") score += 20;

  return score;
}

function getDonorTier(user) {
  const totalDonations = Number(user?.donorInfo?.totalDonations) || 0;
  const isVerified = Boolean(user?.donorInfo?.isVerified);
  const hasOrganization = Boolean(user?.organization?.name);

  if (isVerified && (hasOrganization || totalDonations >= 50)) {
    return "trusted";
  }

  if (isVerified) {
    return "verified";
  }

  if (totalDonations >= 10) {
    return "growing";
  }

  return "starter";
}

function getPolicyMetadata(policy) {
  return {
    tier: policy.tier,
    maxDailyDonations: policy.maxDailyDonations,
    minIntervalMinutes: policy.minIntervalMinutes,
    maxItems: policy.maxItems,
    maxServings: policy.maxServings,
    maxPendingDonations: policy.maxPendingDonations,
  };
}

function parseServingEstimateFromQuantity(quantity) {
  const text = String(quantity || "").toLowerCase();
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;

  if (/kg|kilogram/.test(text)) return Math.round(value * 8);
  if (/(^|\s)g(ram)?(\s|$)/.test(text)) return Math.round((value / 1000) * 8);
  if (/l(itre|iter)?/.test(text)) return Math.round(value * 5);
  if (/ml/.test(text)) return Math.round((value / 1000) * 5);
  if (/tray|box|pack|packet|bag/.test(text)) return Math.round(value * 10);
  if (/plate|meal|serving|portion/.test(text)) return Math.round(value);

  return Math.round(value * 4);
}

function estimateServingsFromFoodItems(foodItems = []) {
  const estimated = foodItems.reduce((total, item) => {
    return total + parseServingEstimateFromQuantity(item?.quantity);
  }, 0);

  if (estimated > 0) return estimated;
  return Math.max(foodItems.length * 5, 0);
}

function normalizeEstimatedServings(impact, foodItems = []) {
  const providedValue = Number(impact?.estimatedServings);
  if (Number.isFinite(providedValue) && providedValue > 0) {
    return Math.round(providedValue);
  }
  return estimateServingsFromFoodItems(foodItems);
}

function getDayRange(reference = new Date()) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function normalizeTextValue(value) {
  return String(value || "").trim();
}

function normalizeOptionalDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStringList(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return list.map((entry) => normalizeTextValue(entry)).filter(Boolean);
}

function normalizeFoodItemsPayload(items = []) {
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const itemName = normalizeTextValue(item?.itemName || item?.name);
      let category = normalizeTextValue(item?.category);
      const quantity = normalizeTextValue(item?.quantity);
      const unit = normalizeTextValue(item?.unit);

      if (!itemName || !quantity || !unit) {
        return null;
      }

      // FAKE AI: Smart categorization based on keywords
      if (!category || !VALID_FOOD_CATEGORIES.has(category)) {
        const lowerName = itemName.toLowerCase();
        if (lowerName.includes("rice") || lowerName.includes("curry") || lowerName.includes("meal") || lowerName.includes("pizza") || lowerName.includes("cooked")) {
          category = "Cooked Food";
        } else if (lowerName.includes("apple") || lowerName.includes("banana") || lowerName.includes("fruit")) {
          category = "Fruits";
        } else if (lowerName.includes("tomato") || lowerName.includes("potato") || lowerName.includes("onion") || lowerName.includes("veg")) {
          category = "Vegetables";
        } else if (lowerName.includes("milk") || lowerName.includes("cheese") || lowerName.includes("paneer") || lowerName.includes("yogurt")) {
          category = "Dairy";
        } else if (lowerName.includes("bread") || lowerName.includes("cake") || lowerName.includes("biscuit") || lowerName.includes("cookie")) {
          category = "Baked Goods";
        } else if (lowerName.includes("juice") || lowerName.includes("water") || lowerName.includes("drink")) {
          category = "Beverages";
        } else if (lowerName.includes("flour") || lowerName.includes("dal") || lowerName.includes("lentil") || lowerName.includes("sugar")) {
          category = "Raw Ingredients";
        } else if (lowerName.includes("packet") || lowerName.includes("chips") || lowerName.includes("can")) {
          category = "Packaged";
        } else {
          category = "Other";
        }
      }

      const normalized = { itemName, category, quantity, unit };
      const servings = Number(item?.servings);
      const allergens = normalizeStringList(item?.allergens);
      const specialNotes = normalizeTextValue(item?.specialNotes);

      if (Number.isFinite(servings) && servings > 0) {
        normalized.servings = Math.round(servings);
      }

      if (allergens.length) {
        normalized.allergens = allergens;
      }

      if (specialNotes) {
        normalized.specialNotes = specialNotes;
      }

      return normalized;
    })
    .filter(Boolean);
}

function normalizePickupAddressPayload(payload = {}) {
  const address = normalizeTextValue(
    payload?.address ||
      payload?.street ||
      payload?.pickupAddress?.street ||
      payload?.pickupAddress?.addressLine1 ||
      payload?.pickupAddress?.address ||
      payload?.pickupAddress?.line1,
  );
  const city = normalizeTextValue(
    payload?.city || payload?.pickupAddress?.city,
  );
  const state = normalizeTextValue(
    payload?.state || payload?.pickupAddress?.state,
  );
  const zip = normalizeTextValue(
    payload?.zip ||
      payload?.zipCode ||
      payload?.pickupAddress?.zipCode ||
      payload?.pickupAddress?.postalCode ||
      payload?.pickupAddress?.zipcode ||
      payload?.pickupAddress?.pinCode ||
      payload?.pickupAddress?.pin,
  );
  const country = normalizeTextValue(
    payload?.country ||
      payload?.pickupAddress?.country ||
      GEOCODE_DEFAULT_COUNTRY,
  );

  const normalizedAddress = {
    address,
    city,
    state,
    zip,
    country,
  };

  const coordinates = extractCoordinates(payload?.pickupAddress || payload);
  if (coordinates) {
    normalizedAddress.coordinates = coordinates;
  }

  return normalizedAddress;
}

function normalizePickupWindowPayload(pickupWindow) {
  if (!pickupWindow || typeof pickupWindow !== "object") return null;

  const start = normalizeOptionalDateValue(pickupWindow?.start);
  const end = normalizeOptionalDateValue(pickupWindow?.end);

  if (!start && !end) return null;
  if (start && end && end < start) return null;

  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  };
}

function normalizeFoodSafetyPayload(foodSafety, items = []) {
  if (!foodSafety || typeof foodSafety !== "object") foodSafety = {};

  const preparedTime = normalizeOptionalDateValue(foodSafety?.preparedTime);
  let expiryTime = normalizeOptionalDateValue(foodSafety?.expiryTime);
  const storageType = normalizeTextValue(foodSafety?.storageType).toLowerCase();
  const temperature = Number(foodSafety?.temperature);
  const packaging = normalizeTextValue(foodSafety?.packaging);

  // FAKE AI: Smart Expiry Estimate
  if (!expiryTime && items && items.length > 0) {
    const categories = items.map(i => i.category);
    let hoursToAdd = 48; // Default 2 days
    
    if (categories.includes("Cooked Food") || categories.includes("Dairy") || categories.includes("Beverages")) {
      hoursToAdd = 6; // High risk, expire soon
    } else if (categories.includes("Baked Goods") || categories.includes("Fruits") || categories.includes("Vegetables")) {
      hoursToAdd = 72; // 3 days
    } else if (categories.includes("Packaged") || categories.includes("Raw Ingredients") || categories.includes("Other")) {
      hoursToAdd = 720; // 30 days
    }

    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hoursToAdd);
    expiryTime = expiry;
  }

  const normalized = {};
  if (preparedTime) normalized.preparedTime = preparedTime;
  if (expiryTime) normalized.expiryTime = expiryTime;
  if (storageType && VALID_STORAGE_TYPES.has(storageType))
    normalized.storageType = storageType;
  if (Number.isFinite(temperature)) normalized.temperature = temperature;
  if (packaging) normalized.packaging = packaging;

  return Object.keys(normalized).length ? normalized : null;
}

function logDonationPayloadSummary(rawPayload, normalizedPayload, donorId) {
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    return;
  }

  console.debug("[DonationPayloadSummary]", {
    donorId: String(donorId),
    rawPayloadKeys: Object.keys(rawPayload || {}),
    normalizedPayload,
  });
}

function toComparableId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function isSameUserId(left, right) {
  const leftId = toComparableId(left);
  const rightId = toComparableId(right);
  if (!leftId || !rightId) return false;
  return leftId === rightId;
}

function isDonationUnassigned(donation) {
  return !toComparableId(donation?.assignedVolunteer);
}

function isVolunteerQueueDonation(donation) {
  const status = String(donation?.status || "").toLowerCase();
  return status === "claimed" && isDonationUnassigned(donation);
}

function buildVolunteerOpenDonationQuery() {
  return {
    status: "claimed",
    assignedVolunteer: null,
  };
}

function buildVolunteerDonationVisibilityQuery(userId) {
  return {
    $or: [
      buildVolunteerOpenDonationQuery(),
      { assignedVolunteer: userId },
    ],
  };
}

function canAccessDonation(user, donation) {
  const role = String(user?.role || "").toLowerCase();

  if (!user || !donation || !role) return false;
  if (role === "admin") return true;

  if (role === "donor") {
    return isSameUserId(donation.donorId, user._id || user.id);
  }

  if (role === "ngo") {
    const status = String(donation.status || "").toLowerCase();
    const isAvailable = ["pending", "broadcasted"].includes(status);
    const isClaimedByNgo = isSameUserId(donation.claimedBy, user._id || user.id);
    return isAvailable || isClaimedByNgo;
  }

  if (role === "volunteer") {
    const isAssigned = isSameUserId(donation.assignedVolunteer, user._id || user.id);
    const isOpenQueue = isVolunteerQueueDonation(donation);
    return isAssigned || isOpenQueue;
  }

  return false;
}

function canViewDonationImage(user, donation) {
  if (!donation?.image) return false;

  // If the user has access to view the donation, they should be able to see its image.
  // This allows NGOs and Volunteers to see the image on the dashboard before claiming/accepting.
  return canAccessDonation(user, donation);
}

function sanitizeDonationForUser(donation, user) {
  const plain =
    donation && typeof donation.toObject === "function"
      ? donation.toObject()
      : { ...(donation || {}) };

  if (!canViewDonationImage(user, plain)) {
    plain.image = null;
  }

  return plain;
}

module.exports = {
  normalizeStatusLabel,
  normalizeRequestedStatus,
  calculatePriorityScore,
  DONOR_POLICIES,
  getDonorTier,
  getPolicyMetadata,
  normalizeEstimatedServings,
  getDayRange,
  normalizeTextValue,
  normalizeFoodItemsPayload,
  normalizePickupAddressPayload,
  normalizePickupWindowPayload,
  normalizeFoodSafetyPayload,
  logDonationPayloadSummary,
  buildVolunteerOpenDonationQuery,
  buildVolunteerDonationVisibilityQuery,
  canAccessDonation,
  canViewDonationImage,
  isVolunteerQueueDonation,
  sanitizeDonationForUser,
};
