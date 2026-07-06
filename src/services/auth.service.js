const crypto = require("crypto");
const User = require("../models/User");
const Referral = require("../models/Referral");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const { sendTemplateEmail } = require("../utils/email");
const { AppError } = require("../middleware/errorHandler");
const { setCache, deleteCache } = require("../config/redis");
const idGenerator = require("./idGenerator.service");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.meta.toObject === "function") return user.meta.toObject();
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

class AuthService {
  async register(data) {
    const { name, email, phone, password, role = "customer", referralCode } = data;

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("Email already registered", 409);

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: ["vendor", "customer", "user"].includes(role) ? (role === "user" ? "customer" : role) : "customer",
      referredBy: referrer?._id,
      referralCode: await idGenerator.generateReferralId(),
    });

    if (referrer) {
      await Referral.create({
        referrer: referrer._id,
        referred: user._id,
        code: await idGenerator.generateReferralId(),
      });
    }

    // Email verification
    const token = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendTemplateEmail(user.email, "emailVerification", user.name, token);
    } catch (_) {
      // Don't fail registration if email fails
    }

    return { user, message: "Registration successful. Please verify your email." };
  }

  async login(email, password, ipAddress) {
    const user = await User.findOne({ email }).select("+password +refreshToken");
    if (!user) throw new AppError("Invalid email or password", 401);

    if (user.isLocked) throw new AppError("Account locked. Try again after 2 hours.", 423);
    if (!user.isActive) throw new AppError("Account deactivated", 401);
    if (user.isSuspended) throw new AppError("Account suspended: " + user.suspendedReason, 403);
    if (user.isBlocked) throw new AppError("Account blocked: " + user.blockedReason, 403);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      throw new AppError("Invalid email or password", 401);
    }

    // Reset login attempts
    if (user.loginAttempts > 0) {
      await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token (hashed)
    user.refreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    user.lastLogin = new Date();
    user.lastLoginIp = ipAddress;
    await user.save({ validateBeforeSave: false });

    const forcePasswordChange = Boolean(getUserMeta(user).adminProfile?.security?.forcePasswordChange);

    return { user, accessToken, refreshToken, forcePasswordChange };
  }

  async logout(userId) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
    await deleteCache(`user:${userId}`);
  }

  async refreshTokens(refreshToken) {
    const { verifyRefreshToken } = require("../utils/jwt");
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.id).select("+refreshToken");
    if (!user) throw new AppError("Invalid refresh token", 401);

    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    if (user.refreshToken !== hashedToken) throw new AppError("Invalid refresh token", 401);

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    await user.save({ validateBeforeSave: false });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError("No user found with this email", 404);

    const token = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendTemplateEmail(user.email, "resetPassword", user.name, token);
    } catch (_) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw new AppError("Error sending email. Please try again.", 500);
    }

    return { message: "Password reset email sent" };
  }

  async resetPassword(token, password) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired reset token", 400);

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.loginAttempts = 0;
    await user.save();

    return { message: "Password reset successful" };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new AppError("Current password is incorrect", 400);

    user.password = newPassword;
    user.refreshToken = undefined; // Invalidate all sessions

    const meta = getUserMeta(user);
    if (meta.adminProfile?.security) {
      meta.adminProfile.security.forcePasswordChange = false;
      user.meta = meta;
    }

    await user.save();

    return { message: "Password changed successfully" };
  }

  async verifyEmail(token) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired verification link", 400);
    if (user.isEmailVerified) return { message: "Email already verified" };

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return { message: "Email verified successfully" };
  }

  async sendOTP(userId, type = "verify") {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const otp = user.generateOTP(type);
    await user.save({ validateBeforeSave: false });

    await sendTemplateEmail(user.email, "otp", user.name, otp);
    return { message: "OTP sent to your email" };
  }

  async verifyOTP(userId, otp, type) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (!user.otp?.code) throw new AppError("No OTP requested", 400);
    if (user.otp.expire < Date.now()) throw new AppError("OTP expired", 400);
    if (user.otp.code !== otp) throw new AppError("Invalid OTP", 400);
    if (type && user.otp.type !== type) throw new AppError("Invalid OTP type", 400);

    user.otp = undefined;
    if (type === "verify") user.isPhoneVerified = true;
    await user.save({ validateBeforeSave: false });

    return { message: "OTP verified successfully" };
  }
}

module.exports = new AuthService();
