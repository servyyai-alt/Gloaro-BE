const vendorService = require("../services/vendor.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse } = require("../utils/response");
const AuditLog = require("../models/AuditLog");

exports.createVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.createVendor(req.user._id, req.body, req.files);
  successResponse(res, 201, "Vendor profile created. Pending approval.", vendor);
});

exports.getVendors = asyncHandler(async (req, res) => {
  if (req.query.export === "csv") {
    const { vendors } = await vendorService.getVendors({ ...req.query, limit: 100000, page: 1 }, req.user);
    const { exportToCSV } = require("../utils/csv");
    return exportToCSV(res, vendors, [
      { label: "Business Name", key: "businessName" },
      { label: "Email", key: "user.email" },
      { label: "Owner Name", key: "user.name" },
      { label: "Plan", key: "membership.plan" },
      { label: "Status", key: "status" },
      { label: "Verified", key: "isVerified" },
      { label: "City", key: "address.city" },
      { label: "State", key: "address.state" },
      { label: "Created At", key: "createdAt" }
    ], "vendors.csv");
  }

  const { vendors, total, page, limit } = await vendorService.getVendors(req.query, req.user);
  paginatedResponse(res, vendors, page, limit, total, "Vendors retrieved");
});

exports.getVendorById = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);
  successResponse(res, 200, "Vendor retrieved", vendor);
});

exports.getVendorBySlug = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorBySlug(req.params.slug);
  successResponse(res, 200, "Vendor retrieved", vendor);
});

exports.updateVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendor(
    req.params.id, req.user._id, req.user.role, req.body, req.files
  );
  successResponse(res, 200, "Vendor updated", vendor);
});

exports.approveVendor = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const vendor = await vendorService.approveVendor(req.params.id, req.user._id, action, reason);

  await AuditLog.create({
    user: req.user._id,
    action: `vendor_${action}`,
    resource: "Vendor",
    resourceId: vendor._id,
    details: {
      action,
      reason,
      ipAddress: req.ip,
      device: req.get("User-Agent")
    },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent")
  });

  successResponse(res, 200, `Vendor ${action}d successfully`, vendor);
});

exports.featureVendor = asyncHandler(async (req, res) => {
  const { isFeatured, untilDate } = req.body;
  const vendor = await vendorService.featureVendor(req.params.id, isFeatured, untilDate);
  successResponse(res, 200, "Vendor feature status updated", vendor);
});

exports.deleteVendor = asyncHandler(async (req, res) => {
  await vendorService.deleteVendor(req.params.id, req.user._id, req.user.role);
  successResponse(res, 200, "Vendor deleted");
});

exports.getNearbyVendors = asyncHandler(async (req, res) => {
  const { lat, lng, radius, limit } = req.query;
  const vendors = await vendorService.getNearbyVendors(lat, lng, radius, limit);
  successResponse(res, 200, "Nearby vendors retrieved", vendors);
});

exports.getMyProfile = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getMyVendorProfile(req.user._id);
  successResponse(res, 200, "Vendor profile retrieved", vendor);
});

exports.getMyDashboard = asyncHandler(async (req, res) => {
  const dashboard = await vendorService.getVendorDashboard(req.user._id);
  successResponse(res, 200, "Vendor dashboard retrieved", dashboard);
});

exports.getMyProducts = asyncHandler(async (req, res) => {
  const { products, total, page, limit } = await vendorService.getMyProducts(req.user._id, req.query);
  paginatedResponse(res, products, page, limit, total, "Vendor products retrieved");
});

exports.getMyServices = asyncHandler(async (req, res) => {
  const { services, total, page, limit } = await vendorService.getMyServices(req.user._id, req.query);
  paginatedResponse(res, services, page, limit, total, "Vendor services retrieved");
});

exports.getMyReviews = asyncHandler(async (req, res) => {
  const { reviews, total, page, limit } = await vendorService.getMyReviews(req.user._id, req.query);
  paginatedResponse(res, reviews, page, limit, total, "Vendor reviews retrieved");
});

exports.getMyPayments = asyncHandler(async (req, res) => {
  const { payments, total, page, limit } = await vendorService.getMyPayments(req.user._id, req.query);
  paginatedResponse(res, payments, page, limit, total, "Vendor payments retrieved");
});

exports.getMySubscriptions = asyncHandler(async (req, res) => {
  const { memberships, total, page, limit } = await vendorService.getMySubscriptions(req.user._id, req.query);
  paginatedResponse(res, memberships, page, limit, total, "Vendor subscription history retrieved");
});
