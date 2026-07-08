const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const logger = require("./utils/logger");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const vendorRoutes = require("./routes/vendor.routes");
const categoryRoutes = require("./routes/category.routes");
const serviceRoutes = require("./routes/service.routes");
const productRoutes = require("./routes/product.routes");
const leadRoutes = require("./routes/lead.routes");
const membershipRoutes = require("./routes/membership.routes");
const membershipApplicationRoutes = require("./routes/membershipApplication.routes");
const vendorApplicationRoutes = require("./routes/vendorApplication.routes");
const paymentRoutes = require("./routes/payment.routes");
const reviewRoutes = require("./routes/review.routes");
const eventRoutes = require("./routes/event.routes");
const referralRoutes = require("./routes/referral.routes");
const notificationRoutes = require("./routes/notification.routes");
const reportRoutes = require("./routes/report.routes");
const supportRoutes = require("./routes/support.routes");
const directoryRoutes = require("./routes/directory.routes");
const nearbyRoutes = require("./routes/nearby.routes");
const customerRoutes = require("./routes/customer.routes");
const adminRoutes = require("./routes/admin.routes");
const secretaryRoutes = require("./routes/secretary.routes");
const locationRoutes = require("./routes/location.routes");

const app = express();
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
].filter(Boolean);

const isLoopbackRequest = (req) => ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(req.ip);

// Trust proxy
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== "production" && isLoopbackRequest(req),
});
app.use("/api/", limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many authentication attempts." },
  skipSuccessfulRequests: true,
  skip: (req) => process.env.NODE_ENV !== "production" && isLoopbackRequest(req),
});

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Security middleware
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Swagger documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/vendors", vendorRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/services", serviceRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/memberships", membershipRoutes);
app.use("/api/v1/membership-applications", membershipApplicationRoutes);
app.use("/api/v1/vendor-applications", vendorApplicationRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/referrals", referralRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/directory", directoryRoutes);
app.use("/api/v1/nearby", nearbyRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/secretary", secretaryRoutes);
app.use("/api/v1/organization", locationRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
