const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");
const { AppError, asyncHandler } = require("./errorHandler");
const { isAdminRole, ADMIN_ROLE_VALUES } = require("../constants/adminRoles");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) throw new AppError("Not authenticated. Please log in.", 401);

  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded.id).select("+refreshToken");

  if (!user) throw new AppError("User not found", 401);
  if (!user.isActive) throw new AppError("Your account is deactivated", 401);
  if (user.isSuspended) throw new AppError("Your account is suspended", 403);
  if (user.isBlocked) throw new AppError("Your account is blocked", 403);
  if (user.isLocked) throw new AppError("Account temporarily locked due to multiple failed logins", 423);

  req.user = user;
  next();
});

const roleMatches = (allowedRole, actualRole) => {
  if (allowedRole === actualRole) return true;
  if (allowedRole === "admin" && isAdminRole(actualRole)) return true;
  if (allowedRole === "customer" && actualRole === "user") return true;
  if (allowedRole === "user" && actualRole === "customer") return true;
  return false;
};

const inferModuleFromPath = (path) => {
  const p = path.replace(/^\/api\/v\d+\//, "/");
  if (p.startsWith("/admin/dashboard")) return "dashboard";
  if (p.startsWith("/admin/admin-accounts")) return "settings";
  if (p.startsWith("/admin/super-config") || p.startsWith("/admin/settings") || p.startsWith("/admin/system")) return "settings";
  if (p.startsWith("/admin/audit-logs")) return "reports";
  if (p.startsWith("/admin/enterprise/search")) return "settings";
  if (p.includes("vendor")) return "vendors";
  if (p.includes("marketplace") || p.includes("products") || p.includes("services") || p.includes("banners")) return "marketplace";
  if (p.includes("membership") || p.includes("users") || p.includes("plans")) return "members";
  if (p.includes("visitor")) return "visitors";
  if (p.includes("meeting")) return "meetings";
  if (p.includes("attendance")) return "attendance";
  if (p.includes("training")) return "training";
  if (p.includes("event")) return "events";
  if (p.includes("referral")) return "referrals";
  if (p.includes("business")) return "business";
  if (p.includes("notification")) return "notifications";
  if (p.includes("report") || p.includes("analytics")) return "reports";
  return null;
};

const requiredPermission = (method) => {
  if (method === "GET") return "canView";
  if (method === "POST") return "canCreate";
  if (["PUT", "PATCH"].includes(method)) return "canEdit";
  if (method === "DELETE") return "canDelete";
  return "canView";
};

const getMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const authorize = (...roles) => (req, res, next) => {
  if (roles.some((role) => roleMatches(role, req.user.role))) return next();

  const profile = getMeta(req.user).adminProfile;
  if (profile?.modules?.length) {
    const moduleName = inferModuleFromPath(req.originalUrl || req.baseUrl + req.path);
    if (moduleName && profile.modules.includes(moduleName)) {
      const perm = profile.permissions?.[moduleName] || {};
      const permName = requiredPermission(req.method);
      if (perm.apiAccess === true && perm[permName] === true) {
        return next();
      }
    }
  }

  throw new AppError(`Role '${req.user.role}' is not authorized to access this resource`, 403);
};

const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.isActive && !user.isSuspended) req.user = user;
    } catch (_) {
      // optional auth - silently ignore
    }
  }
  next();
});

module.exports = { protect, authorize, optionalAuth, roleMatches };
