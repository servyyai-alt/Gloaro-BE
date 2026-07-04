const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");
const logger = require("../utils/logger");
const { isAdminRole } = require("../constants/adminRoles");

let io = null;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Authentication required"));
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select("name role isActive");
      if (!user || !user.isActive) return next(new Error("User not found or inactive"));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} | User: ${socket.user._id}`);

    // Join personal room
    socket.join(`user:${socket.user._id}`);

    // Join vendor room
    if (socket.user.role === "vendor") {
      socket.emit("request_vendor_id", {});
    }

    socket.on("set_vendor_id", (vendorId) => {
      socket.join(`vendor:${vendorId}`);
      logger.debug(`Vendor ${vendorId} joined room`);
    });

    // Join admin room
    if (isAdminRole(socket.user.role)) {
      socket.join("admins");
    }

    // Custom room join (for events, etc.)
    socket.on("join_room", (room) => {
      socket.join(room);
    });

    socket.on("leave_room", (room) => {
      socket.leave(room);
    });

    // Typing indicator for support chat
    socket.on("typing", ({ ticketId }) => {
      socket.to(`ticket:${ticketId}`).emit("user_typing", { userId: socket.user._id });
    });

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  logger.info("✅ Socket.IO initialized");
  return io;
};

const getSocketIO = () => io;

const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

const emitToAdmins = (event, data) => {
  if (io) io.to("admins").emit(event, data);
};

const emitToVendor = (vendorId, event, data) => {
  if (io) io.to(`vendor:${vendorId}`).emit(event, data);
};

module.exports = { initSocket, getSocketIO, emitToUser, emitToAdmins, emitToVendor };
