const EnterpriseRecord = require("../models/EnterpriseRecord");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

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

// Utility to fetch all allowed location IDs for a user based on role hierarchy
async function getAllowedLocationIds(user) {
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  if (isGlobal) {
    return null; // Null means no filtering (allow all)
  }

  const org = getUserOrg(user);
  const allowedIds = [];

  if (user.role === "region_director") {
    if (!org.region) return [];
    allowedIds.push(org.region);
    
    // Find states under region
    const states = await EnterpriseRecord.find({ module: "organization", type: "state", parent: org.region }).select("_id").lean();
    const stateIds = states.map(s => s._id);
    allowedIds.push(...stateIds);

    if (stateIds.length > 0) {
      // Find districts under states
      const districts = await EnterpriseRecord.find({ module: "organization", type: "district", parent: { $in: stateIds } }).select("_id").lean();
      const districtIds = districts.map(d => d._id);
      allowedIds.push(...districtIds);

      if (districtIds.length > 0) {
        // Find chapters under districts
        const chapters = await EnterpriseRecord.find({ module: "organization", type: "chapter", parent: { $in: districtIds } }).select("_id").lean();
        allowedIds.push(...chapters.map(c => c._id));
      }
    }
  } else if (user.role === "state_director") {
    if (!org.state) return [];
    allowedIds.push(org.state);

    // Find districts under state
    const districts = await EnterpriseRecord.find({ module: "organization", type: "district", parent: org.state }).select("_id").lean();
    const districtIds = districts.map(d => d._id);
    allowedIds.push(...districtIds);

    if (districtIds.length > 0) {
      // Find chapters under districts
      const chapters = await EnterpriseRecord.find({ module: "organization", type: "chapter", parent: { $in: districtIds } }).select("_id").lean();
      allowedIds.push(...chapters.map(c => c._id));
    }
  } else if (user.role === "district_director") {
    if (!org.district) return [];
    allowedIds.push(org.district);

    // Find chapters under district
    const chapters = await EnterpriseRecord.find({ module: "organization", type: "chapter", parent: org.district }).select("_id").lean();
    allowedIds.push(...chapters.map(c => c._id));
  } else {
    // Executive Director, Launch Director, Direct Consultant, Chapter President, Vice President
    if (org.chapter) {
      allowedIds.push(org.chapter);
    }
  }

  return allowedIds;
}

// GET /api/v1/organization/locations
exports.getLocations = asyncHandler(async (req, res) => {
  const allowedLocationIds = await getAllowedLocationIds(req.user);
  let query = { module: "organization" };

  if (allowedLocationIds !== null) {
    query._id = { $in: allowedLocationIds };
  }

  const locations = await EnterpriseRecord.find(query)
    .populate("parent", "name code type")
    .sort("type name")
    .lean();

  res.status(200).json({
    success: true,
    data: { locations }
  });
});

// GET /api/v1/organization/regions
exports.getRegions = asyncHandler(async (req, res) => {
  const user = req.user;
  let query = { module: "organization", type: "region" };

  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  if (!isGlobal) {
    const org = getUserOrg(user);
    if (org.region) {
      query._id = org.region;
    } else {
      // Non-global user without assigned region can't see any regions
      return res.status(200).json({ success: true, data: { regions: [] } });
    }
  }

  const regions = await EnterpriseRecord.find(query).select("_id name code status createdAt").lean();
  res.status(200).json({
    success: true,
    data: { regions }
  });
});

// GET /api/v1/organization/states
exports.getStates = asyncHandler(async (req, res) => {
  const { regionId } = req.query;
  const user = req.user;
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  const org = getUserOrg(user);

  let targetRegionId = regionId;
  if (!isGlobal) {
    if (!org.region) {
      return res.status(200).json({ success: true, data: { states: [] } });
    }
    // Enforce that a non-global user can only query states under their assigned region
    targetRegionId = org.region.toString();
  }

  if (!targetRegionId) {
    return res.status(200).json({ success: true, data: { states: [] } });
  }

  let query = {
    module: "organization",
    type: "state",
    parent: targetRegionId
  };

  // If State Director or below, further restrict states to only their assigned state
  if (!isGlobal && user.role !== "region_director" && org.state) {
    query._id = org.state;
  }

  const states = await EnterpriseRecord.find(query).select("_id name code status parent createdAt").lean();

  res.status(200).json({
    success: true,
    data: { states }
  });
});

