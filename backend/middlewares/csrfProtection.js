const crypto = require("crypto");

/**
 * Stateless Double-Submit Cookie CSRF Protection.
 *
 * How it works (no session dependency):
 *   1. `attachCsrfToken` sets a readable cookie `XSRF-TOKEN` with a random value.
 *   2. The frontend reads that cookie and sends it back as `X-CSRF-Token` header.
 *   3. `csrfProtection` compares the header value against the cookie value.
 *   4. An attacker on another origin can trigger the cookie to be sent automatically,
 *      but cannot read it (Same-Origin Policy), so they can't set the header.
 *
 * This replaces the old session-based approach that broke whenever the
 * MemoryStore lost sessions (server restart, memory pressure, etc.).
 */

const CSRF_COOKIE = "XSRF-TOKEN";

const csrfProtection = (req, res, next) => {
  // Safe methods don't need CSRF protection
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF for public auth endpoints (no token yet)
  const publicPaths = [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/providers",
    "/auth/social",
  ];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p + "/"))) {
    return next();
  }

  // Double-submit cookie validation:
  // Compare the header token against the cookie token
  const headerToken = req.headers["x-csrf-token"];
  const cookieToken = req.cookies?.[CSRF_COOKIE];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token mismatch or missing. Please refresh the page.",
    });
  }

  next();
};

/**
 * Middleware to generate and attach a CSRF token cookie.
 * Sets a new token only if one doesn't already exist in the request cookies.
 */
const attachCsrfToken = (req, res, next) => {
  // If the client already has a valid CSRF cookie, keep it
  if (req.cookies?.[CSRF_COOKIE]) {
    return next();
  }

  // Generate a new token and set it as a readable (non-httpOnly) cookie
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,        // Frontend must read this cookie
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — matches JWT lifetime
  });

  next();
};

module.exports = { csrfProtection, attachCsrfToken };
