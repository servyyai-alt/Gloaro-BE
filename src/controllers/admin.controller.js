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
const EnterpriseRecord = require("../models/EnterpriseRecord");
const idGenerator = require("../services/idGenerator.service");
const { populateUserOrganizationLocations } = require("../utils/userPopulateHelper");
const { superAdminDefaults } = require("../constants/superAdminDefaults");
const { ADMIN_ROLE_VALUES, isAdminRole } = require("../constants/adminRoles");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { sendTemplateEmail } = require("../utils/email");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

const SUPER_CONFIG_KEYS = {
  roles: "superadmin.roles",
  modules: "superadmin.modules",
  featureMatrix: "superadmin.featureMatrix",
  dashboardWidgets: "superadmin.dashboardWidgets",
  sidebar: "superadmin.sidebar",
  workflows: "superadmin.workflows",
  organizationTree: "superadmin.organizationTree",
  platformSettings: "superadmin.platformSettings",
};

const getConfigSetting = async (key, fallback) => {
  const setting = await Setting.findOne({ key });
  return setting?.value ?? fallback;
};

const saveConfigSetting = async (key, value, userId, description) => {
  const oldSetting = await Setting.findOne({ key });
  const setting = await Setting.findOneAndUpdate(
    { key },
    { key, value, group: "superadmin", description, isPublic: false, updatedBy: userId },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await AuditLog.create({
    user: userId,
    action: "superadmin_config_updated",
    resource: "Setting",
    resourceId: setting._id,
    details: { key, oldValue: oldSetting?.value, newValue: value },
  });

  return setting.value;
};

const getAllSuperConfig = async () => {
  const entries = await Promise.all(
    Object.entries(SUPER_CONFIG_KEYS).map(async ([name, key]) => [name, await getConfigSetting(key, superAdminDefaults[name])])
  );
  return Object.fromEntries(entries);
};

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const buildAdminProfile = (body = {}) => ({
  organization: body.organization || {},
  modules: body.modules || [],
  permissions: (body.modules || []).reduce((result, moduleName) => {
    result[moduleName] = {
      apiAccess: true,
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canExport: false,
      canPrint: false,
      ...(body.permissions?.[moduleName] || {}),
    };
    return result;
  }, {}),
  workflowPermissions: body.workflowPermissions || {},
  dashboardWidgets: body.dashboardWidgets || [],
  sidebar: body.sidebar || [],
  sections: body.sections || {},
  operations: body.operations || {},
  security: {
    forcePasswordChange: Boolean(body.forcePasswordChange),
    twoFactorEnabled: Boolean(body.twoFactorEnabled),
    sessionTimeoutMinutes: Number(body.sessionTimeoutMinutes || 60),
    ipWhitelist: body.ipWhitelist || [],
  },
  customRoleName: body.customRoleName,
  reportsTo: body.reportsTo,
});

const applyAdminProfile = (user, profile) => {
  const meta = getUserMeta(user);
  user.meta = { ...meta, adminProfile: profile };
};

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeAdminBody = (body) => ({
  ...body,
  organization: parseJsonField(body.organization, {}),
  modules: parseJsonField(body.modules, []),
  permissions: parseJsonField(body.permissions, {}),
  workflowPermissions: parseJsonField(body.workflowPermissions, {}),
  dashboardWidgets: parseJsonField(body.dashboardWidgets, []),
  sidebar: parseJsonField(body.sidebar, []),
  sections: parseJsonField(body.sections, {}),
  operations: parseJsonField(body.operations, {}),
  ipWhitelist: parseJsonField(body.ipWhitelist, []),
});

const deriveStateCode = (...values) => {
  const value = values.find(Boolean);
  if (!value) return undefined;
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
};

const deriveAreaCode = (...values) => {
  const value = values.find(Boolean);
  if (!value) return undefined;
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
};

const deriveEnterpriseIdMetadata = async (module, body = {}) => {
  const metadata = { ...(body.metadata || {}) };

  const stateCode = metadata.stateCode
    || body.stateCode
    || deriveStateCode(metadata.state, body.state, metadata.regionState, body.regionState, body.organization?.state);

  const areaCode = metadata.areaCode
    || body.areaCode
    || deriveAreaCode(metadata.area, body.area, metadata.city, body.city, body.name);

  const derived = {
    ...metadata,
    stateCode,
    areaCode,
    date: metadata.date || metadata.startDate || body.startDate || body.date,
    meetingDate: metadata.meetingDate || body.meetingDate || body.date,
    scope: metadata.scope || body.scope,
    type: body.type || metadata.type,
  };

  if (module === "chapter" && !derived.executiveDirectorCode) {
    const parentId = body.parent || metadata.parentId;
    if (parentId) {
      const parent = await EnterpriseRecord.findById(parentId).select("code");
      if (parent?.code) derived.executiveDirectorCode = parent.code;
    }
  }

  if ((module === "meeting" || module === "event") && !derived.chapterCode) {
    const chapterId = body.chapter || metadata.chapterId;
    if (chapterId) {
      const chapter = await EnterpriseRecord.findById(chapterId).select("code");
      if (chapter?.code) derived.chapterCode = chapter.code;
    }
  }

  return derived;
};

exports.getDashboard = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const isSuperOrAdmin = ["superadmin", "admin"].includes(role);

  const filter = {};
  const userFilter = { role: { $ne: "superadmin" } };
  if (role === "region_director") {
    userFilter.role = { $nin: ["superadmin", "customer"] };
  } else {
    userFilter.$or = [
      { role: { $ne: "customer" } },
      { status: { $nin: ["pending_approval", "rejected"] } }
    ];
  }
  const vendorFilter = {};
  const appFilter = {};

  if (!isSuperOrAdmin) {
    const meta = getUserMeta(req.user);
    const profile = meta.adminProfile || {};
    const org = profile.organization || {};

    const resolveLocationIds = async (org) => {
      const filters = {};
      const isValidId = (val) => mongoose.Types.ObjectId.isValid(val);

      if (org.region) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "region", $or: [isValidId(org.region) ? { _id: org.region } : null, { code: org.region }, { name: org.region }].filter(Boolean) });
        if (match) filters.regionId = match._id;
      }
      if (org.state) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "state", $or: [isValidId(org.state) ? { _id: org.state } : null, { code: org.state }, { name: org.state }].filter(Boolean) });
        if (match) filters.stateId = match._id;
      }
      if (org.district) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "district", $or: [isValidId(org.district) ? { _id: org.district } : null, { code: org.district }, { name: org.district }].filter(Boolean) });
        if (match) filters.districtId = match._id;
      }
      if (org.chapter) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", $or: [isValidId(org.chapter) ? { _id: org.chapter } : null, { code: org.chapter }, { name: org.chapter }].filter(Boolean) });
        if (match) filters.chapterId = match._id;
      }
      return filters;
    };

    const locationIds = await resolveLocationIds(org);

    if (role === "region_director") {
      filter.regionId = locationIds.regionId;
    } else if (role === "state_director") {
      filter.stateId = locationIds.stateId;
    } else if (["executive_director", "district_director"].includes(role)) {
      filter.districtId = locationIds.districtId;
    } else if (["launch_director", "direct_consultant", "chapter_president", "vice_president"].includes(role)) {
      filter.chapterId = locationIds.chapterId;
    }

    if (filter.regionId) {
      userFilter["meta.adminProfile.organization.region"] = filter.regionId.toString();
      appFilter.regionId = filter.regionId;
    }
    if (filter.stateId) {
      userFilter["meta.adminProfile.organization.state"] = filter.stateId.toString();
      appFilter.stateId = filter.stateId;
    }
    if (filter.districtId) {
      userFilter["meta.adminProfile.organization.district"] = filter.districtId.toString();
      appFilter.districtId = filter.districtId;
    }
    if (filter.chapterId) {
      userFilter["meta.adminProfile.organization.chapter"] = filter.chapterId.toString();
      appFilter.chapterId = filter.chapterId;
    }
  }

  const [
    totalUsers, totalVendors, pendingVendors, activeVendors,
    verifiedVendors, servicesCount, productsCount, eventsCount,
    newUsersToday, newVendorsToday, revenueAgg, membershipRevenueAgg,
    monthlyRevenue, recentPayments, membershipApplicationsCount, pendingMembershipApplications,
    documentsVerifiedApplications, underReviewApplications, finalApprovalApplications,
  ] = await Promise.all([
    User.countDocuments(userFilter),
    Vendor.countDocuments(vendorFilter),
    Vendor.countDocuments({ ...vendorFilter, status: "pending" }),
    Vendor.countDocuments({ ...vendorFilter, status: "approved", isActive: true }),
    Vendor.countDocuments({ ...vendorFilter, isVerified: true }),
    Service.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true }),
    Event.countDocuments({ isActive: true }),
    User.countDocuments({ ...userFilter, createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Vendor.countDocuments({ ...vendorFilter, createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
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
    MembershipApplication.countDocuments(appFilter),
    MembershipApplication.countDocuments({ ...appFilter, status: "submitted" }),
    MembershipApplication.countDocuments({ ...appFilter, status: "documents_verified" }),
    MembershipApplication.countDocuments({ ...appFilter, status: "under_review" }),
    MembershipApplication.countDocuments({ ...appFilter, status: "approved" }),
  ]);

  const roleStats = {};

  if (isSuperOrAdmin) {
    roleStats.totalRegions = await EnterpriseRecord.countDocuments({ module: "organization", type: "region" });
    roleStats.totalStateDirectors = await User.countDocuments({ role: "state_director" });
    roleStats.totalMembers = await User.countDocuments({ role: "customer" });
    roleStats.pendingMemberships = await MembershipApplication.countDocuments({ status: "submitted" });
    roleStats.approvedMemberships = await MembershipApplication.countDocuments({ status: "approved" });
    roleStats.activeVendors = await Vendor.countDocuments({ status: "approved", isActive: true });
  } else if (role === "region_director") {
    const regionId = filter.regionId;
    roleStats.totalStates = await EnterpriseRecord.countDocuments({ module: "organization", type: "state", parent: regionId });
    const stateIds = await EnterpriseRecord.find({ module: "organization", type: "state", parent: regionId }).distinct("_id");
    roleStats.totalDistricts = await EnterpriseRecord.countDocuments({ module: "organization", type: "district", parent: { $in: stateIds } });
    roleStats.pendingMemberships = await MembershipApplication.countDocuments({ regionId, status: "submitted" });
    roleStats.approvedMemberships = await MembershipApplication.countDocuments({ regionId, status: "approved" });
  } else if (role === "state_director") {
    const stateId = filter.stateId;
    roleStats.totalDistricts = await EnterpriseRecord.countDocuments({ module: "organization", type: "district", parent: stateId });
    const districtIds = await EnterpriseRecord.find({ module: "organization", type: "district", parent: stateId }).distinct("_id");
    roleStats.totalChapters = await EnterpriseRecord.countDocuments({ module: "organization", type: "chapter", parent: { $in: districtIds } });
    roleStats.pendingMemberships = await MembershipApplication.countDocuments({ stateId, status: "submitted" });
  } else if (role === "district_director") {
    const districtId = filter.districtId;
    roleStats.totalChapters = await EnterpriseRecord.countDocuments({ module: "organization", type: "chapter", parent: districtId });
    roleStats.executiveDirectors = await User.countDocuments({ role: "executive_director", "meta.adminProfile.organization.district": districtId?.toString() });
    roleStats.pendingMemberships = await MembershipApplication.countDocuments({ districtId, status: "submitted" });
  } else if (role === "executive_director") {
    const districtId = filter.districtId;
    const chapterId = filter.chapterId;
    roleStats.launchDirectors = await User.countDocuments({ role: "launch_director", "meta.adminProfile.organization.district": districtId?.toString() });
    roleStats.pendingMemberships = await MembershipApplication.countDocuments({ chapterId, status: "submitted" });
    roleStats.approvedMemberships = await MembershipApplication.countDocuments({ chapterId, status: "approved" });
  } else if (role === "launch_director") {
    const chapterId = filter.chapterId;
    roleStats.directConsultants = await User.countDocuments({ role: "direct_consultant", "meta.adminProfile.organization.chapter": chapterId?.toString() });
    roleStats.activeChapters = await EnterpriseRecord.countDocuments({ module: "organization", type: "chapter", _id: chapterId, status: "active" });
  } else if (role === "direct_consultant") {
    const chapterId = filter.chapterId;
    roleStats.chapterPresidents = await User.countDocuments({ role: "chapter_president", "meta.adminProfile.organization.chapter": chapterId?.toString() });
    roleStats.pendingMemberships = await MembershipApplication.countDocuments({ chapterId, status: "submitted" });
  } else if (role === "chapter_president") {
    const chapterId = filter.chapterId;
    roleStats.vicePresidents = await User.countDocuments({ role: "vice_president", "meta.adminProfile.organization.chapter": chapterId?.toString() });
    roleStats.members = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterId?.toString() });
  } else if (role === "vice_president") {
    const chapterId = filter.chapterId;
    roleStats.secretaries = await User.countDocuments({ role: "secretary", "meta.adminProfile.organization.chapter": chapterId?.toString() });
    roleStats.registeredMembers = await User.countDocuments({ role: "customer", "meta.adminProfile.organization.chapter": chapterId?.toString(), isActive: true });
    roleStats.pendingRegistrations = await MembershipApplication.countDocuments({ chapterId, status: "submitted" });
  } else if (role === "secretary") {
    const chapterId = filter.chapterId;
    roleStats.attendance = await EnterpriseRecord.countDocuments({ module: "attendance", chapter: chapterId });
    roleStats.meetings = await EnterpriseRecord.countDocuments({ module: "meeting", chapter: chapterId });
    roleStats.documents = await EnterpriseRecord.countDocuments({ module: "document", chapter: chapterId });
  }

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
    applicationStatusCounts: {
      documentsVerified: documentsVerifiedApplications,
      underReview: underReviewApplications,
      finalApproval: finalApprovalApplications,
    },
    roleStats,
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

