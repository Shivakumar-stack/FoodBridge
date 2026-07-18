const User = require("../models/User");
const authService = require("../services/authService");
const { generateToken } = require("../middlewares/auth");

const sendTokenResponse = (user, statusCode, res, message) => {
  const token = generateToken(user._id);

  const options = {
    expires: new Date(
      Date.now() + parseInt(process.env.JWT_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  res.status(statusCode).cookie("foodbridge_token", token, options).json({
    success: true,
    message,
    data: {
      token,
      user: user.getPublicProfile(),
    },
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body);

    sendTokenResponse(user, 201, res, "Registration successful");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginUser(email, password);

    sendTokenResponse(user, 200, res, "Login successful");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const allowedUpdates = [
      "firstName",
      "lastName",
      "phone",
      "bio",
      "avatar",
      "organization",
      "address",
      "volunteerInfo",
      "ngoInfo",
      "city",
    ];

    // Map top-level city to address.city for consistency if needed
    if (req.body.city) {
      if (!req.body.address) req.body.address = {};
      req.body.address.city = req.body.city;
    } else if (req.body.address?.city) {
      req.body.city = req.body.address.city;
    }

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (typeof req.body[key] === "object" && req.body[key] !== null && !Array.isArray(req.body[key])) {
          // Merge nested objects instead of overwriting
          user[key] = { ...(user[key] || {}), ...req.body[key] };
        } else {
          user[key] = req.body[key];
        }
      }
    });

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};



/**
 * @desc    Logout user (optional - for token blacklisting)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  res.cookie("foodbridge_token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
};
