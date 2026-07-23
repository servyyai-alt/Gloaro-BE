const { ROLES } = require("../constants/roleConfig");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Category = require("../models/Category");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const getUserOrg = (user) => {
  const meta = getUserMeta(user);
  return meta?.adminProfile?.organization || {};
};

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

exports.getOrganizationHierarchy = asyncHandler(async (req, res) => {
  const records = await EnterpriseRecord.find({
    module: "organization",
  }).select("name code type parent director assignedTo metadata").lean();
  successResponse(res, 200, "Organization hierarchy retrieved", records);
});

exports.getRegions = asyncHandler(async (req, res) => {
  const user = req.user;
  let query = { module: "organization", type: "region", status: "active" };

  const isGlobal = [ROLES.SUPERADMIN, ROLES.ADMIN].includes(user?.role);
  if (!isGlobal) {
    const org = getUserOrg(user);
    if (org.region) {
      query._id = org.region;
    } else {
      return res.status(200).json({ success: true, data: { regions: [] } });
    }
  }

  const regions = await EnterpriseRecord.find(query).select("_id name").lean();
  res.status(200).json({ success: true, data: { regions } });
});

exports.getStates = asyncHandler(async (req, res) => {
  const { region } = req.query;
  const user = req.user;
  const isGlobal = [ROLES.SUPERADMIN, ROLES.ADMIN].includes(user?.role);
  const org = getUserOrg(user);

  let targetRegionId = region;
  if (!isGlobal) {
    if (!org.region) {
      return res.status(200).json({ success: true, data: { states: [] } });
    }
    targetRegionId = org.region.toString();
  }

  if (!targetRegionId) {
    return res.status(200).json({ success: true, data: { states: [] } });
  }

  let query = {
    module: "organization",
    type: "state",
    parent: targetRegionId,
    status: "active"
  };

  if (!isGlobal && user.role !== ROLES.REGION_DIRECTOR && org.state) {
    query._id = org.state;
  }

  const states = await EnterpriseRecord.find(query).select("_id name").lean();
  res.status(200).json({ success: true, data: { states } });
});

exports.getDistricts = asyncHandler(async (req, res) => {
  const { state } = req.query;
  const user = req.user;
  const isGlobal = [ROLES.SUPERADMIN, ROLES.ADMIN].includes(user?.role);
  const org = getUserOrg(user);

  let targetStateId = state;
  if (!isGlobal) {
    if (!org.state) {
      if (user.role === ROLES.REGION_DIRECTOR && org.region) {
        const states = await EnterpriseRecord.find({ module: "organization", type: "state", parent: org.region }).select("_id").lean();
        const stateIds = states.map(s => s._id.toString());
        if (!stateIds.includes(state)) {
          return res.status(200).json({ success: true, data: { districts: [] } });
        }
      } else {
        return res.status(200).json({ success: true, data: { districts: [] } });
      }
    } else {
      targetStateId = org.state.toString();
    }
  }

  if (!targetStateId) {
    return res.status(200).json({ success: true, data: { districts: [] } });
  }

  let query = {
    module: "organization",
    type: "district",
    parent: targetStateId,
    status: "active"
  };

  if (!isGlobal && ![ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR].includes(user.role) && org.district) {
    query._id = org.district;
  }

  const districts = await EnterpriseRecord.find(query).select("_id name").lean();
  res.status(200).json({ success: true, data: { districts } });
});

exports.getAreas = asyncHandler(async (req, res) => {
  // Area level is completely bypassed and deprecated in 4-level hierarchy.
  res.status(200).json({ success: true, data: { areas: [] } });
});

exports.getChapters = asyncHandler(async (req, res) => {
  const { district } = req.query;
  const user = req.user;
  const isGlobal = [ROLES.SUPERADMIN, ROLES.ADMIN].includes(user?.role);
  const org = getUserOrg(user);

  let targetDistrictId = district;
  if (!isGlobal) {
    if (!org.district) {
      if (user.role === ROLES.REGION_DIRECTOR && org.region) {
        const states = await EnterpriseRecord.find({ module: "organization", type: "state", parent: org.region }).select("_id").lean();
        const districts = await EnterpriseRecord.find({ module: "organization", type: "district", parent: { $in: states.map(s => s._id) } }).select("_id").lean();
        const districtIds = districts.map(d => d._id.toString());
        if (!districtIds.includes(district)) {
          return res.status(200).json({ success: true, data: { chapters: [] } });
        }
      } else if (user.role === ROLES.STATE_DIRECTOR && org.state) {
        const districts = await EnterpriseRecord.find({ module: "organization", type: "district", parent: org.state }).select("_id").lean();
        const districtIds = districts.map(d => d._id.toString());
        if (!districtIds.includes(district)) {
          return res.status(200).json({ success: true, data: { chapters: [] } });
        }
      } else {
        return res.status(200).json({ success: true, data: { chapters: [] } });
      }
    } else {
      targetDistrictId = org.district.toString();
    }
  }

  if (!targetDistrictId) {
    return res.status(200).json({ success: true, data: { chapters: [] } });
  }

  let query = {
    module: "organization",
    type: "chapter",
    parent: targetDistrictId,
    status: "active"
  };

  if (!isGlobal && ![ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR, ROLES.DISTRICT_DIRECTOR].includes(user.role) && org.chapter) {
    query._id = org.chapter;
  }

  const chapters = await EnterpriseRecord.find(query).select("_id name").lean();
  res.status(200).json({ success: true, data: { chapters } });
});
