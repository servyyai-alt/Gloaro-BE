const { ROLES } = require("../constants/roleConfig");
const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Service = require("../models/Service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/response");

const parseNearbyQuery = (query) => {
  const latitude = Number(query.latitude ?? query.lat);
  const longitude = Number(query.longitude ?? query.lng);
  const radius = Math.min(100, Math.max(0.5, Number(query.radius ?? query.distance ?? 10)));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));

  return {
    latitude,
    longitude,
    radius,
    limit,
    category: query.category,
    rating: Number(query.rating || 0),
    search: query.search?.trim(),
    openNow: query.openNow === "true",
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    sort: query.sort || "nearest",
  };
};

const validateCoordinates = (res, latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    res.status(400).json({ success: false, message: "latitude and longitude are required" });
    return false;
  }
  return true;
};

const isOpenNow = (vendor) => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = vendor.operatingHours?.[days[new Date().getDay()]];
  if (!today) return true;
  if (today.isOpen === false) return false;
  if (!today.open || !today.close) return true;

  const current = new Date().getHours() * 60 + new Date().getMinutes();
  const toMinutes = (value) => {
    const [hours = 0, minutes = 0] = String(value).split(":").map(Number);
    return hours * 60 + minutes;
  };
  return current >= toMinutes(today.open) && current <= toMinutes(today.close);
};

const buildVendorPipeline = ({ latitude, longitude, radius, category, rating, search, openNow, limit, sort }) => {
  const match = { status: "approved", isActive: true };
  if (category && mongoose.Types.ObjectId.isValid(category)) match.businessCategory = new mongoose.Types.ObjectId(category);
  if (rating) match["stats.avgRating"] = { $gte: rating };
  if (search) {
    const searchRegex = new RegExp(search, "i");
    match.$or = [{ businessName: searchRegex }, { description: searchRegex }, { shortDescription: searchRegex }, { tags: searchRegex }];
  }

  const sortMap = {
    nearest: { distanceMeters: 1 },
    highestRated: { "stats.avgRating": -1, distanceMeters: 1 },
    newest: { createdAt: -1 },
    mostPopular: { "stats.totalViews": -1, "stats.avgRating": -1 },
  };

  const pipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [longitude, latitude] },
        distanceField: "distanceMeters",
        maxDistance: radius * 1000,
        spherical: true,
        query: match,
      },
    },
    { $sort: sortMap[sort] || sortMap.nearest },
    { $limit: limit },
    {
      $lookup: {
        from: "categories",
        localField: "businessCategory",
        foreignField: "_id",
        as: "businessCategory",
      },
    },
    { $unwind: { path: "$businessCategory", preserveNullAndEmptyArrays: true } },
    { $addFields: { distanceKm: { $divide: ["$distanceMeters", 1000] } } },
  ];

  return openNow ? pipeline.concat([{ $match: { $expr: { $literal: true } } }]) : pipeline;
};

const getNearbyVendors = async (params) => {
  const vendors = await Vendor.aggregate(buildVendorPipeline(params));
  return params.openNow ? vendors.filter(isOpenNow) : vendors;
};

const attachVendorDistance = (items, vendorDistanceMap) =>
  items.map((item) => {
    const plain = item.toObject ? item.toObject() : item;
    const vendorId = plain.vendor?._id?.toString() || plain.vendor?.toString();
    return { ...plain, distanceKm: vendorDistanceMap.get(vendorId) ?? null };
  });

const sortItems = (items, sort) => {
  const sorted = [...items];
  if (sort === "highestRated") sorted.sort((a, b) => (b.stats?.avgRating || b.vendor?.stats?.avgRating || 0) - (a.stats?.avgRating || a.vendor?.stats?.avgRating || 0));
  else if (sort === "newest") sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === "mostPopular") sorted.sort((a, b) => (b.stats?.views || b.stats?.inquiries || b.stats?.orders || 0) - (a.stats?.views || a.stats?.inquiries || a.stats?.orders || 0));
  else sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return sorted;
};

exports.getNearbyBusinesses = asyncHandler(async (req, res) => {
  const params = parseNearbyQuery(req.query);
  if (!validateCoordinates(res, params.latitude, params.longitude)) return;
  const vendors = await getNearbyVendors({ ...params, category: undefined });
  successResponse(res, 200, "Nearby businesses", vendors);
});

exports.getNearbyServices = asyncHandler(async (req, res) => {
  const params = parseNearbyQuery(req.query);
  if (!validateCoordinates(res, params.latitude, params.longitude)) return;

  const vendors = await getNearbyVendors({ ...params, category: undefined });
  const vendorIds = vendors.map((vendor) => vendor._id);
  const vendorDistanceMap = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor.distanceKm]));
  const filter = { vendor: { $in: vendorIds }, status: "approved", isActive: true };
  if (params.category && mongoose.Types.ObjectId.isValid(params.category)) filter.category = params.category;
  if (params.rating) filter["stats.avgRating"] = { $gte: params.rating };
  if (params.search) filter.$text = { $search: params.search };
  if (params.minPrice !== undefined) filter["pricing.minPrice"] = { $gte: params.minPrice };
  if (params.maxPrice !== undefined) filter["pricing.minPrice"] = { ...filter["pricing.minPrice"], $lte: params.maxPrice };

  const services = await Service.find(filter)
    .populate(ROLES.VENDOR, "businessName slug logo phone website address location operatingHours stats")
    .populate("category", "name slug")
    .limit(params.limit)
    .lean();

  successResponse(res, 200, "Nearby services", sortItems(attachVendorDistance(services, vendorDistanceMap), params.sort));
});

exports.getNearbyProducts = asyncHandler(async (req, res) => {
  const params = parseNearbyQuery(req.query);
  if (!validateCoordinates(res, params.latitude, params.longitude)) return;

  const vendors = await getNearbyVendors(params);
  const vendorIds = vendors.map((vendor) => vendor._id);
  const vendorDistanceMap = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor.distanceKm]));
  const filter = { vendor: { $in: vendorIds }, status: "approved", isActive: true };
  if (params.category && mongoose.Types.ObjectId.isValid(params.category)) filter.category = params.category;
  if (params.rating) filter["stats.avgRating"] = { $gte: params.rating };
  if (params.search) filter.$text = { $search: params.search };
  if (params.minPrice !== undefined) filter["pricing.sellingPrice"] = { $gte: params.minPrice };
  if (params.maxPrice !== undefined) filter["pricing.sellingPrice"] = { ...filter["pricing.sellingPrice"], $lte: params.maxPrice };

  const products = await Product.find(filter)
    .populate(ROLES.VENDOR, "businessName slug logo phone website address location operatingHours stats")
    .populate("category", "name slug")
    .limit(params.limit)
    .lean();

  successResponse(res, 200, "Nearby products", sortItems(attachVendorDistance(products, vendorDistanceMap), params.sort));
});
