/**
 * Converts donations.json to MongoDB Extended JSON format.
 * This ensures _id → ObjectId, dates → ISODate when imported via Compass.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "dataset", "donations.json");
const d = JSON.parse(fs.readFileSync(SRC, "utf8"));

function toOid(s) {
  return s ? { $oid: s } : null;
}
function toDate(s) {
  return s ? { $date: s } : null;
}

const converted = d.map((don) => ({
  _id: toOid(don._id),
  donorId: toOid(don.donorId),
  donorName: don.donorName,
  claimedBy: don.claimedBy ? toOid(don.claimedBy) : null,
  assignedVolunteer: don.assignedVolunteer ? toOid(don.assignedVolunteer) : null,
  items: don.items,
  image: don.image,
  address: don.address,
  city: don.city,
  state: don.state,
  zip: don.zip,
  lat: don.lat,
  lng: don.lng,
  pickupDatetime: toDate(don.pickupDatetime),
  pickupWindow: don.pickupWindow
    ? {
        start: toDate(don.pickupWindow.start),
        end: toDate(don.pickupWindow.end),
      }
    : undefined,
  status: don.status,
  statusHistory: (don.statusHistory || []).map((h) => ({
    status: h.status,
    timestamp: toDate(h.timestamp),
    updatedBy: toOid(h.updatedBy),
    notes: h.notes || undefined,
  })),
  cancelledBy: don.cancelledBy ? toOid(don.cancelledBy) : null,
  cancellationReason: don.cancellationReason || null,
  priority: don.priority,
  priorityScore: don.priorityScore,
  notes: don.notes || "",
  foodSafety: don.foodSafety
    ? {
        preparedTime: toDate(don.foodSafety.preparedTime),
        expiryTime: toDate(don.foodSafety.expiryTime),
        storageType: don.foodSafety.storageType,
        packaging: don.foodSafety.packaging,
      }
    : undefined,
  impact: don.impact,
  isRecurring: don.isRecurring || false,
  createdAt: toDate(don.createdAt),
  updatedAt: toDate(don.updatedAt),
}));

fs.writeFileSync(SRC, JSON.stringify(converted, null, 2));
console.log(
  `✔ Converted ${converted.length} donations to MongoDB Extended JSON`,
);
console.log(`  Sample _id:       ${JSON.stringify(converted[0]._id)}`);
console.log(`  Sample createdAt: ${JSON.stringify(converted[0].createdAt)}`);
console.log(`  Sample donorId:   ${JSON.stringify(converted[0].donorId)}`);
