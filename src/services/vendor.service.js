const Vendor = require("../models/Vendor");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { AppError } = require("../middleware/errorHandler");
const { getPagination } = require("../utils/response");
const { deleteFromCloudinary } = require("../config/cloudinary");
const { sendTemplateEmail } = require("../utils/email");
const { setCache, getCache, deleteCache } = require("../config/redis");

class VendorService {
  async createVendor(userId, data, files) {
    const existing = await Vendor.findOne({ user: userId });
    if (existing) throw new AppError("Vendor profile already exists", 409);

    const user = await User.findById(userId);

    const vendorData = { ...data, user: userId, email: data.email || user.email };

    if (files?.logo) vendorData.logo = { url: files.logo[0].path, publicId: files.logo[0].filename };
    if (files?.coverImage) vendorData.coverImage = { url: files.coverImage[0].path, publicId: files.coverImage[0].filename };

    const vendor = await Vendor.create(vendorData);

    // Update user role to vendor
    await User.findByIdAndUpdate(userId, { role: "vendor" });

    // Notify admins
    const admins = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id");
    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((a) => ({
          recipient: a._id,
          type: "vendor_approved",
          title: "New Vendor Registration",
          message: `${vendor.businessName} has registered and is pending approval.`,
          link: `/admin/vendors/${vendor._id}`,
        }))
      );
    }

    return vendor;
  }

  async getVendors(query) {
    const { page, limit, skip } = getPagination(query);
    const {
      status, category, city, state, featured, verified,
      plan, search, sortBy = "-createdAt",
    } = query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.businessCategory = category;
    if (city) filter["address.city"] = new RegExp(city, "i");
    if (state) filter["address.state"] = new RegExp(state, "i");
    if (featured === "true") filter.isFeatured = true;
    if (verified === "true") filter.isVerified = true;
    if (plan) filter["membership.plan"] = plan;
    if (search) filter.$text = { $search: search };

    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .populate("businessCategory", "name slug")
        .populate("user", "name email")
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    return { vendors, total, page, limit };
  }

  async getVendorById(id) {
    const cacheKey = `vendor:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const vendor = await Vendor.findById(id)
      .populate("businessCategory", "name slug")
      .populate("user", "name email phone")
      .populate("approvedBy", "name");

    if (!vendor) throw new AppError("Vendor not found", 404);

    // Increment views
    await Vendor.findByIdAndUpdate(id, { $inc: { "stats.totalViews": 1 } });

    await setCache(cacheKey, vendor, 300);
    return vendor;
  }

  async getVendorBySlug(slug) {
    const vendor = await Vendor.findOne({ slug })
      .populate("businessCategory", "name slug")
      .populate("user", "name email");
    if (!vendor) throw new AppError("Vendor not found", 404);
    await Vendor.findByIdAndUpdate(vendor._id, { $inc: { "stats.totalViews": 1 } });
    return vendor;
  }

  async updateVendor(vendorId, userId, role, data, files) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new AppError("Vendor not found", 404);

    const isOwner = vendor.user.toString() === userId.toString();
    if (!isOwner && !["admin", "superadmin"].includes(role)) {
      throw new AppError("Not authorized to update this vendor", 403);
    }

    if (files?.logo) {
      if (vendor.logo?.publicId) await deleteFromCloudinary(vendor.logo.publicId).catch(() => {});
      data.logo = { url: files.logo[0].path, publicId: files.logo[0].filename };
    }
    if (files?.coverImage) {
      if (vendor.coverImage?.publicId) await deleteFromCloudinary(vendor.coverImage.publicId).catch(() => {});
      data.coverImage = { url: files.coverImage[0].path, publicId: files.coverImage[0].filename };
    }

    // Admins cannot change status directly via this endpoint
    if (!["admin", "superadmin"].includes(role)) {
      delete data.status;
      delete data.isFeatured;
      delete data.isVerified;
    }

    const updated = await Vendor.findByIdAndUpdate(vendorId, data, { new: true, runValidators: true });
    await deleteCache(`vendor:${vendorId}`);
    return updated;
  }

  async approveVendor(vendorId, adminId, action, reason) {
    const vendor = await Vendor.findById(vendorId).populate("user", "email name");
    if (!vendor) throw new AppError("Vendor not found", 404);

    vendor.status = action === "approve" ? "approved" : "rejected";
    vendor.approvedBy = adminId;
    vendor.approvedAt = action === "approve" ? new Date() : undefined;
    vendor.rejectedReason = action === "reject" ? reason : undefined;
    await vendor.save();

    // Notify vendor user
    await Notification.create({
      recipient: vendor.user._id,
      type: action === "approve" ? "vendor_approved" : "vendor_rejected",
      title: action === "approve" ? "Vendor Account Approved" : "Vendor Application Rejected",
      message: action === "approve"
        ? "Congratulations! Your vendor account has been approved."
        : `Your vendor application was rejected. Reason: ${reason}`,
    });

    if (action === "approve") {
      await sendTemplateEmail(vendor.user.email, "vendorApproved", vendor.businessName);
    }

    await deleteCache(`vendor:${vendorId}`);
    return vendor;
  }

  async featureVendor(vendorId, isFeatured, untilDate) {
    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { isFeatured, featuredUntil: untilDate },
      { new: true }
    );
    if (!vendor) throw new AppError("Vendor not found", 404);
    await deleteCache(`vendor:${vendorId}`);
    return vendor;
  }

  async deleteVendor(vendorId, userId, role) {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new AppError("Vendor not found", 404);

    if (vendor.user.toString() !== userId.toString() && !["admin", "superadmin"].includes(role)) {
      throw new AppError("Not authorized", 403);
    }

    // Delete cloudinary assets
    if (vendor.logo?.publicId) await deleteFromCloudinary(vendor.logo.publicId).catch(() => {});
    if (vendor.coverImage?.publicId) await deleteFromCloudinary(vendor.coverImage.publicId).catch(() => {});

    await vendor.deleteOne();
    await deleteCache(`vendor:${vendorId}`);
  }

  async getNearbyVendors(lat, lng, radius = 10, limit = 20) {
    const vendors = await Vendor.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: radius * 1000, // km to meters
        },
      },
      status: "approved",
      isActive: true,
    })
      .limit(parseInt(limit))
      .populate("businessCategory", "name");

    return vendors;
  }

  async getMyVendorProfile(userId) {
    const vendor = await Vendor.findOne({ user: userId })
      .populate("businessCategory", "name slug")
      .populate("user", "name email phone");
    if (!vendor) throw new AppError("Vendor profile not found", 404);
    return vendor;
  }
}

module.exports = new VendorService();
