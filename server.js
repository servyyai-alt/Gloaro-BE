require("dotenv").config({ override: true });
const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/database");
const { connectRedis } = require("./src/config/redis");
const { initSocket } = require("./src/sockets");
const logger = require("./src/utils/logger");
const { startJobs } = require("./src/jobs");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    startJobs();

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! Shutting down...", err);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...", err);
  process.exit(1);
});

module.exports = server;
