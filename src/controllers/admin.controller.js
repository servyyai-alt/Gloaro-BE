const User = require("../models/User");
const Vendor = require("../models/Vendor");
const AuditLog = require("../models/AuditLog");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Payment = require("../models/Payment");
const Event = require("../models/Event");
const Banner = require("../models/Banner");
const FAQ = require("../models/FAQ");
const Setting = require("../models/Setting");
const MembershipApplication = require("../models/MembershipApplication");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.getDashboard = asyncHandler(async (req, res) => {
  const [
    totalUsers, totalVendors, pendingVendors, activeVendors,
    verifiedVendors, servicesCount, productsCount, eventsCount,
    newUsersToday, newVendorsToday, revenueAgg, membershipRevenueAgg,
    monthlyRevenue, recentPayments, membershipApplicationsCount, pendingMembershipApplications,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "superadmin" } }),
    Vendor.countDocuments(),
    Vendor.countDocuments({ status: "pending" }),
    Vendor.countDocuments({ status: "approved", isActive: true }),
    Vendor.countDocuments({ isVerified: true }),
    Service.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true }),
    Event.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Vendor.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Payment.aggregate([
      { $match: { status: "completed", type: "membership" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]),
    Payment.find().populate("user", "name email").populate("vendor", "businessName").sort("-createdAt").limit(10),
    MembershipApplication.countDocuments(),
    MembershipApplication.countDocuments({ status: "submitted" }),
  ]);

  successResponse(res, 200, "Admin dashboard", {
    totalUsers, totalVendors, pendingVendors, activeVendors,
    verifiedVendors, servicesCount, productsCount, eventsCount,
    newUsersToday, newVendorsToday,
    revenue: revenueAgg[0]?.total || 0,
    membershipRevenue: membershipRevenueAgg[0]?.total || 0,
    membershipApplicationsCount,
    pendingMembershipApplications,
    monthlyRevenue,
    recentPayments,
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

exports.getBanners = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.placement) filter.placement = req.query.placement;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";

  const [banners, total] = await Promise.all([
    Banner.find(filter).sort("order -createdAt").skip(skip).limit(limit),
    Banner.countDocuments(filter),
  ]);
  paginatedResponse(res, banners, page, limit, total, "Banners retrieved");
});

exports.createBanner = asyncHandler(async (req, res) => {
  if (req.file) req.body.image = { url: req.file.path, publicId: req.file.filename };
  const banner = await Banner.create({ ...req.body, createdBy: req.user._id });
  successResponse(res, 201, "Banner created", banner);
});

exports.updateBanner = asyncHandler(async (req, res) => {
  if (req.file) req.body.image = { url: req.file.path, publicId: req.file.filename };
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
  successResponse(res, 200, "Banner updated", banner);
});

exports.deleteBanner = asyncHandler(async (req, res) => {
  await Banner.findByIdAndDelete(req.params.id);
  successResponse(res, 200, "Banner deleted");
});

exports.getFAQs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [faqs, total] = await Promise.all([
    FAQ.find(filter).sort("order -createdAt").skip(skip).limit(limit),
    FAQ.countDocuments(filter),
  ]);
  paginatedResponse(res, faqs, page, limit, total, "FAQs retrieved");
});

exports.createFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.create({ ...req.body, createdBy: req.user._id });
  successResponse(res, 201, "FAQ created", faq);
});

exports.updateFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
  successResponse(res, 200, "FAQ updated", faq);
});

exports.deleteFAQ = asyncHandler(async (req, res) => {
  await FAQ.findByIdAndDelete(req.params.id);
  successResponse(res, 200, "FAQ deleted");
});

exports.getSettings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.group) filter.group = req.query.group;
  const settings = await Setting.find(filter).sort("group key");
  successResponse(res, 200, "Settings retrieved", settings);
});

exports.upsertSetting = asyncHandler(async (req, res) => {
  const { key, value, group, description, isPublic } = req.body;
  const setting = await Setting.findOneAndUpdate(
    { key },
    { key, value, group, description, isPublic, updatedBy: req.user._id },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  successResponse(res, 200, "Setting saved", setting);
});
