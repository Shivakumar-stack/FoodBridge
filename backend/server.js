const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const { env } = require("./config/env");
const logger = require("./config/logger");
const { connectDB } = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const donationRoutes = require("./routes/donationRoutes");
const contactRoutes = require("./routes/contactRoutes");

const notificationRoutes = require("./routes/notificationRoutes");
const logisticsRoutes = require("./routes/logisticsRoutes");
const volunteerRoutes = require("./routes/volunteerRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const { attachCsrfToken, csrfProtection } = require("./middlewares/csrfProtection");

const app = express();

const server = http.createServer(app);
let isShuttingDown = false;
app.set("trust proxy", 1); // Trust first proxy for rate limiting (e.g. Heroku, Nginx)

const { initializeSockets } = require("./services/socketService");

const productionOrigin = env.CLIENT_URL || "*";
const allowedOrigins = [
  productionOrigin,
  "http://localhost:3000",
  "http://localhost:3100",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  // Allow Local Network (LAN) IPs for mobile testing
  /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)\d{1,3}(:\d+)?$/
].filter(Boolean);

const io = initializeSockets(server, allowedOrigins);
app.set("io", io);

connectDB();

const { initializeCronJobs } = require("./services/cronService");

// Initialize background jobs
initializeCronJobs();

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some((allowed) => 
      allowed instanceof RegExp ? allowed.test(origin) : (allowed === origin || allowed === "*")
    );

    // SECURITY: Never allow '*' origin with credentials
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
};
app.use(cors(corsOptions));

app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com",
        "https://cdn.socket.io",
        "https://cdn.jsdelivr.net",
      ],
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        ...allowedOrigins.filter(origin => typeof origin === "string"),
        "ws:",
        "wss:",
        "http:",
        "https:",
      ],
    },
  }),
);

// SECURITY: Add HSTS header to enforce HTTPS in production
if (env.NODE_ENV === "production") {
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
}

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Raised from 100: dashboard pages make many parallel API calls per load
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

// Stricter limiter for auth and mutation routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Stricter than global, but enough for legitimate password retries
  message: {
    success: false,
    message: "Too many attempts from this IP, please try again in 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Stricter rate limiter for password reset (CRITICAL FIX)
const passwordResetLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // Raised for live demonstration safety
  skipSuccessfulRequests: false, 
  message: {
    success: false,
    message: "Too many password reset requests. Please try again in 24 hours.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", passwordResetLimiter);
app.use("/api/auth/reset-password", passwordResetLimiter);
app.use("/api/donations", (req, res, next) => {
  if (req.method === "POST") return authLimiter(req, res, next);
  next();
});

app.use(hpp());

// Sanitize data globally to prevent NoSQL operator injection
const mongoSanitize = require("express-mongo-sanitize");
app.use(mongoSanitize());

const morgan = require("morgan");
if (env.NODE_ENV === "development") {
  app.use(morgan("dev", { stream: logger.stream }));
} else {
  app.use(morgan("combined", { stream: logger.stream }));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

app.use(attachCsrfToken);
app.use("/api", csrfProtection);


app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/assets",
  express.static(path.join(__dirname, "../frontend/assets"), { maxAge: "7d" }),
);
app.use(
  express.static(path.join(__dirname, "../frontend"), {
    extensions: ["html"],
    maxAge: "0",
  }),
);
app.get("/", (req, res) => res.redirect("/pages/index.html"));

// Backward-compatible redirects for removed legacy dashboard routes.
app.get(
  [
    "/pages/dashboard.html",
    "/dashboard.html",
    "/dashboard/dashboard.html",
    "/dashboard-unified/index.html",
  ],
  (req, res) => {
    res.redirect("/pages/dashboard-unified.html");
  },
);

app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/contact", contactRoutes);

app.use("/api/notifications", notificationRoutes);
app.use("/api/logistics", logisticsRoutes);
app.use("/api/volunteer", volunteerRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Temporary: data migration route (secured)
app.use("/api/admin", require("./middlewares/auth").authenticate, require("./middlewares/auth").authorize("admin"), require("./routes/fixTypesRoute"));

const { errorHandler } = require("./middlewares/errorHandler");

app.get("/api/health", async (req, res) => {
  const mongoose = require("mongoose");
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  res.status(200).json({
    success: true,
    message: "FoodBridge API is running",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: "1.0.0",
    services: {
      database: {
        status: dbStatus,
        name: "MongoDB",
      },
      socket: {
        status: "active",
      },
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress. Ignoring ${signal}.`);
    return;
  }
  isShuttingDown = true;

  logger.info(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      logger.info("MongoDB connection closed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

const PORT = env.PORT;
const RESOLVED_PORT = Number(process.env.PORT) || PORT || 5000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${RESOLVED_PORT} is already in use.`);
    process.exit(1);
  }
  logger.error("Server startup error:", err);
  process.exit(1);
});

server.listen(RESOLVED_PORT, () => {
  logger.info(
    `Server running on port ${RESOLVED_PORT} in ${env.NODE_ENV} mode`,
  );
  logger.info(
    `Health check available at http://localhost:${RESOLVED_PORT}/api/health`,
  );
});

module.exports = { app, server };
