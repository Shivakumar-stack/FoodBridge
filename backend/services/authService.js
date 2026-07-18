const User = require("../models/User");
const { AppError } = require("../middlewares/errorHandler");

/**
 * Register a new user
 * @param {Object} userData 
 * @returns {Promise<Object>} user
 */
exports.registerUser = async (userData) => {
  const { firstName, lastName, email, password, role, phone, city, organization } = userData;
  const name = userData.name || `${firstName || ""} ${lastName || ""}`.trim();

  // Security Validation: Prevent self-assignment of admin role
  if (role === "admin") {
    throw new AppError("Unauthorized role assignment. Admin accounts must be created internally.", 403);
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email already registered", 400);
  }

  // Create user
  // Note: password hashing is handled by the User model pre-save hook
  const user = await User.create({
    name,
    firstName,
    lastName,
    email,
    password,
    role,
    phone,
    city,
    organization,
    status: "active" // Default to active to allow immediate login
  });

  return user;
};

/**
 * Login user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} user
 */
exports.loginUser = async (email, password) => {
  if (!email || !password) {
    throw new AppError("Please provide email and password", 400);
  }

  // Check for user and include password for comparison
  const user = await User.findOne({ email }).select("+password");
  
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  // Check status
  if (user.status !== "active") {
    throw new AppError(`Your account is ${user.status}. Please contact support.`, 403);
  }

  return user;
};
