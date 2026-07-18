const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

let ioInstance = null;

// Track connections per IP and per User to prevent spam/duplicate connections
const ipConnectionCounts = new Map();
const userSockets = new Map();
const MAX_CONNECTIONS_PER_IP = 10;

/**
 * Middleware for Socket.io to authenticate connections via JWT.
 * Extracts the token from the handshake auth object or query params.
 */
const socketAuthMiddleware = (socket, next) => {
  // Extract token from: HttpOnly cookie (primary) > handshake auth > query params
  let token = socket.handshake.auth?.token || socket.handshake.query?.token || null;

  // Parse cookies from the handshake headers (for withCredentials cookie-based auth)
  if (!token && socket.handshake.headers?.cookie) {
    const cookies = socket.handshake.headers.cookie.split(";").reduce((acc, c) => {
      const [key, val] = c.trim().split("=");
      if (key && val) acc[key] = val;
      return acc;
    }, {});
    token = cookies["foodbridge_token"] || null;
  }

  if (!token) {
    // Allow unauthenticated connections for the public map view,
    // but mark them so they cannot join private rooms.
    socket.data.userId = null;
    socket.data.authenticated = false;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.id;
    socket.data.authenticated = true;
    next();
  } catch (err) {
    logger.warn(`Socket auth failed: ${err.message}`);
    // Still allow connection for public data, but mark unauthenticated
    socket.data.userId = null;
    socket.data.authenticated = false;
    next();
  }
};

const initializeSockets = (server, allowedOrigins) => {
  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT"],
      credentials: true,
    },
  });

  // Optional: Redis adapter placeholder for horizontal scaling
  // const { createAdapter } = require("@socket.io/redis-adapter");
  // const { createClient } = require("redis");
  // const pubClient = createClient({ url: "redis://localhost:6379" });
  // const subClient = pubClient.duplicate();
  // ioInstance.adapter(createAdapter(pubClient, subClient));

  // Apply JWT authentication middleware
  ioInstance.use(socketAuthMiddleware);

  ioInstance.on("connection", (socket) => {
    const clientIp = socket.handshake.address;

    // 1. IP-based Rate Limiting
    const currentIpCount = ipConnectionCounts.get(clientIp) || 0;
    if (currentIpCount >= MAX_CONNECTIONS_PER_IP) {
      logger.warn(`Too many connections from IP: ${clientIp}`);
      socket.disconnect(true);
      return;
    }
    ipConnectionCounts.set(clientIp, currentIpCount + 1);

    // 2. Connection Debounce (Prevent duplicate connections for same user)
    const userId = socket.data.userId;
    if (socket.data.authenticated && userId) {
      if (userSockets.has(userId)) {
        logger.debug(`Disconnecting older socket for user ${userId}`);
        const oldSocket = userSockets.get(userId);
        oldSocket.disconnect(true);
      }
      userSockets.set(userId, socket);
    }

    logger.debug(
      `Socket connected: ${socket.id} (authenticated: ${socket.data.authenticated})`,
    );

    // Allow users to join ONLY their own private room
    socket.on("join", (requestedUserId) => {
      if (!socket.data.authenticated) {
        socket.emit("error", {
          message: "Authentication required to join private rooms.",
        });
        return;
      }

      // Ensure the user can only join their own room
      if (!requestedUserId || requestedUserId !== socket.data.userId) {
        socket.emit("error", {
          message: "You can only subscribe to your own notifications.",
        });
        return;
      }

      socket.join(requestedUserId);
      logger.debug(`User ${requestedUserId} joined their private room`);
    });

    socket.on("disconnect", () => {
      // Clean up IP tracking
      const count = ipConnectionCounts.get(clientIp);
      if (count && count > 1) {
        ipConnectionCounts.set(clientIp, count - 1);
      } else {
        ipConnectionCounts.delete(clientIp);
      }

      // Clean up user tracking
      if (socket.data.authenticated && userId) {
        if (userSockets.get(userId) === socket) {
          userSockets.delete(userId);
        }
      }

      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

module.exports = {
  initializeSockets,
  getIO,
};
