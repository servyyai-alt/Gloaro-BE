const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Category = require("../models/Category");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.searchDirectory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { q, category, city, state, type, minRating, plan, featured } = req.query;

  const filter = { status: "approved", isActive: true };
  if (q) filter.$text = { $search: q };
  if (category) filter.businessCategory = category;
  if (city) filter["address.city"] = new RegExp(city, "i");
  if (state) filter["address.state"] = new RegExp(state, "i");
  if (minRating) filter["stats.avgRating"] = { $gte: Number(minRating) };
  if (plan) filter["membership.plan"] = plan;
  if (featured === "true") filter.isFeatured = true;

  // Sort: featured first, then by plan weight
  const sort = { isFeatured: -1, "stats.avgRating": -1 };
  if (q) sort.score = { $meta: "textScore" };

  const [vendors, total] = await Promise.all([
    Vendor.find(filter)
      .populate("businessCategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Vendor.countDocuments(filter),
  ]);

  paginatedResponse(res, vendors, page, limit, total, "Directory search results");
});

exports.getFeaturedListings = asyncHandler(async (req, res) => {
  const vendors = await Vendor.find({ isFeatured: true, status: "approved", isActive: true })
    .populate("businessCategory", "name slug")
    .sort("-stats.avgRating")
    .limit(20)
    .lean();
  successResponse(res, 200, "Featured listings", vendors);
});

exports.getNearbyVendors = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 10, category, limit = 20 } = req.query;
  if (!lat || !lng) return res.status(400).json({ success: false, message: "lat and lng are required" });

  const filter = {
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseFloat(radius) * 1000,
      },
    },
    status: "approved",
    isActive: true,
  };
  if (category) filter.businessCategory = category;

  const vendors = await Vendor.find(filter).populate("businessCategory", "name").limit(parseInt(limit)).lean();
  successResponse(res, 200, "Nearby vendors", vendors);
});

exports.getDirectoryFilters = asyncHandler(async (req, res) => {
  const [categories, cities, states, plans] = await Promise.all([
    Category.find({ type: "business", isActive: true }).select("name slug").lean(),
    Vendor.distinct("address.city", { status: "approved" }),
    Vendor.distinct("address.state", { status: "approved" }),
    ["free", "silver", "gold", "platinum"],
  ]);
  successResponse(res, 200, "Directory filters", { categories, cities: cities.filter(Boolean), states: states.filter(Boolean), plans });
});

exports.globalSearch = asyncHandler(async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q) return successResponse(res, 200, "Search results", { vendors: [], products: [], services: [] });

  const [vendors, products, services] = await Promise.all([
    Vendor.find({ $text: { $search: q }, status: "approved" }).select("businessName slug logo address.city").limit(Number(limit)),
    Product.find({ $text: { $search: q }, status: "approved" }).select("title slug images.0 pricing.sellingPrice").limit(Number(limit)),
    Service.find({ $text: { $search: q }, status: "approved" }).select("title slug pricing").limit(Number(limit)),
  ]);

  successResponse(res, 200, "Global search results", { vendors, products, services });
});