exports.getSuperAdminConfig = asyncHandler(async (req, res) => {
  const config = await getAllSuperConfig();
  successResponse(res, 200, "Super admin configuration retrieved", config);
});

exports.getSuperAdminConfigSection = asyncHandler(async (req, res) => {
  const { section } = req.params;
  const key = SUPER_CONFIG_KEYS[section];
  if (!key) return res.status(404).json({ success: false, message: "Configuration section not found" });

  const value = await getConfigSetting(key, superAdminDefaults[section]);
  successResponse(res, 200, "Configuration section retrieved", value);
});

exports.updateSuperAdminConfigSection = asyncHandler(async (req, res) => {
  const { section } = req.params;
  const key = SUPER_CONFIG_KEYS[section];
  if (!key) return res.status(404).json({ success: false, message: "Configuration section not found" });

  const value = await saveConfigSetting(key, req.body.value, req.user._id, `Super admin ${section} configuration`);
  successResponse(res, 200, "Configuration saved", value);
});

exports.updateFeaturePermission = asyncHandler(async (req, res) => {
  const { role, module } = req.params;
  const matrix = await getConfigSetting(SUPER_CONFIG_KEYS.featureMatrix, superAdminDefaults.featureMatrix);
  matrix[role] = matrix[role] || {};
  matrix[role][module] = { ...(matrix[role][module] || {}), ...req.body };

  const value = await saveConfigSetting(SUPER_CONFIG_KEYS.featureMatrix, matrix, req.user._id, "Role module feature matrix");
  successResponse(res, 200, "Feature permission saved", value);
});

