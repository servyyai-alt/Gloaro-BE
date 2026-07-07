const Vendor = require("../models/Vendor");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Lead = require("../models/Lead");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const { Membership } = require("../models/Membership");
const { ADMIN_ROLE_VALUES, isAdminRole } = require("../constants/adminRoles");
const { AppError } = require("../middleware/errorHandler");
const { getPagination } = require("../utils/response");
const { deleteFromCloudinary } = require("../config/cloudinary");
const { sendTemplateEmail } = require("../utils/email");
const { setCache, getCache, deleteCache } = require("../config/redis");
const idGenerator = require("./idGenerator.service");

class VendorService {
  async createVendor(userId, data, files) {
    const existing = await Vendor.findOne({ user: userId });
    if (existing) throw new AppError("Vendor profile already exists", 409);

    const user = await User.findById(userId);

    const stateCode = String(data.stateCode || data.address?.stateCode || data.address?.state || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 2);
    const areaCode = String(data.areaCode || data.address?.cityCode || data.address?.city || data.businessName || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);

    const vendorData = {
      ...data,
      user: userId,
      email: data.email || user.email,
      vendorId: await idGenerator.generateVendorId({ stateCode, areaCode }),
    };

    if (files?.logo) vendorData.logo = { url: files.logo[0].path, publicId: files.logo[0].filename };
    if (files?.coverImage) vendorData.coverImage = { url: files.coverImage[0].path, publicId: files.coverImage[0].filename };

    const vendor = await Vendor.create(vendorData);

    // Update user role to vendor
    await User.findByIdAndUpdate(userId, { role: "vendor" });

    // Notify admins
    const admins = await User.find({ role: { $in: ADMIN_ROLE_VALUES } }).select("_id");
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
    if (!isOwner && !isAdminRole(role)) {
      throw new AppError("Not authorized to update this vendor", 403);
    }

    delete data.vendorId;

    if (files?.logo) {
      if (vendor.logo?.publicId) await deleteFromCloudinary(vendor.logo.publicId).catch(() => {});
      data.logo = { url: files.logo[0].path, publicId: files.logo[0].filename };
    }
    if (files?.coverImage) {
      if (vendor.coverImage?.publicId) await deleteFromCloudinary(vendor.coverImage.publicId).catch(() => {});
      data.coverImage = { url: files.coverImage[0].path, publicId: files.coverImage[0].filename };
    }

    // Admins cannot change status directly via this endpoint
    if (!isAdminRole(role)) {
      delete data.status;
      delete data.isFeatured;
      delete data.isVerified;
    }

    const updated = await Vendor.findByIdAndUpdate(vendorId, data, { new: true, runValidators: true });
    await deleteCache(`vendor:${vendorId}`);
    return updated;
  }

