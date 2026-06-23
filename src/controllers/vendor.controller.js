const vendorService = require("../services/vendor.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse } = require("../utils/response");

exports.createVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.createVendor(req.user._id, req.body, req.files);
  successResponse(res, 201, "Vendor profile created. Pending approval.", vendor);
});

exports.getVendors = asyncHandler(async (req, res) => {
  const { vendors, total, page, limit } = await vendorService.getVendors(req.query);
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