exports.getRoleConfiguration = asyncHandler(async (req, res) => {
  const { role } = req.params;
  const config = await getAllSuperConfig();
  const profile = req.user.role === role ? getUserMeta(req.user).adminProfile : null;
  if (profile) {
    const sidebar = (profile.sidebar || []).map((moduleName, index) => ({
      id: moduleName,
      label: moduleName.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      enabled: true,
      order: index + 1,
    }));
    const features = (profile.modules || []).reduce((result, moduleName) => {
      result[moduleName] = {
        enabled: true,
        showSidebar: (profile.sidebar || []).includes(moduleName),
        showDashboardCard: (profile.dashboardWidgets || []).includes(moduleName),
        enableNotifications: true,
        apiAccess: true,
        ...(profile.permissions?.[moduleName] || {}),
      };
      return result;
    }, {});
    const operations = profile.operations || Object.fromEntries(
      Object.entries(profile.permissions || {}).map(([moduleName, permission]) => [
        moduleName,
        {
          view: Boolean(permission?.canView),
          create: Boolean(permission?.canCreate),
          edit: Boolean(permission?.canEdit),
          delete: Boolean(permission?.canDelete),
          approve: Boolean(permission?.canApprove),
          export: Boolean(permission?.canExport),
          print: Boolean(permission?.canPrint),
        },
      ])
    );
    return successResponse(res, 200, "Role configuration retrieved", {
      role,
      organization: profile.organization || {},
      modules: profile.modules || [],
      permissions: profile.permissions || {},
      features,
      sidebar,
      widgets: (profile.dashboardWidgets || []).map((id, index) => ({ id, title: id.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()), enabled: true, order: index + 1, size: "small" })),
      workflowPermissions: profile.workflowPermissions || {},
      sections: profile.sections || {},
      operations,
    });
  }
  successResponse(res, 200, "Role configuration retrieved", {
    role,
    features: config.featureMatrix?.[role] || {},
    sidebar: config.sidebar?.[role] || [],
    widgets: config.dashboardWidgets?.[role] || config.dashboardWidgets?.superadmin || [],
  });
});

exports.getSystemLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.type === "errors") filter.isSuccess = false;
  if (req.query.search) {
    filter.$or = [
      { action: new RegExp(req.query.search, "i") },
      { resource: new RegExp(req.query.search, "i") },
      { endpoint: new RegExp(req.query.search, "i") },
      { errorMessage: new RegExp(req.query.search, "i") },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate("user", "name email role").sort("-createdAt").skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  paginatedResponse(res, logs, page, limit, total, "System logs retrieved");
});

