/**
 * FoodBridge — Real-time Socket Utility
 * Handles connection and event listeners for Socket.io
 */

(function () {
  "use strict";

  const socketService = {
    socket: null,
    listeners: new Map(),

    init() {
      if (this.socket) return this.socket;

      if (typeof io !== "function") {
        console.warn("[Socket] Socket.io client is not loaded; realtime updates disabled.");
        return null;
      }

      // Socket auth uses HttpOnly cookies via withCredentials.
      // No token is extracted from localStorage.
      const socketUrl = window.appConfig?.SOCKET_SERVER_URL || window.location.origin;

      this.socket = io(socketUrl, {
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      this.socket.on("connect", () => {
        console.log("[Socket] Connected to server");
        
        // Join user-specific room for private notifications
        const userStr = sessionStorage.getItem("foodbridge_user") || localStorage.getItem("foodbridge_user") || sessionStorage.getItem("user") || localStorage.getItem("user");
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const userId = user.id || user._id;
            if (userId) {
              this.socket.emit("join", userId);
              console.log(`[Socket] Joined private room: ${userId}`);
            }
          } catch (e) {
            console.error("[Socket] Failed to parse user for room join", e);
          }
        }
      });

      this.socket.on("connect_error", (err) => {
        console.warn("[Socket] Connection error:", err.message);
      });

      this.socket.on("disconnect", () => {
        console.log("[Socket] Disconnected");
      });

      return this.socket;
    },

    getSocket() {
      return this.init();
    },

    on(event, callback) {
      if (!this.socket) this.init();
      if (!this.socket) return;
      this.socket.on(event, callback);
    },

    emit(event, data) {
      if (!this.socket) this.init();
      if (!this.socket) return;
      this.socket.emit(event, data);
    },

    off(event, callback) {
      if (this.socket) {
        if (callback) {
          this.socket.off(event, callback);
        } else {
          this.socket.off(event);
        }
      }
    }
  };

  // Expose globally
  window.socketService = socketService;

  // Auto-connect on load so the socket is ready before dashboard pages bind listeners
  socketService.init();
})();
