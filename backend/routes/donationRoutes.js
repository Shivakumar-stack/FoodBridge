const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { authenticate, authorize } = require("../middlewares/auth");
const { validateRequest } = require("../middlewares/validateRequest");
const upload = require("../middlewares/upload");

const parseMultipartJSON = (req, res, next) => {
  if (req.body.items && typeof req.body.items === "string") {
    try { 
      req.body.items = JSON.parse(req.body.items); 
    } catch (e) {
      req.body.items = [];
    }
  }

  // Reconstruct nested objects (e.g., impact[estimatedServings] -> impact.estimatedServings)
  for (const key in req.body) {
    const match = key.match(/^(\w+)\[(\w+)\]$/);
    if (match) {
      const parent = match[1];
      const child = match[2];
      if (!req.body[parent]) {
        req.body[parent] = {};
      }
      req.body[parent][child] = req.body[key];
      delete req.body[key];
    }
  }

  next();
};

const {
  createDonation,
  getDonations,
  getDonationById,
  getPublicMapDonations,
  getDonationStats,
  getWeeklyTrends,
  updateDonationStatus,
  getAvailableDonationsForVolunteer,
  getAvailableDonationsForNgo,
  claimDonation,
  getAdminStats,
} = require("../controllers/donationController");

const donationValidation = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one food item is required"),
  body("items.*.itemName")
    .trim()
    .notEmpty()
    .withMessage("Food item name is required"),
  body("items.*.category")
    .isIn([
      "Cooked Food",
      "Raw Ingredients",
      "Packaged",
      "Baked Goods",
      "Beverages",
      "Dairy",
      "Fruits",
      "Vegetables",
      "Other",
    ])
    .withMessage("Invalid food category"),
  body("items.*.quantity")
    .trim()
    .notEmpty()
    .withMessage("Quantity is required"),
  body("items.*.unit").trim().notEmpty().withMessage("Unit is required"),
  body("address").trim().notEmpty().withMessage("Street address is required"),
  body("city").trim().notEmpty().withMessage("City is required"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("zip").trim().notEmpty().withMessage("ZIP Code is required"),
  body("pickupDatetime")
    .notEmpty()
    .isISO8601()
    .withMessage("Invalid pickup time format"),
  body("priority")
    .optional()
    .isIn([
      "low",
      "medium",
      "high",
      "critical",
      "Fast Track (+2h)",
      "Priority (+4h)",
      "Tomorrow Morning",
    ])
    .withMessage("Invalid priority level"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

// Wrap multer upload in error handling so Cloudinary failures
// return a 400 response instead of crashing the server.
const handleUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error("[Upload] Multer/Cloudinary error:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message || "Image upload failed. Please try again without an image or use a smaller file.",
      });
    }
    next();
  });
};

router.post(
  "/",
  authenticate,
  authorize("donor", "admin"),
  handleUpload,
  parseMultipartJSON,
  donationValidation,
  validateRequest,
  createDonation,
);
router.get("/", authenticate, getDonations);
router.get("/public-map", getPublicMapDonations);
router.get("/stats/overview", authenticate, getDonationStats);
router.get("/stats/weekly", authenticate, getWeeklyTrends);
router.get("/stats/admin", authenticate, authorize("admin"), getAdminStats);
router.put(
  "/:id/status",
  authenticate,
  authorize("donor", "volunteer", "ngo", "admin"),
  updateDonationStatus,
);
router.get(
  "/volunteer/available",
  authenticate,
  authorize("volunteer"),
  getAvailableDonationsForVolunteer,
);
router.get(
  "/ngo/available",
  authenticate,
  authorize("ngo"),
  getAvailableDonationsForNgo,
);
router.get("/:id", authenticate, getDonationById);
router.put("/:id/claim", authenticate, authorize("ngo"), claimDonation);

module.exports = router;