const allowedEnterpriseModules = [
  "organization",
  "assignment",
  "visitor",
  "meeting",
  "business",
  "chapter",
  "event",
  "vendor_management",
  "marketplace",
  "business_wall",
  "training",
  "testimonial",
  "report",
  "scorecard",
  "activity",
  "workflow",
  "referral_pipeline",
  "visitor_conversion",
  "attendance",
  "vendor_approval",
  "marketplace_approval",
  "notification_automation",
  "task",
  "calendar",
  "executive_dashboard",
  "chapter_dashboard",
  "member_journey",
  "ai_insight",
];

const assertEnterpriseModule = (module) => allowedEnterpriseModules.includes(module);

const buildEnterpriseFilter = (module, query) => {
  const filter = { module };
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.parent) filter.parent = query.parent;
  if (query.director) filter.director = query.director;
  if (query.chapter) filter.chapter = query.chapter;
  if (query.search) {
    filter.$or = [
      { name: new RegExp(query.search, "i") },
      { code: new RegExp(query.search, "i") },
      { "metadata.company": new RegExp(query.search, "i") },
      { "metadata.contact": new RegExp(query.search, "i") },
      { "metadata.category": new RegExp(query.search, "i") },
    ];
  }
  return filter;
};

const enterprisePopulate = [
  { path: "parent", select: "name code type status" },
  { path: "director", select: "name email role" },
  { path: "assignedTo", select: "name email role" },
  { path: "chapter", select: "name code type status" },
  { path: "createdBy", select: "name email role" },
];

exports.getEnterpriseRecords = asyncHandler(async (req, res) => {
  const { module } = req.params;
  if (!assertEnterpriseModule(module)) return res.status(404).json({ success: false, message: "Enterprise module not found" });

  const { page, limit, skip } = getPagination(req.query);
  const sort = req.query.sort || "-createdAt";
  const filter = buildEnterpriseFilter(module, req.query);

  const [records, total] = await Promise.all([
    EnterpriseRecord.find(filter).populate(enterprisePopulate).sort(sort).skip(skip).limit(limit),
    EnterpriseRecord.countDocuments(filter),
  ]);

  paginatedResponse(res, records, page, limit, total, "Enterprise records retrieved");
});

exports.getEnterpriseRecord = asyncHandler(async (req, res) => {
  const record = await EnterpriseRecord.findById(req.params.id).populate(enterprisePopulate).populate("timeline.user", "name email role");
  if (!record) return res.status(404).json({ success: false, message: "Enterprise record not found" });
  successResponse(res, 200, "Enterprise record retrieved", record);
});

exports.createEnterpriseRecord = asyncHandler(async (req, res) => {
  const { module } = req.params;
  if (!assertEnterpriseModule(module)) return res.status(404).json({ success: false, message: "Enterprise module not found" });

  delete req.body.code;
  const idMetadata = await deriveEnterpriseIdMetadata(module, req.body);
  const generatedCode = await idGenerator.generateEnterpriseRecordId(module, idMetadata, req.body.type);

  const record = await EnterpriseRecord.create({
    ...req.body,
    module,
    code: generatedCode,
    createdBy: req.user._id,
    updatedBy: req.user._id,
    timeline: [{ action: "created", after: req.body, user: req.user._id }],
  });

  await AuditLog.create({
    user: req.user._id,
    action: "enterprise_record_created",
    resource: module,
    resourceId: record._id,
    details: { after: record.toObject() },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  try {
    if (module === "meeting" && record.chapter) {
      const notificationService = require("../services/notification.service");
      const members = await User.find({ "meta.adminProfile.organization.chapter": record.chapter.toString() }).select("_id email name");
      if (members.length > 0) {
        for (const member of members) {
          await notificationService.sendNotification({
            recipientId: member._id,
            type: "meeting_created",
            title: "New Chapter Meeting Scheduled",
            message: `A new chapter meeting has been scheduled: ${record.name}.`,
            link: "/meetings",
            emailTemplate: "meetingInvitation",
            emailParams: [record.name, record.metadata?.meetingDate || record.createdAt, record.metadata?.venue || "Chapter Meeting Hall"]
          });
        }
      }
    } else if (module === "attendance" && record.assignedTo) {
      const notificationService = require("../services/notification.service");
      await notificationService.sendNotification({
        recipientId: record.assignedTo,
        type: "attendance_submitted",
        title: "Attendance Submitted",
        message: `Your attendance status has been recorded: ${record.status || "present"}.`,
        link: "/attendance"
      });
    }
  } catch (notifErr) {
    // Don't fail the record creation if notifications fail
  }

  successResponse(res, 201, "Enterprise record created", record);
});

exports.updateEnterpriseRecord = asyncHandler(async (req, res) => {
  const existing = await EnterpriseRecord.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: "Enterprise record not found" });

  const before = existing.toObject();
  delete req.body.code;
  Object.assign(existing, req.body, { updatedBy: req.user._id });
  existing.timeline.push({ action: "updated", before, after: req.body, user: req.user._id });
  await existing.save();

  await AuditLog.create({
    user: req.user._id,
    action: "enterprise_record_updated",
    resource: existing.module,
    resourceId: existing._id,
    details: { before, after: existing.toObject() },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  successResponse(res, 200, "Enterprise record updated", existing);
});

exports.deleteEnterpriseRecord = asyncHandler(async (req, res) => {
  const record = await EnterpriseRecord.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: "Enterprise record not found" });

  await AuditLog.create({
    user: req.user._id,
    action: "enterprise_record_deleted",
    resource: record.module,
    resourceId: record._id,
    details: { before: record.toObject() },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  successResponse(res, 200, "Enterprise record deleted");
});

exports.updateEnterpriseStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const record = await EnterpriseRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: "Enterprise record not found" });
  const before = record.status;
  record.status = status;
  record.updatedBy = req.user._id;
  record.timeline.push({ action: "status_changed", before, after: status, user: req.user._id });
  await record.save();
  successResponse(res, 200, "Enterprise record status updated", record);
});