  async approveVendor(vendorId, adminId, action, reason) {
    const vendor = await Vendor.findById(vendorId).populate("user");
    if (!vendor) throw new AppError("Vendor not found", 404);

    vendor.status = action === "approve" ? "approved" : "rejected";
    vendor.approvedBy = adminId;
    vendor.approvedAt = action === "approve" ? new Date() : undefined;
    vendor.rejectedReason = action === "reject" ? reason : undefined;
    await vendor.save();

    if (action === "approve" && vendor.user) {
      vendor.user.role = "vendor";
      await vendor.user.save({ validateBeforeSave: false });
    }

    // Notify vendor user
    const notificationService = require("./notification.service");
    await notificationService.sendNotification({
      recipientId: vendor.user._id,
      type: action === "approve" ? "vendor_approved" : "vendor_rejected",
      title: action === "approve" ? "Vendor Account Approved" : "Vendor Application Rejected",
      message: action === "approve"
        ? "Congratulations! Your vendor account has been approved."
        : `Your vendor application was rejected. Reason: ${reason}`,
      link: "/vendor/dashboard",
      emailTemplate: action === "approve" ? "vendorApproved" : null,
      emailParams: [vendor.businessName]
    });

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

    if (vendor.user.toString() !== userId.toString() && !isAdminRole(role)) {
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

  async getVendorDashboard(userId) {
    const vendor = await Vendor.findOne({ user: userId }).populate("businessCategory", "name slug");
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      productsCount,
      servicesCount,
      pendingLeads,
      unreadNotifications,
      activeMembership,
      recentLeads,
      recentPayments,
      reviewStats,
      revenue,
    ] = await Promise.all([
      Product.countDocuments({ vendor: vendor._id, isActive: true }),
      Service.countDocuments({ vendor: vendor._id, isActive: true }),
      Lead.countDocuments({ vendor: vendor._id, status: { $in: ["new", "contacted", "qualified"] } }),
      Notification.countDocuments({ recipient: userId, isRead: false }),
      Membership.findOne({ vendor: vendor._id, status: "active" }).sort("-createdAt"),
      Lead.find({ vendor: vendor._id }).sort("-createdAt").limit(5).select("name phone subject status priority createdAt"),
      Payment.find({ vendor: vendor._id }).sort("-createdAt").limit(5).select("amount currency gateway status type paidAt createdAt"),
      Review.aggregate([
        { $match: { vendor: vendor._id, status: "approved" } },
        { $group: { _id: "$vendor", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { vendor: vendor._id, status: "completed", createdAt: { $gte: startOfMonth } } },
        { $group: { _id: "$vendor", total: { $sum: "$amount" } } },
      ]),
    ]);

    return {
      vendor,
      stats: {
        productsCount,
        servicesCount,
        pendingLeads,
        unreadNotifications,
        totalViews: vendor.stats.totalViews,
        totalLeads: vendor.stats.totalLeads,
        avgRating: reviewStats[0] ? Math.round(reviewStats[0].avgRating * 10) / 10 : vendor.stats.avgRating,
        totalReviews: reviewStats[0]?.totalReviews || vendor.stats.totalReviews,
        monthlyRevenue: revenue[0]?.total || 0,
      },
      membership: activeMembership || {
        plan: vendor.membership.plan,
        isActive: vendor.membership.isActive,
        startDate: vendor.membership.startDate,
        endDate: vendor.membership.endDate,
      },
      recentLeads,
      recentPayments,
    };
  }

  async getMyProducts(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const filter = { vendor: vendor._id };
    if (query.status) filter.status = query.status;
    if (query.search) filter.$text = { $search: query.search };

    const [products, total] = await Promise.all([
      Product.find(filter).populate("category", "name slug").sort(query.sortBy || "-createdAt").skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    return { products, total, page, limit };
  }

  async getMyServices(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const filter = { vendor: vendor._id };
    if (query.status) filter.status = query.status;
    if (query.search) filter.$text = { $search: query.search };

    const [services, total] = await Promise.all([
      Service.find(filter).populate("category", "name slug").sort(query.sortBy || "-createdAt").skip(skip).limit(limit),
      Service.countDocuments(filter),
    ]);

    return { services, total, page, limit };
  }

  async getMyReviews(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const filter = { vendor: vendor._id };
    if (query.status) filter.status = query.status;
    if (query.rating) filter.rating = Number(query.rating);

    const [reviews, total] = await Promise.all([
      Review.find(filter).populate("user", "name email avatar").sort(query.sortBy || "-createdAt").skip(skip).limit(limit),
      Review.countDocuments(filter),
    ]);

    return { reviews, total, page, limit };
  }

  async getMyPayments(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const filter = { vendor: vendor._id };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.gateway) filter.gateway = query.gateway;

    const [payments, total] = await Promise.all([
      Payment.find(filter).sort(query.sortBy || "-createdAt").skip(skip).limit(limit),
      Payment.countDocuments(filter),
    ]);

    return { payments, total, page, limit };
  }

  async getMySubscriptions(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const filter = { vendor: vendor._id };
    if (query.status) filter.status = query.status;
    if (query.plan) filter.plan = query.plan;

    const [memberships, total] = await Promise.all([
      Membership.find(filter).populate("payment").sort("-createdAt").skip(skip).limit(limit),
      Membership.countDocuments(filter),
    ]);

    return { memberships, total, page, limit };
  }
}

module.exports = new VendorService();
