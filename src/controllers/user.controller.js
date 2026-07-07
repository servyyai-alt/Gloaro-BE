const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const { deleteFromCloudinary } = require("../config/cloudinary");
const { populateUserOrganizationLocations } = require("../utils/userPopulateHelper");

const compactObject = (data) => Object.fromEntries(
  Object.entries(data).filter(([, value]) => value !== undefined)
);

exports.getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { role, status, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status === "active") filter.isActive = true;
  if (status === "suspended") filter.isSuspended = true;
  if (status === "blocked") filter.isBlocked = true;
  if (search) filter.$or = [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }];

  const caller = req.user;
  const isGlobal = ["superadmin", "admin"].includes(caller?.role);
  if (!isGlobal) {
    const meta = caller.meta ? (typeof caller.meta.toObject === "function" ? caller.meta.toObject() : (caller.meta instanceof Map ? Object.fromEntries(caller.meta) : caller.meta)) : {};
    const org = meta.adminProfile?.organization || {};
    if (org.chapter) {
      filter["meta.adminProfile.organization.chapter"] = org.chapter.toString();
    } else if (org.district) {
      filter["meta.adminProfile.organization.district"] = org.district.toString();
    } else if (org.state) {
      filter["meta.adminProfile.organization.state"] = org.state.toString();
    } else if (org.region) {
      filter["meta.adminProfile.organization.region"] = org.region.toString();
    } else {
      return paginatedResponse(res, [], page, limit, 0);
    }
  }

  const [users, total] = await Promise.all([
    User.find(filter).select("-password -refreshToken").sort("-createdAt").skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  const populatedUsers = await populateUserOrganizationLocations(users);
  paginatedResponse(res, populatedUsers, page, limit, total);
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password -refreshToken");
  if (!user) throw new AppError("User not found", 404);
  const populated = await populateUserOrganizationLocations([user]);
  successResponse(res, 200, "User retrieved", populated[0]);
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken").populate("createdBy", "name email role");
  if (!user) throw new AppError("User not found", 404);
  const populated = await populateUserOrganizationLocations([user]);
  successResponse(res, 200, "Profile retrieved", populated[0]);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { name, phone, address, preferences, role, isActive } = req.body;
  const updateData = compactObject({ name, phone, address, preferences, role, isActive });
  if (req.file) updateData.avatar = { url: req.file.path, publicId: req.file.filename };

  const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    .select("-password -refreshToken");
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User updated", user);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, preferences } = req.body;
  const updateData = compactObject({ name, phone, address, preferences });
  if (req.file) {
    if (req.user.avatar?.publicId) await deleteFromCloudinary(req.user.avatar.publicId).catch(() => {});
    updateData.avatar = { url: req.file.path, publicId: req.file.filename };
  }
  const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true }).select("-password -refreshToken");
  successResponse(res, 200, "Profile updated", user);
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User deleted");
});

exports.suspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, {
    isSuspended: true, suspendedReason: reason, suspendedAt: new Date(),
  }, { new: true }).select("-password");
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User suspended", user);
});

exports.unsuspendUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, {
    isSuspended: false, $unset: { suspendedReason: 1, suspendedAt: 1 }
  }, { new: true }).select("-password");
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User unsuspended", user);
});

exports.blockUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, {
    isBlocked: true, blockedReason: reason, blockedAt: new Date(),
  }, { new: true }).select("-password");
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User blocked", user);
});

exports.unblockUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, {
    isBlocked: false, $unset: { blockedReason: 1, blockedAt: 1 }
  }, { new: true }).select("-password");
  if (!user) throw new AppError("User not found", 404);
  successResponse(res, 200, "User unblocked", user);
});

exports.getUserActivityLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [logs, total] = await Promise.all([
    AuditLog.find({ user: req.params.id }).sort("-createdAt").skip(skip).limit(limit),
    AuditLog.countDocuments({ user: req.params.id }),
  ]);
  paginatedResponse(res, logs, page, limit, total, "Activity logs retrieved");
});
