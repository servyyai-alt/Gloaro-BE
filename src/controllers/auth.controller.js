const authService = require("../services/auth.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { setTokenCookies, clearTokenCookies } = require("../utils/jwt");
const { successResponse } = require("../utils/response");

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Auth endpoints
 */

// @POST /api/v1/auth/register
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  successResponse(res, 201, result.message, {
    user: sanitizeUser(result.user),
  });
});

// @POST /api/v1/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, req.ip);

  setTokenCookies(res, result.accessToken, result.refreshToken);

  successResponse(res, 200, "Login successful", {
    user: sanitizeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

// @POST /api/v1/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  clearTokenCookies(res);
  successResponse(res, 200, "Logged out successfully");
});

// @POST /api/v1/auth/refresh-token
exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "Refresh token required" });
  }

  const result = await authService.refreshTokens(token);
  setTokenCookies(res, result.accessToken, result.refreshToken);
  successResponse(res, 200, "Tokens refreshed", result);
});

// @POST /api/v1/auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  successResponse(res, 200, result.message);
});

// @POST /api/v1/auth/reset-password/:token
exports.resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.params.token, req.body.password);
  successResponse(res, 200, result.message);
});

// @POST /api/v1/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user._id, currentPassword, newPassword);
  clearTokenCookies(res);
  successResponse(res, 200, result.message);
});

// @GET /api/v1/auth/verify-email/:token
exports.verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.params.token);
  successResponse(res, 200, result.message);
});

// @POST /api/v1/auth/send-otp
exports.sendOTP = asyncHandler(async (req, res) => {
  const result = await authService.sendOTP(req.user._id, req.body.type);
  successResponse(res, 200, result.message);
});

// @POST /api/v1/auth/verify-otp
exports.verifyOTP = asyncHandler(async (req, res) => {
  const result = await authService.verifyOTP(req.user._id, req.body.otp, req.body.type);
  successResponse(res, 200, result.message);
});

// @GET /api/v1/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  successResponse(res, 200, "Profile retrieved", { user: sanitizeUser(req.user) });
});

const sanitizeUser = (user) => {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  delete u.refreshToken;
  delete u.resetPasswordToken;
  delete u.emailVerificationToken;
  delete u.otp;
  return u;
};