exports.getEnterpriseStats = asyncHandler(async (req, res) => {
  const { module } = req.params;
  if (!assertEnterpriseModule(module)) return res.status(404).json({ success: false, message: "Enterprise module not found" });

  const [total, byStatus, byType, totals] = await Promise.all([
    EnterpriseRecord.countDocuments({ module }),
    EnterpriseRecord.aggregate([{ $match: { module } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    EnterpriseRecord.aggregate([{ $match: { module } }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    EnterpriseRecord.aggregate([
      { $match: { module } },
      {
        $group: {
          _id: null,
          membersCount: { $sum: "$membersCount" },
          meetingsCount: { $sum: "$meetingsCount" },
          visitorsCount: { $sum: "$visitorsCount" },
          businessValue: { $sum: "$businessValue" },
        },
      },
    ]),
  ]);

  successResponse(res, 200, "Enterprise statistics", { total, byStatus, byType, totals: totals[0] || {} });
});

exports.getOrganizationTree = asyncHandler(async (req, res) => {
  const records = await EnterpriseRecord.find({ module: "organization" }).populate("director", "name email role").sort("type name");
  const byParent = new Map();
  records.forEach((record) => {
    const parentId = record.parent?.toString() || "root";
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(record.toObject());
  });

  const attachChildren = (node) => ({
    ...node,
    children: (byParent.get(node._id.toString()) || []).map(attachChildren),
  });

  const tree = (byParent.get("root") || []).map(attachChildren);
  successResponse(res, 200, "Organization tree retrieved", tree);
});

exports.bulkImportEnterpriseRecords = asyncHandler(async (req, res) => {
  const { module } = req.params;
  const records = Array.isArray(req.body.records) ? req.body.records : [];
  if (!assertEnterpriseModule(module)) return res.status(404).json({ success: false, message: "Enterprise module not found" });
  if (!records.length) return res.status(400).json({ success: false, message: "records must contain at least one item" });

  const preparedRecords = [];
  for (const record of records) {
    const sanitizedRecord = { ...record };
    delete sanitizedRecord.code;
    const idMetadata = await deriveEnterpriseIdMetadata(module, sanitizedRecord);
    preparedRecords.push({
      ...sanitizedRecord,
      module,
      code: await idGenerator.generateEnterpriseRecordId(module, idMetadata, sanitizedRecord.type),
      createdBy: req.user._id,
      updatedBy: req.user._id,
      timeline: [{ action: "imported", after: sanitizedRecord, user: req.user._id }],
    });
  }

  const created = await EnterpriseRecord.insertMany(preparedRecords);

  successResponse(res, 201, "Enterprise records imported", { count: created.length, records: created });
});

exports.globalEnterpriseSearch = asyncHandler(async (req, res) => {
  const search = req.query.search || req.query.q;
  if (!search) return successResponse(res, 200, "Global search results", []);

  const records = await EnterpriseRecord.find({
    $or: [
      { name: new RegExp(search, "i") },
      { code: new RegExp(search, "i") },
      { "metadata.company": new RegExp(search, "i") },
      { "metadata.contact": new RegExp(search, "i") },
      { "metadata.category": new RegExp(search, "i") },
    ],
  }).sort("-updatedAt").limit(25);

  successResponse(res, 200, "Global search results", records);
});

exports.transitionEnterpriseRecord = asyncHandler(async (req, res) => {
  const { stage, status, note, assignedTo, createTask } = req.body;
  const record = await EnterpriseRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: "Enterprise record not found" });

  const before = { status: record.status, metadata: record.metadata, assignedTo: record.assignedTo };
  if (status) record.status = status;
  if (assignedTo) record.assignedTo = assignedTo;
  record.metadata = {
    ...(record.metadata || {}),
    currentStage: stage || record.metadata?.currentStage,
    lastTransitionAt: new Date(),
  };
  record.timeline.push({ action: "stage_transition", note, before, after: { stage, status, assignedTo }, user: req.user._id });
  record.updatedBy = req.user._id;
  await record.save();

  let task = null;
  if (createTask) {
    const taskCode = await idGenerator.generateGenericModuleId("task", { date: createTask.dueDate || new Date() });
    task = await EnterpriseRecord.create({
      module: "task",
      type: createTask.type || "approval",
      name: createTask.name || `${record.name} follow-up`,
      code: taskCode,
      status: createTask.status || "pending",
      assignedTo: assignedTo || record.assignedTo,
      parent: record._id,
      metadata: {
        dueDate: createTask.dueDate,
        priority: createTask.priority || "medium",
        sourceModule: record.module,
        sourceRecord: record._id,
      },
      createdBy: req.user._id,
      updatedBy: req.user._id,
      timeline: [{ action: "task_created_from_transition", after: createTask, user: req.user._id }],
    });
  }

  successResponse(res, 200, "Record transitioned", { record, task });
});

exports.getEnterpriseKanban = asyncHandler(async (req, res) => {
  const { module } = req.params;
  if (!assertEnterpriseModule(module)) return res.status(404).json({ success: false, message: "Enterprise module not found" });
  const records = await EnterpriseRecord.find(buildEnterpriseFilter(module, req.query)).populate(enterprisePopulate).sort("-updatedAt").limit(200);
  const grouped = records.reduce((result, record) => {
    const stage = record.metadata?.currentStage || record.status || "new";
    result[stage] = result[stage] || [];
    result[stage].push(record);
    return result;
  }, {});
  successResponse(res, 200, "Kanban records retrieved", grouped);
});

exports.getEnterpriseCalendar = asyncHandler(async (req, res) => {
  const modules = ["meeting", "event", "training", "task", "calendar"];
  const records = await EnterpriseRecord.find({
    module: { $in: modules },
    ...(req.query.status ? { status: req.query.status } : {}),
  }).populate(enterprisePopulate).sort("metadata.startDate metadata.dueDate createdAt").limit(300);
  successResponse(res, 200, "Enterprise calendar retrieved", records);
});

exports.getEnterpriseAnalytics = asyncHandler(async (req, res) => {
  const [byModule, byStatus, businessByChapter, attendanceByChapter] = await Promise.all([
    EnterpriseRecord.aggregate([{ $group: { _id: "$module", count: { $sum: 1 }, businessValue: { $sum: "$businessValue" } } }]),
    EnterpriseRecord.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    EnterpriseRecord.aggregate([
      { $match: { module: "business" } },
      { $group: { _id: "$chapter", value: { $sum: "$businessValue" }, count: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 10 },
    ]),
    EnterpriseRecord.aggregate([
      { $match: { module: "attendance" } },
      { $group: { _id: "$chapter", attendance: { $sum: "$attendanceCount" }, meetings: { $sum: "$meetingsCount" } } },
      { $limit: 10 },
    ]),
  ]);

  successResponse(res, 200, "Enterprise analytics", { byModule, byStatus, businessByChapter, attendanceByChapter });
});

exports.getAdminAccounts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) {
    filter.role = req.query.role;
  } else {
    filter.role = { $in: ADMIN_ROLE_VALUES };
  }

  const caller = req.user;

  let locationFilter = {};
  const isGlobal = ["superadmin", "admin"].includes(caller?.role);

  if (!isGlobal) {
    const meta = (caller.toObject ? caller.toObject({ flattenMaps: true }).meta : caller.meta) || {};
    const org = meta.adminProfile?.organization || {};
    
    if (caller?.role === "region_director" && (filter.role === "customer" || req.query.role === "customer")) {
      return paginatedResponse(res, [], page, limit, 0, "Region Director cannot access member roster");
    }

    if (org.chapter) {
      locationFilter = {
        $or: [
          { "meta.adminProfile.organization.chapter": org.chapter.toString() },
          { "meta": { $exists: false } }
        ]
      };
    } else if (org.district) {
      locationFilter = {
        $or: [
          { "meta.adminProfile.organization.district": org.district.toString() },
          { "meta": { $exists: false } }
        ]
      };
    } else if (org.state) {
      locationFilter = {
        $or: [
          { "meta.adminProfile.organization.state": org.state.toString() },
          { "meta": { $exists: false } }
        ]
      };
    } else if (org.region) {
      locationFilter = {
        $or: [
          { "meta.adminProfile.organization.region": org.region.toString() },
          { "meta": { $exists: false } }
        ]
      };
    } else {
      return paginatedResponse(res, [], page, limit, 0, "No organization assigned");
    }
  }

  if (filter.role === "customer" || req.query.role === "customer") {
    if (!["vice_president", "executive_director"].includes(req.user.role)) {
      filter.status = { $nin: ["pending_approval", "rejected"] };
    }
  }
  if (req.query.status === "active") Object.assign(filter, { isActive: true, isSuspended: false, isBlocked: false });
  if (req.query.status === "suspended") filter.isSuspended = true;
  if (req.query.status === "blocked") filter.isBlocked = true;

  let searchFilter = {};
  if (req.query.search) {
    searchFilter = {
      $or: [
        { name: new RegExp(req.query.search, "i") },
        { email: new RegExp(req.query.search, "i") },
        { phone: new RegExp(req.query.search, "i") },
      ]
    };
  }

  const conditions = [];
  if (Object.keys(locationFilter).length > 0) conditions.push(locationFilter);
  if (Object.keys(searchFilter).length > 0) conditions.push(searchFilter);

  if (conditions.length > 0) {
    filter.$and = conditions;
  }

  const [admins, total] = await Promise.all([
    User.find(filter).select("-password -refreshToken").sort("-createdAt").skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const populatedAdmins = await populateUserOrganizationLocations(admins);
  paginatedResponse(res, populatedAdmins, page, limit, total, "Admin accounts retrieved");
});

exports.createAdminAccount = asyncHandler(async (req, res) => {
  const creatorRole = req.user.role;
  const body = normalizeAdminBody(req.body);
  const { name, email, phone, password, role = "admin" } = body;

  if (!isAdminRole(role) && role !== "customer") return res.status(400).json({ success: false, message: "Invalid admin role" });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ success: false, message: "Email already registered" });

  // 1. Verify Role Hierarchy
  const CREATION_HIERARCHY = {
    superadmin: ["admin"],
    admin: ["region_director"],
    region_director: ["state_director"],
    state_director: ["district_director"],
    district_director: ["executive_director"],
    executive_director: ["launch_director"],
    launch_director: ["direct_consultant"],
    direct_consultant: ["chapter_president"],
    chapter_president: ["vice_president"],
    vice_president: ["secretary", "customer"],
  };

  const allowedRoles = CREATION_HIERARCHY[creatorRole] || [];
  if (!allowedRoles.includes(role)) {
    throw new AppError(`Your role (${creatorRole}) is not permitted to create accounts for ${role}.`, 403);
  }

  // 2. Location Inheritance & Validation
  const creatorMeta = getUserMeta(req.user);
  const creatorOrg = creatorMeta.adminProfile?.organization || {};
  let childOrg = body.organization ? { ...body.organization } : {};

  const isGlobalRole = ["superadmin", "admin"].includes(creatorRole);

  if (!isGlobalRole) {
    if (creatorRole === "region_director") {
      if (!creatorOrg.region) throw new AppError("Creator does not have a assigned Region", 400);
      if (!childOrg.state) throw new AppError("State is required for State Director", 400);
      
      const stateRecord = await EnterpriseRecord.findOne({ type: "state", _id: childOrg.state, parent: creatorOrg.region });
      if (!stateRecord) throw new AppError("Selected State does not belong to creator's Region", 400);
      
      childOrg.region = creatorOrg.region;
    } else if (creatorRole === "state_director") {
      if (!creatorOrg.state) throw new AppError("Creator does not have a assigned State", 400);
      if (!childOrg.district) throw new AppError("District is required for District Director", 400);
      
      const districtRecord = await EnterpriseRecord.findOne({ type: "district", _id: childOrg.district, parent: creatorOrg.state });
      if (!districtRecord) throw new AppError("Selected District does not belong to creator's State", 400);
      
      childOrg.region = creatorOrg.region;
      childOrg.state = creatorOrg.state;
    } else if (creatorRole === "district_director") {
      if (!creatorOrg.district) throw new AppError("Creator does not have a assigned District", 400);
      if (!childOrg.chapter) throw new AppError("Chapter is required for Executive Director", 400);

      const chapterRecord = await EnterpriseRecord.findOne({ type: "chapter", _id: childOrg.chapter, parent: creatorOrg.district });
      if (!chapterRecord) throw new AppError("Selected Chapter does not belong to creator's District", 400);
      
      childOrg.region = creatorOrg.region;
      childOrg.state = creatorOrg.state;
      childOrg.district = creatorOrg.district;
    } else if (["executive_director", "launch_director", "direct_consultant", "chapter_president", "vice_president"].includes(creatorRole)) {
      if (!creatorOrg.chapter) throw new AppError("Creator does not have a assigned Chapter", 400);
      
      childOrg.region = creatorOrg.region;
      childOrg.state = creatorOrg.state;
      childOrg.district = creatorOrg.district;
      childOrg.chapter = creatorOrg.chapter;
    }
  }

  // 3. Unique Official Limits per Location
  if (role === "chapter_president") {
    const existingPresident = await User.findOne({
      role: "chapter_president",
      "meta.adminProfile.organization.chapter": childOrg.chapter?.toString()
    });
    if (existingPresident) {
      throw new AppError("Only one Chapter President is allowed per Chapter.", 400);
    }
  }

  if (role === "vice_president") {
    const existingVP = await User.findOne({
      role: "vice_president",
      "meta.adminProfile.organization.chapter": childOrg.chapter?.toString()
    });
    if (existingVP) {
      throw new AppError("Only one Vice President is allowed per Chapter.", 400);
    }
  }

  if (role === "secretary") {
    const existingSec = await User.findOne({
      role: "secretary",
      "meta.adminProfile.organization.chapter": childOrg.chapter?.toString()
    });
    if (existingSec) {
      throw new AppError("Only one Secretary is allowed per Chapter.", 400);
    }
  }

  if (role === "state_director") {
    const existing = await User.findOne({
      role: "state_director",
      "meta.adminProfile.organization.state": childOrg.state?.toString()
    });
    if (existing) {
      throw new AppError("Only one State Director is allowed per State.", 400);
    }
  }

  if (role === "district_director") {
    const existing = await User.findOne({
      role: "district_director",
      "meta.adminProfile.organization.district": childOrg.district?.toString()
    });
    if (existing) {
      throw new AppError("Only one District Director is allowed per District.", 400);
    }
  }

  // 4. Generate unique Official ID and temporary credentials
  const stateRecord = childOrg.state ? await EnterpriseRecord.findById(childOrg.state) : null;
  const regionRecord = childOrg.region ? await EnterpriseRecord.findById(childOrg.region) : null;
  const districtRecord = childOrg.district ? await EnterpriseRecord.findById(childOrg.district) : null;
  const chapterRecord = childOrg.chapter ? await EnterpriseRecord.findById(childOrg.chapter) : null;

  const officialId = await idGenerator.generateOfficialId({
    role,
    regionCode: regionRecord?.code || regionRecord?.name,
    stateCode: stateRecord?.code || stateRecord?.name,
    districtCode: districtRecord?.code || districtRecord?.name || chapterRecord?.code || chapterRecord?.name
  });
  const tempPassword = password || Math.random().toString(36).slice(-8) + "Aa1!";

  const admin = new User({
    name,
    email,
    phone,
    password: tempPassword,
    role,
    officialId,
    avatar: req.file ? { url: req.file.path, publicId: req.file.filename } : undefined,
    isEmailVerified: true,
    status: role === "customer" ? "pending_approval" : "approved",
  });

  // Force password change on first login
  const profileBody = {
    ...body,
    organization: childOrg,
    forcePasswordChange: true
  };

  applyAdminProfile(admin, buildAdminProfile(profileBody));
  await admin.save();

  // 5. Audit Log Creation
  await AuditLog.create({
    user: req.user._id,
    action: "admin_created",
    resource: "User",
    resourceId: admin._id,
    details: {
      creatorRole: req.user.role,
      newUserRole: role,
      region: childOrg.region || null,
      state: childOrg.state || null,
      district: childOrg.district || null,
      area: childOrg.area || null,
      chapter: childOrg.chapter || null,
      ipAddress: req.ip,
      device: req.get("User-Agent"),
      after: { role, email, adminProfile: getUserMeta(admin).adminProfile }
    },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // 6. Deliver credentials via email
  try {
    await sendTemplateEmail(
      email,
      "adminCredentials",
      name,
      email,
      tempPassword,
      officialId
    );
  } catch (_) {}

  const { password: _, refreshToken: __, ...adminData } = admin.toObject();
  successResponse(res, 201, "Admin account created", adminData);
});

exports.updateAdminAccount = asyncHandler(async (req, res) => {
  const body = normalizeAdminBody(req.body);
  const admin = await User.findById(req.params.id).select("+password");
  if (!admin || (!isAdminRole(admin.role) && admin.role !== "customer")) return res.status(404).json({ success: false, message: "Admin account not found" });
  const before = admin.toObject();
  const allowed = ["name", "phone", "role", "isActive", "isSuspended", "isBlocked"];
  allowed.forEach((field) => {
    if (body[field] !== undefined) admin[field] = body[field];
  });
  if (body.role && !isAdminRole(body.role) && body.role !== "customer") return res.status(400).json({ success: false, message: "Invalid admin role: " + body.role });
  if (req.file) admin.avatar = { url: req.file.path, publicId: req.file.filename };
  applyAdminProfile(admin, buildAdminProfile({ ...getUserMeta(admin).adminProfile, ...body }));
  await admin.save();

  await AuditLog.create({
    user: req.user._id,
    action: "admin_updated",
    resource: "User",
    resourceId: admin._id,
    details: { before, after: admin.toObject() },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  const { password: _, refreshToken: __, ...adminData } = admin.toObject();
  successResponse(res, 200, "Admin account updated", adminData);
});

exports.cloneAdminAccount = asyncHandler(async (req, res) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ success: false, message: "Only Super Admin can clone admin accounts" });
  }

  const source = await User.findById(req.params.id);
  if (!source || (!isAdminRole(source.role) && source.role !== "customer")) return res.status(404).json({ success: false, message: "Admin account not found" });
  const { name, email, phone, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ success: false, message: "Email already registered" });
  const clone = new User({
    name: name || `${source.name} Copy`,
    email,
    phone,
    password,
    role: req.body.role || source.role,
    isEmailVerified: true,
  });
  applyAdminProfile(clone, getUserMeta(source).adminProfile || {});
  await clone.save();
  const { password: _, refreshToken: __, ...cloneData } = clone.toObject();
  successResponse(res, 201, "Admin account cloned", cloneData);
});