// GET /api/v1/organization/districts
exports.getDistricts = asyncHandler(async (req, res) => {
  const { stateId } = req.query;
  const user = req.user;
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  const org = getUserOrg(user);

  let targetStateId = stateId;
  if (!isGlobal) {
    if (!org.state) {
      // Region director can query districts under their region's states
      if (user.role === "region_director" && org.region) {
        // Enforce stateId belongs to their region
        const states = await EnterpriseRecord.find({ module: "organization", type: "state", parent: org.region }).select("_id").lean();
        const stateIds = states.map(s => s._id.toString());
        if (!stateIds.includes(stateId)) {
          return res.status(200).json({ success: true, data: { districts: [] } });
        }
      } else {
        return res.status(200).json({ success: true, data: { districts: [] } });
      }
    } else {
      // Enforce query state matches user state
      targetStateId = org.state.toString();
    }
  }

  if (!targetStateId) {
    return res.status(200).json({ success: true, data: { districts: [] } });
  }

  let query = {
    module: "organization",
    type: "district",
    parent: targetStateId
  };

  // If District Director or below, restrict to their assigned district
  if (!isGlobal && !["region_director", "state_director"].includes(user.role) && org.district) {
    query._id = org.district;
  }

  const districts = await EnterpriseRecord.find(query).select("_id name code status parent createdAt").lean();

  res.status(200).json({
    success: true,
    data: { districts }
  });
});

