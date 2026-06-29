const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");
const { AppError, asyncHandler } = require("./errorHandler");

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
  if (allowedRole === "customer" && actualRole === "user") return true;
  if (allowedRole === "user" && actualRole === "customer") return true;
  return false;
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.some((role) => roleMatches(role, req.user.role))) {
    throw new AppError(`Role '${req.user.role}' is not authorized to access this resource`, 403);
  }
  next();
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