exports.updateAdminAccountStatus = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const admin = await User.findById(req.params.id);
  if (!admin || (!isAdminRole(admin.role) && admin.role !== "customer")) {
    return res.status(404).json({ success: false, message: "Account not found" });
  }
  const before = { isActive: admin.isActive, isSuspended: admin.isSuspended, isBlocked: admin.isBlocked, status: admin.status };
  if (action === "suspend") Object.assign(admin, { isSuspended: true, suspendedAt: new Date(), suspendedReason: req.body.reason });
  if (action === "activate") Object.assign(admin, { isActive: true, isSuspended: false, isBlocked: false, suspendedReason: undefined, blockedReason: undefined });
  if (action === "lock") Object.assign(admin, { isBlocked: true, blockedAt: new Date(), blockedReason: req.body.reason });
  if (action === "unlock") Object.assign(admin, { isBlocked: false, blockedReason: undefined, loginAttempts: 0, lockUntil: undefined });
  if (action === "approve") {
    admin.status = "approved";
    if (admin.role === "customer" && !admin.memberId) {
      const meta = getUserMeta(admin);
      const org = meta.adminProfile?.organization || {};
      const stateRecord = org.state ? await EnterpriseRecord.findById(org.state) : null;
      const districtRecord = org.district ? await EnterpriseRecord.findById(org.district) : null;
      const stateCode = stateRecord?.code || "GL";
      const districtCode = districtRecord?.code || "GLO";
      const generatedMemberId = await idGenerator.generateMemberId({ stateCode, districtCode });
      
      // Perform direct database update to bypass Mongoose's immutable: true check for this one-time assignment
      await User.collection.updateOne(
        { _id: admin._id, memberId: { $exists: false } },
        { $set: { memberId: generatedMemberId } }
      );
      admin.memberId = generatedMemberId;
    }
  }
  if (action === "reject") Object.assign(admin, { status: "rejected" });
  await admin.save();

  await AuditLog.create({
    user: req.user._id,
    action: `admin_${action}`,
    resource: "User",
    resourceId: admin._id,
    details: { before, after: { isActive: admin.isActive, isSuspended: admin.isSuspended, isBlocked: admin.isBlocked, status: admin.status } },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  const { password: _, refreshToken: __, ...adminData } = admin.toObject();
  successResponse(res, 200, "Status updated successfully", adminData);
});

