const Service = require("../models/Service");
const Vendor = require("../models/Vendor");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.createService = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  if (vendor.status !== "approved") throw new AppError("Vendor account not approved", 403);

  const images = req.files ? req.files.map((f) => ({ url: f.path, publicId: f.filename })) : [];
  const service = await Service.create({ ...req.body, vendor: vendor._id, gallery: images });
  await Vendor.findByIdAndUpdate(vendor._id, { $inc: { "stats.totalServices": 1 } });
  successResponse(res, 201, "Service created and pending approval", service);
});

exports.getServices = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  else filter.status = "approved";
  if (req.query.category) filter.category = req.query.category;
  if (req.query.vendor) filter.vendor = req.query.vendor;
  if (req.query.featured === "true") filter.isFeatured = true;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [services, total] = await Promise.all([
    Service.find(filter)
      .populate("vendor", "businessName slug logo")
      .populate("category", "name slug")
      .sort(req.query.sortBy || "-createdAt")
      .skip(skip).limit(limit),
    Service.countDocuments(filter),
  ]);
  paginatedResponse(res, services, page, limit, total);
});

exports.getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id)
    .populate("vendor", "businessName slug logo address")
    .populate("category", "name");
  if (!service) throw new AppError("Service not found", 404);
  await Service.findByIdAndUpdate(req.params.id, { $inc: { "stats.views": 1 } });
  successResponse(res, 200, "Service retrieved", service);
});

exports.updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id).populate("vendor");
  if (!service) throw new AppError("Service not found", 404);
  const isOwner = service.vendor.user.toString() === req.user._id.toString();
  if (!isOwner && !["admin", "superadmin"].includes(req.user.role)) throw new AppError("Not authorized", 403);
  const updated = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  successResponse(res, 200, "Service updated", updated);
});

exports.approveService = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const service = await Service.findByIdAndUpdate(req.params.id, {
    status: action === "approve" ? "approved" : "rejected",
    approvedBy: req.user._id,
    approvedAt: action === "approve" ? new Date() : undefined,
    rejectedReason: action === "reject" ? reason : undefined,
  }, { new: true });
  if (!service) throw new AppError("Service not found", 404);
  successResponse(res, 200, `Service ${action}d`, service);
});

exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id).populate("vendor");
  if (!service) throw new AppError("Service not found", 404);
  const isOwner = service.vendor.user.toString() === req.user._id.toString();
  if (!isOwner && !["admin", "superadmin"].includes(req.user.role)) throw new AppError("Not authorized", 403);
  await service.deleteOne();
  successResponse(res, 200, "Service deleted");
});

exports.getVendorServices = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { vendor: req.params.vendorId, status: "approved" };
  const [services, total] = await Promise.all([
    Service.find(filter).populate("category", "name").sort("-createdAt").skip(skip).limit(limit),
    Service.countDocuments(filter),
  ]);
  paginatedResponse(res, services, page, limit, total);
});
