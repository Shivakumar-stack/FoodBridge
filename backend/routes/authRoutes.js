const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
} = require("../controllers/authController");
const {
  authenticate,
  authorize,
} = require("../middlewares/auth");
const { validateRequest } = require("../middlewares/validateRequest");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message:
      "Too many authentication attempts from this IP, please try again after 15 minutes",
  },
});

// Validation rules
const registerValidation = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters"),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["donor", "volunteer", "ngo", "admin"])
    .withMessage("Invalid role specified"),
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\d{10}$/)
    .withMessage("Please enter a valid 10-digit phone number"),
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),
  body("phone")
    .optional()
    .trim()
    .matches(/^\d{10}$/)
    .withMessage("Please enter a valid 10-digit phone number"),
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Bio cannot exceed 500 characters"),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters"),
];

// Public routes
router.post(
  "/register",
  authLimiter,
  registerValidation,
  validateRequest,
  register,
);
router.post("/login", authLimiter, loginValidation, validateRequest, login);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.put(
  "/profile",
  authenticate,
  updateProfileValidation,
  validateRequest,
  updateProfile,
);
router.put(
  "/change-password",
  authenticate,
  changePasswordValidation,
  validateRequest,
  changePassword,
);
router.post("/logout", authenticate, logout);

// Admin only routes
router.get(
  "/admin/users",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    const User = require("../models/User");
    try {
      const users = await User.find()
        .select("-password")
        .sort({ createdAt: -1 });
      res.json({
        success: true,
        count: users.length,
        data: { users },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

module.exports = router;