exports.resetAdminPassword = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.params.id).select("+password");
  if (!admin || (!isAdminRole(admin.role) && admin.role !== "customer")) return res.status(404).json({ success: false, message: "Admin account not found" });
  admin.password = req.body.password;
  const meta = getUserMeta(admin);
  admin.meta = { ...meta, adminProfile: { ...(meta.adminProfile || {}), security: { ...(meta.adminProfile?.security || {}), forcePasswordChange: true } } };
  await admin.save();
  await AuditLog.create({ user: req.user._id, action: "admin_password_reset", resource: "User", resourceId: admin._id, ipAddress: req.ip, userAgent: req.get("User-Agent") });
  successResponse(res, 200, "Admin password reset");
});

exports.deleteAdminAccount = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.params.id);
  if (!admin || (!isAdminRole(admin.role) && admin.role !== "customer")) return res.status(404).json({ success: false, message: "Admin account not found" });
  if (admin.role === "superadmin") return res.status(400).json({ success: false, message: "Super admin accounts cannot be deleted here" });
  await User.findByIdAndDelete(admin._id);
  await AuditLog.create({ user: req.user._id, action: "admin_deleted", resource: "User", resourceId: admin._id, details: { before: admin.toObject() }, ipAddress: req.ip, userAgent: req.get("User-Agent") });
  successResponse(res, 200, "Admin account deleted");
});

