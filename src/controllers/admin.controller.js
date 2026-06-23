const User = require("../models/User");
const Vendor = require("../models/Vendor");
const AuditLog = require("../models/AuditLog");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.getDashboard = asyncHandler(async (req, res) => {
  const [
    totalUsers, totalVendors, pendingVendors, activeVendors,
    newUsersToday, newVendorsToday,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "superadmin" } }),
    Vendor.countDocuments(),
    Vendor.countDocuments({ status: "pending" }),
    Vendor.countDocuments({ status: "approved", isActive: true }),
    User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Vendor.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ]);

  successResponse(res, 200, "Admin dashboard", {
    totalUsers, totalVendors, pendingVendors, activeVendors,
    newUsersToday, newVendorsToday,
  });
});

exports.getPendingApprovals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const type = req.query.type || "vendor";
  let Model, filter = { status: "pending" };

  if (type === "vendor") Model = Vendor;
  else if (type === "product") Model = require("../models/Product");
  else Model = require("../models/Service");

  const [items, total] = await Promise.all([
    Model.find(filter).populate("user", "name email").sort("createdAt").skip(skip).limit(limit),
    Model.countDocuments(filter),
  ]);
  paginatedResponse(res, items, page, limit, total, "Pending approvals");
});

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.user) filter.user = req.query.user;
  if (req.query.action) filter.action = new RegExp(req.query.action, "i");
  if (req.query.resource) filter.resource = req.query.resource;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate("user", "name email role").sort("-createdAt").skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  paginatedResponse(res, logs, page, limit, total);
});

exports.getSystemStats = asyncHandler(async (req, res) => {
  const stats = {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV,
  };
  successResponse(res, 200, "System stats", stats);
});

exports.createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ success: false, message: "Email already registered" });

  const admin = await User.create({ name, email, password, phone, role: "admin", isEmailVerified: true });
  const { password: _, ...adminData } = admin.toObject();
  successResponse(res, 201, "Admin created", adminData);
});