// GET /api/v1/organization/chapters
exports.getChapters = asyncHandler(async (req, res) => {
  const { districtId } = req.query;
  const user = req.user;
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  const org = getUserOrg(user);

  let targetDistrictId = districtId;
  if (!isGlobal) {
    if (!org.district) {
      if (user.role === "region_director" && org.region) {
        // Find states, then districts
        const states = await EnterpriseRecord.find({ module: "organization", type: "state", parent: org.region }).select("_id").lean();
        const districts = await EnterpriseRecord.find({ module: "organization", type: "district", parent: { $in: states.map(s => s._id) } }).select("_id").lean();
        const districtIds = districts.map(d => d._id.toString());
        if (!districtIds.includes(districtId)) {
          return res.status(200).json({ success: true, data: { chapters: [] } });
        }
      } else if (user.role === "state_director" && org.state) {
        const districts = await EnterpriseRecord.find({ module: "organization", type: "district", parent: org.state }).select("_id").lean();
        const districtIds = districts.map(d => d._id.toString());
        if (!districtIds.includes(districtId)) {
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
    parent: targetDistrictId
  };

  // If Executive Director or below, restrict to their assigned chapter
  if (!isGlobal && !["region_director", "state_director", "district_director"].includes(user.role) && org.chapter) {
    query._id = org.chapter;
  }

  const chapters = await EnterpriseRecord.find(query).select("_id name code status parent createdAt").lean();

  res.status(200).json({
    success: true,
    data: { chapters }
  });
});

// POST /api/v1/organization/location
exports.createLocation = asyncHandler(async (req, res) => {
  const { name, code, type, parent, status = "active" } = req.body;
  const user = req.user;

  if (!name || !type) {
    throw new AppError("Name and Level type are required", 400);
  }

  const validTypes = ["region", "state", "district", "chapter"];
  if (!validTypes.includes(type)) {
    throw new AppError("Invalid location level type", 400);
  }

  if (type !== "region" && !parent) {
    throw new AppError("Parent location is required", 400);
  }

  // Role jurisdiction checks
  const isGlobal = ["superadmin", "admin"].includes(user?.role);
  if (!isGlobal) {
    const org = getUserOrg(user);
    if (user.role === "region_director") {
      if (type !== "state") {
        throw new AppError("Region Directors are only allowed to create States", 403);
      }
      if (parent?.toString() !== org.region?.toString()) {
        throw new AppError("Cannot create a State outside your assigned Region", 403);
      }
    } else if (user.role === "state_director") {
      if (type !== "district") {
        throw new AppError("State Directors are only allowed to create Districts", 403);
      }
      if (parent?.toString() !== org.state?.toString()) {
        throw new AppError("Cannot create a District outside your assigned State", 403);
      }
    } else if (user.role === "district_director") {
      if (type !== "chapter") {
        throw new AppError("District Directors are only allowed to create Chapters", 403);
      }
      if (parent?.toString() !== org.district?.toString()) {
        throw new AppError("Cannot create a Chapter outside your assigned District", 403);
      }
    } else {
      throw new AppError("You do not have permission to create locations", 403);
    }
  }

  // Duplicate Check
  let duplicateFilter = { module: "organization", type, name: new RegExp(`^${name.trim()}$`, "i") };
  if (type !== "region") {
    duplicateFilter.parent = parent;
  }
  const duplicate = await EnterpriseRecord.findOne(duplicateFilter);
  if (duplicate) {
    throw new AppError(`A ${type} with name "${name}" already exists ${type !== "region" ? "under this parent" : "globally"}.`, 400);
  }

  if (code) {
    const codeDup = await EnterpriseRecord.findOne({ code: code.toUpperCase() });
    if (codeDup) {
      throw new AppError(`A location with code "${code.toUpperCase()}" already exists.`, 400);
    }
  }

  const newLocation = await EnterpriseRecord.create({
    module: "organization",
    type,
    name: name.trim(),
    code: code ? code.toUpperCase() : undefined,
    parent: parent || undefined,
    status
  });

  res.status(201).json({
    success: true,
    message: "Location created successfully",
    data: { location: newLocation }
  });
});

// PUT /api/v1/organization/location/:id
exports.updateLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, status } = req.body;
  const user = req.user;

  const location = await EnterpriseRecord.findById(id);
  if (!location || location.module !== "organization") {
    throw new AppError("Location record not found", 404);
  }

  // Jurisdiction check
  const allowedLocationIds = await getAllowedLocationIds(user);
  if (allowedLocationIds !== null && !allowedLocationIds.map(i => i.toString()).includes(id)) {
    throw new AppError("You do not have permission to modify this location record", 403);
  }

  if (name && name.trim().toLowerCase() !== location.name.toLowerCase()) {
    let duplicateFilter = {
      _id: { $ne: id },
      module: "organization",
      type: location.type,
      name: new RegExp(`^${name.trim()}$`, "i")
    };
    if (location.type !== "region") {
      duplicateFilter.parent = location.parent;
    }
    const duplicate = await EnterpriseRecord.findOne(duplicateFilter);
    if (duplicate) {
      throw new AppError(`A ${location.type} with name "${name}" already exists under this parent.`, 400);
    }
    location.name = name.trim();
  }

  if (code && code.toUpperCase() !== location.code) {
    const codeDup = await EnterpriseRecord.findOne({ _id: { $ne: id }, code: code.toUpperCase() });
    if (codeDup) {
      throw new AppError(`A location with code "${code.toUpperCase()}" already exists.`, 400);
    }
    location.code = code.toUpperCase();
  }

  if (status) {
    location.status = status;
  }

  await location.save();

  res.status(200).json({
    success: true,
    message: "Location updated successfully",
    data: { location }
  });
});

// DELETE /api/v1/organization/location/:id
exports.deleteLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const location = await EnterpriseRecord.findById(id);
  if (!location || location.module !== "organization") {
    throw new AppError("Location record not found", 404);
  }

  // Jurisdiction check
  const allowedLocationIds = await getAllowedLocationIds(user);
  if (allowedLocationIds !== null && !allowedLocationIds.map(i => i.toString()).includes(id)) {
    throw new AppError("You do not have permission to modify this location record", 403);
  }

  // Check if there are any child locations linked to this parent
  const childCount = await EnterpriseRecord.countDocuments({ parent: id });
  if (childCount > 0) {
    throw new AppError("Cannot delete this location because it has active child locations associated with it.", 400);
  }

  await EnterpriseRecord.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Location deleted successfully"
  });
});