exports.loginAsAdmin = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.params.id);
  if (!admin || (!isAdminRole(admin.role) && admin.role !== "customer")) return res.status(404).json({ success: false, message: "Admin account not found" });
  const accessToken = generateAccessToken(admin._id, admin.role);
  const refreshToken = generateRefreshToken(admin._id);
  admin.refreshToken = refreshToken;
  await admin.save();
  await AuditLog.create({
    user: req.user._id,
    action: "admin_impersonation_started",
    resource: "User",
    resourceId: admin._id,
    details: { impersonatedRole: admin.role, impersonatedEmail: admin.email },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });
  const { password: _, refreshToken: __, ...adminData } = admin.toObject();
  successResponse(res, 200, "Impersonation session created", { user: adminData, accessToken, refreshToken, impersonatedBy: req.user._id });
});

exports.transferAdminOrganization = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.params.id);
  if (!admin || (!isAdminRole(admin.role) && admin.role !== "customer")) return res.status(404).json({ success: false, message: "Admin account not found" });
  const meta = getUserMeta(admin);
  const before = meta.adminProfile?.organization;
  admin.meta = {
    ...meta,
    adminProfile: { ...(meta.adminProfile || {}), organization: req.body.organization || {} },
  };
  await admin.save();
  await AuditLog.create({ user: req.user._id, action: "admin_organization_transferred", resource: "User", resourceId: admin._id, details: { before, after: req.body.organization }, ipAddress: req.ip, userAgent: req.get("User-Agent") });
  const { password: _, refreshToken: __, ...adminData } = admin.toObject();
  successResponse(res, 200, "Admin organization transferred", adminData);
});

exports.getAdminActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [logs, total] = await Promise.all([
    AuditLog.find({ user: req.params.id }).sort("-createdAt").skip(skip).limit(limit),
    AuditLog.countDocuments({ user: req.params.id }),
  ]);
  paginatedResponse(res, logs, page, limit, total, "Admin activity retrieved");
});
