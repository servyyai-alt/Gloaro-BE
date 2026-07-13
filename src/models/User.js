const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { ADMIN_ROLE_VALUES } = require("../constants/adminRoles");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    phone: { type: String, trim: true },
    password: { type: String, required: [true, "Password is required"], minlength: 8, select: false },

    role: { type: String, enum: [...ADMIN_ROLE_VALUES,"superadmin", "admin", "vendor", "user", "customer", "secretary"], default: "customer" },
    status: { type: String, enum: ["pending_approval", "approved", "rejected"], default: "approved" },

    avatar: { url: String, publicId: String },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    suspendedReason: String,
    blockedReason: String,
    suspendedAt: Date,
    blockedAt: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    otp: { code: String, expire: Date, type: String },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    refreshToken: String,
    lastLogin: Date,
    lastLoginIp: String,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    memberId: { type: String, unique: true, sparse: true, trim: true, uppercase: true, immutable: true },
    officialId: { type: String, unique: true, sparse: true, trim: true, uppercase: true, immutable: true },
    referralCode: { type: String, unique: true, sparse: true, trim: true, uppercase: true, immutable: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pushTokens: [String],
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: "India" },
      pincode: String,
    },
    vendorProfile: {
      status: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
      approvedAt: Date,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    meta: { type: Map, of: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ memberId: 1 }, { unique: true, sparse: true });
userSchema.index({ officialId: 1 }, { unique: true, sparse: true });
userSchema.index({ referralCode: 1 });
userSchema.index({ createdAt: -1 });

// Virtual: isLocked
userSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// Pre-save: hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method: generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto.createHash("sha256").update(token).digest("hex");
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return token;
};

// Method: generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1h
  return token;
};

// Method: generate OTP
userSchema.methods.generateOTP = function (type = "verify") {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: otp,
    expire: Date.now() + parseInt(process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000,
    type,
  };
  return otp;
};

// Method: increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

module.exports = mongoose.model("User", userSchema);
