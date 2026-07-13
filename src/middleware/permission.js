const permissionService = require("../services/permission.service");
const { AppError } = require("./errorHandler");

exports.checkPermission = (permissionCode) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError("Not authorized, no user context", 401));
      }
      
      const hasPerm = await permissionService.hasPermission(req.user._id, req.user.role, permissionCode);
      if (!hasPerm) {
        return next(new AppError(`Unauthorized access: missing permission ${permissionCode}`, 403));
      }
      
      next();
    } catch (err) {
      next(err);
    }
  };
};
