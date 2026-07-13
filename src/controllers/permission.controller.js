const Permission = require("../models/Permission");
const UserPermission = require("../models/UserPermission");
const User = require("../models/User");
const permissionService = require("../services/permission.service");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

// Get all system permissions
exports.getAllPermissions = asyncHandler(async (req, res) => {
  const list = await Permission.find().sort("module code");
  res.status(200).json({ success: true, data: list });
});

// Get current user's active permissions
exports.getMyPermissions = asyncHandler(async (req, res) => {
  const codes = await permissionService.getUserPermissionsList(req.user._id, req.user.role);
  res.status(200).json({ success: true, data: codes });
});

// Get specific user's assigned permissions and override status
exports.getUserPermissions = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) throw new AppError("Target user not found", 404);

  const userPerm = await UserPermission.findOne({ userId: targetUser._id });
  const activeCodes = await permissionService.getUserPermissionsList(targetUser._id, targetUser.role);

  res.status(200).json({
    success: true,
    data: {
      userId: targetUser._id,
      name: targetUser.name,
      role: targetUser.role,
      permissions: activeCodes,
      inherited: userPerm ? userPerm.inherited : true,
      assignedBy: userPerm ? userPerm.assignedBy : null,
      assignedDate: userPerm ? userPerm.assignedDate : null
    }
  });
});

// Assign custom permissions overrides (supervisor check enforced inside service)
exports.assignUserPermissions = asyncHandler(async (req, res) => {
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) throw new AppError("Permissions must be an array", 400);

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) throw new AppError("Target user not found", 404);

  const updated = await permissionService.assignUserPermissions(
    req.user._id,
    targetUser._id,
    permissions,
    req.ip,
    req.get("User-Agent")
  );

  res.status(200).json({
    success: true,
    message: "User permissions updated successfully",
    data: updated
  });
});
