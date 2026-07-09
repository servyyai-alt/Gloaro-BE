const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const { isAdminRole } = require("../constants/adminRoles");
const idGenerator = require("../services/idGenerator.service");

exports.createProduct = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  if (vendor.status !== "approved") throw new AppError("Vendor account not approved", 403);

  if (!vendor.vendorId) {
    vendor.vendorId = await idGenerator.generateVendorId({
      stateCode: String(vendor.address?.state || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2),
      areaCode: String(vendor.address?.city || vendor.businessName || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3),
    });
    await vendor.save();
  }

  delete req.body.status;
  delete req.body.isFeatured;
  delete req.body.approvedBy;
  delete req.body.approvedAt;
  delete req.body.productId;
  const images = req.files ? req.files.map((f, i) => ({ url: f.path, publicId: f.filename, isMain: i === 0 })) : [];
  const product = await Product.create({
    ...req.body,
    productId: await idGenerator.generateProductId({ vendorId: vendor.vendorId }),
    vendor: vendor._id,
    images,
    status: "approved",
  });
  await Vendor.findByIdAndUpdate(vendor._id, { $inc: { "stats.totalProducts": 1 } });
  successResponse(res, 201, "Product created successfully", product);
});

exports.getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  else filter.status = "approved";
  if (req.query.category) filter.category = req.query.category;
  if (req.query.vendor) filter.vendor = req.query.vendor;
  if (req.query.featured === "true") filter.isFeatured = true;
  if (req.query.minPrice) filter["pricing.sellingPrice"] = { $gte: Number(req.query.minPrice) };
  if (req.query.maxPrice) filter["pricing.sellingPrice"] = { ...filter["pricing.sellingPrice"], $lte: Number(req.query.maxPrice) };
  if (req.query.search) filter.$text = { $search: req.query.search };

  const sortMap = { price_asc: "pricing.sellingPrice", price_desc: "-pricing.sellingPrice", newest: "-createdAt", popular: "-stats.views" };
  const sort = sortMap[req.query.sortBy] || "-createdAt";

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate({ path: "vendor", select: "businessName ownerName slug logo", populate: { path: "user", select: "name" } })
      .populate("category", "name slug")
      .sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  paginatedResponse(res, products, page, limit, total);
});

exports.getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate({ path: "vendor", select: "businessName ownerName slug logo address stats", populate: { path: "user", select: "name" } })
    .populate("category", "name");
  if (!product) throw new AppError("Product not found", 404);
  await Product.findByIdAndUpdate(req.params.id, { $inc: { "stats.views": 1 } });
  successResponse(res, 200, "Product retrieved", product);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("vendor");
  if (!product) throw new AppError("Product not found", 404);
  const isOwner = product.vendor.user.toString() === req.user._id.toString();
  if (!isOwner && !isAdminRole(req.user.role)) throw new AppError("Not authorized", 403);
  if (isOwner && !isAdminRole(req.user.role)) {
    delete req.body.status;
    delete req.body.isFeatured;
    delete req.body.approvedBy;
    delete req.body.approvedAt;
    delete req.body.rejectedReason;
  }
  delete req.body.productId;
  if (req.files?.length) {
    req.body.images = req.files.map((f, i) => ({ url: f.path, publicId: f.filename, isMain: i === 0 }));
  }
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  successResponse(res, 200, "Product updated", updated);
});

exports.approveProduct = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const product = await Product.findByIdAndUpdate(req.params.id, {
    status: action === "approve" ? "approved" : "rejected",
    approvedBy: req.user._id,
    approvedAt: action === "approve" ? new Date() : undefined,
    rejectedReason: action === "reject" ? reason : undefined,
  }, { new: true });
  if (!product) throw new AppError("Product not found", 404);
  successResponse(res, 200, `Product ${action}d`, product);
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("vendor");
  if (!product) throw new AppError("Product not found", 404);
  const isOwner = product.vendor.user.toString() === req.user._id.toString();
  if (!isOwner && !isAdminRole(req.user.role)) throw new AppError("Not authorized", 403);
  await product.deleteOne();
  await Vendor.findByIdAndUpdate(product.vendor._id, { $inc: { "stats.totalProducts": -1 } });
  successResponse(res, 200, "Product deleted");
});

exports.updateInventory = asyncHandler(async (req, res) => {
  const { quantity, operation } = req.body; // operation: set | increment | decrement
  let update;
  if (operation === "increment") update = { $inc: { "inventory.quantity": quantity } };
  else if (operation === "decrement") update = { $inc: { "inventory.quantity": -quantity } };
  else update = { "inventory.quantity": quantity };

  const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!product) throw new AppError("Product not found", 404);
  successResponse(res, 200, "Inventory updated", product);
});
