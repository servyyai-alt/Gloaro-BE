const VendorApplication = require("../models/VendorApplication");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const idGenerator = require("./idGenerator.service");
const AuditLog = require("../models/AuditLog");
const notificationService = require("./notification.service");
const { AppError } = require("../middleware/errorHandler");
const mongoose = require("mongoose");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const fileFromUpload = (file, field) => {
  if (!file) return undefined;
  return {
    url: file.path,
    publicId: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    field,
    resourceType: file.resourceType,
  };
};

class VendorApplicationService {
  async getMyApplication(userId) {
    const app = await VendorApplication.findOne({ user: userId })
      .populate("step2.details.businessCategory", "name")
      .populate("regionId", "name code")
      .populate("stateId", "name code")
      .populate("districtId", "name code")
      .populate("chapterId", "name code")
      .populate("reviewedBy", "name");
    return app;
  }

  async saveDraft(userId, payload, files = {}) {
    let app = await VendorApplication.findOne({ user: userId });
    
    if (app && app.status !== "draft") {
      throw new AppError("Cannot edit a submitted or reviewed application.", 400);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const meta = getUserMeta(user);
    const org = meta.adminProfile?.organization || {};

    const documentsMap = {
      profilePhoto: fileFromUpload(files.profilePhoto?.[0], "profilePhoto"),
      registrationCertificate: fileFromUpload(files.registrationCertificate?.[0], "registrationCertificate"),
      gstCertificate: fileFromUpload(files.gstCertificate?.[0], "gstCertificate"),
      businessLogo: fileFromUpload(files.businessLogo?.[0], "businessLogo"),
      ownerIdProof: fileFromUpload(files.ownerIdProof?.[0], "ownerIdProof"),
      shopPhoto: fileFromUpload(files.shopPhoto?.[0], "shopPhoto"),
    };

    if (!app) {
      // First time creating application - resolve hierarchy locations from the approved user's profile
      app = new VendorApplication({
        user: userId,
        status: "draft",
        regionId: org.region || null,
        stateId: org.state || null,
        districtId: org.district || null,
        chapterId: org.chapter || null,
      });
    }

    // Merge Step fields if present in payload
    if (payload.step) app.step = Number(payload.step);

    if (payload.step1) {
      app.step1 = {
        ...app.step1,
        ...payload.step1,
      };
    }

    if (payload.step2) {
      app.step2 = {
        personal: {
          ...(app.step2?.personal || {}),
          ...payload.step2.personal,
          profilePhoto: documentsMap.profilePhoto || app.step2?.personal?.profilePhoto || null,
        },
        address: {
          ...(app.step2?.address || {}),
          ...payload.step2.address,
        },
        details: {
          ...(app.step2?.details || {}),
          ...payload.step2.details,
        },
        digitalPresence: {
          ...(app.step2?.digitalPresence || {}),
          ...payload.step2.digitalPresence,
        },
      };
    }

    if (payload.step3) {
      app.step3 = {
        credentials: {
          ...(app.step3?.credentials || {}),
          ...payload.step3.credentials,
        },
        documents: {
          registrationCertificate: documentsMap.registrationCertificate || app.step3?.documents?.registrationCertificate || null,
          gstCertificate: documentsMap.gstCertificate || app.step3?.documents?.gstCertificate || null,
          businessLogo: documentsMap.businessLogo || app.step3?.documents?.businessLogo || null,
          ownerIdProof: documentsMap.ownerIdProof || app.step3?.documents?.ownerIdProof || null,
          shopPhoto: documentsMap.shopPhoto || app.step3?.documents?.shopPhoto || null,
        },
        references: payload.step3.references || app.step3?.references || [],
        vendorPoliciesAccepted: payload.step3.vendorPoliciesAccepted !== undefined ? payload.step3.vendorPoliciesAccepted : app.step3?.vendorPoliciesAccepted,
      };
    }

    await app.save();

    // Audit Log for Saving Draft
    await AuditLog.create({
      user: userId,
      action: "vendor_application_draft_saved",
      resource: "VendorApplication",
      resourceId: app._id,
      details: {
        step: app.step,
      },
    });

    return app;
  }

  async submitApplication(userId, payload, files = {}) {
    // Save draft data first to ensure all last changes are persisted
    const app = await this.saveDraft(userId, payload, files);

    if (app.status !== "draft") {
      throw new AppError("Application has already been submitted.", 400);
    }

    // Generate unique application number
    if (!app.applicationNumber) {
      app.applicationNumber = await idGenerator.generateGenericModuleId("vendor_management");
    }

    app.status = "submitted";
    
    const initialWorkflow = {
      user: userId,
      role: "applicant",
      action: "submitted",
      remarks: "Vendor application submitted for review",
      timestamp: new Date(),
    };
    app.workflowHistory.push(initialWorkflow);

    await app.save();

    // Notify officials & admins
    const admins = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id");
    const adminIds = admins.map((a) => a._id.toString());

    // Scoping: Find the Chapter Director (executive_director) matching the application's chapterId
    let chapterDirectorIds = [];
    if (app.chapterId) {
      const directors = await User.find({
        role: "executive_director",
        "meta.adminProfile.organization.district": app.districtId ? app.districtId.toString() : null,
      }).select("_id");
      chapterDirectorIds = directors.map((d) => d._id.toString());
    }

    const allRecipients = [...new Set([...adminIds, ...chapterDirectorIds])];

    if (allRecipients.length > 0) {
      await notificationService.sendBulkNotifications({
        recipientIds: allRecipients,
        type: "system",
        title: "New Vendor Application",
        message: `A new vendor application ${app.applicationNumber} has been submitted for chapter review.`,
        link: `/admin/applications/vendor`, // Reused path prefix
      });
    }

    // Audit Log for submission
    await AuditLog.create({
      user: userId,
      action: "vendor_application_submitted",
      resource: "VendorApplication",
      resourceId: app._id,
      details: {
        applicationNumber: app.applicationNumber,
      },
    });

    return app;
  }

  async getApplications(user, query) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { "step2.details.businessName": new RegExp(query.search, "i") },
        { "step2.personal.fullName": new RegExp(query.search, "i") },
        { applicationNumber: new RegExp(query.search, "i") },
      ];
    }
    if (query.regionId) filter.regionId = query.regionId;
    if (query.stateId) filter.stateId = query.stateId;
    if (query.districtId) filter.districtId = query.districtId;
    if (query.chapterId) filter.chapterId = query.chapterId;
    if (query.businessCategory) filter["step2.details.businessCategory"] = query.businessCategory;
    if (query.businessType) filter["step2.details.businessType"] = query.businessType;

    // Jurisdictional matching
    const role = user.role;
    const isGlobal = ["superadmin", "admin"].includes(role);
    if (!isGlobal) {
      const meta = getUserMeta(user);
      const org = meta.adminProfile?.organization || {};

      if (role === "executive_director") {
        filter.chapterId = org.chapter || new mongoose.Types.ObjectId();
      } else if (role === "region_director") {
        filter.regionId = org.region || new mongoose.Types.ObjectId();
      } else if (role === "state_director") {
        filter.stateId = org.state || new mongoose.Types.ObjectId();
      } else if (role === "district_director") {
        filter.districtId = org.district || new mongoose.Types.ObjectId();
      } else if (["launch_director", "direct_consultant", "chapter_president", "vice_president", "secretary"].includes(role)) {
        filter.chapterId = org.chapter || new mongoose.Types.ObjectId();
      } else {
        // regular members can only view their own
        filter.user = user._id;
      }
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      VendorApplication.find(filter)
        .populate("user", "name email")
        .populate("step2.details.businessCategory", "name")
        .populate("regionId", "name code")
        .populate("stateId", "name code")
        .populate("districtId", "name code")
        .populate("chapterId", "name code")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      VendorApplication.countDocuments(filter),
    ]);

    return { applications, total, page, limit };
  }

  async getApplicationById(id, user) {
    const app = await VendorApplication.findById(id)
      .populate("user", "name email")
      .populate("step2.details.businessCategory", "name")
      .populate("regionId", "name code")
      .populate("stateId", "name code")
      .populate("districtId", "name code")
      .populate("chapterId", "name code")
      .populate("reviewedBy", "name");

    if (!app) throw new AppError("Vendor application not found", 404);

    // Validate boundaries
    const role = user.role;
    const isGlobal = ["superadmin", "admin"].includes(role);
    if (!isGlobal && app.user?.toString() !== user._id.toString()) {
      const meta = getUserMeta(user);
      const org = meta.adminProfile?.organization || {};

      if (role === "executive_director" && app.chapterId?.toString() !== org.chapter?.toString()) {
        throw new AppError("Access denied to this chapter's application", 403);
      }
    }

    return app;
  }

  async updateStatus(id, reviewerUser, status, adminNotes) {
    const app = await VendorApplication.findById(id);
    if (!app) throw new AppError("Vendor application not found", 404);

    // Single approval rule: if already approved/rejected, block subsequent modifications
    if (["approved", "rejected"].includes(app.status)) {
      throw new AppError(`This application is already finalized as ${app.status} and cannot be modified.`, 400);
    }

    // Role check
    const role = reviewerUser.role;
    const isAuthorized = ["superadmin", "admin", "executive_director"].includes(role);
    if (!isAuthorized) {
      throw new AppError("Only the Chapter Director or Admin can approve/reject vendor applications.", 403);
    }

    // Boundaries checking for Chapter Director
    if (role === "executive_director") {
      const meta = getUserMeta(reviewerUser);
      const org = meta.adminProfile?.organization || {};
      if (app.chapterId?.toString() !== org.chapter?.toString()) {
        throw new AppError("You can only review applications belonging to your assigned Chapter.", 403);
      }
    }

    const previousStatus = app.status;
    app.status = status;
    app.adminNotes = adminNotes;
    app.reviewedBy = reviewerUser._id;
    app.reviewedByRole = role;
    app.reviewedAt = new Date();

    app.workflowHistory.push({
      user: reviewerUser._id,
      role,
      action: status,
      remarks: adminNotes || `Application ${status}`,
      timestamp: new Date(),
    });

    await app.save();

    // Trigger post-approval operations
    if (status === "approved") {
      // 1. Resolve State & District records to build vendor id
      const stateRecord = await EnterpriseRecord.findById(app.stateId);
      const districtRecord = await EnterpriseRecord.findById(app.districtId);
      const generatedVendorId = await idGenerator.generateVendorId({
        state: stateRecord?.code || "XX",
        district: districtRecord?.code || "XXX",
      });

      // 2. Create/Update the active Vendor document
      const slugify = require("slugify");
      let slug = slugify(app.step2.details.businessName, { lower: true, strict: true });
      const existingVendor = await Vendor.findOne({ slug });
      if (existingVendor && existingVendor.user.toString() !== app.user.toString()) {
        slug = `${slug}-${Date.now()}`;
      }

      const vendorData = {
        user: app.user,
        slug,
        vendorId: generatedVendorId,
        businessName: app.step2.details.businessName,
        ownerName: app.step2.personal.fullName,
        email: app.step2.personal.email || app.step2.digitalPresence.businessEmail,
        phone: app.step2.personal.mobileNumber,
        businessCategory: app.step2.details.businessCategory,
        address: {
          street: `${app.step2.address.line1} ${app.step2.address.line2 || ""}`.trim(),
          city: app.step2.address.city,
          state: app.step2.address.state,
          pincode: app.step2.address.pincode,
        },
        website: app.step2.digitalPresence.website,
        socialLinks: {
          instagram: app.step2.digitalPresence.instagram,
        },
        gstNumber: app.step3.credentials.gstNumber,
        panNumber: app.step3.credentials.panNumber,
        status: "approved",
        isActive: true,
        regionId: app.regionId,
        stateId: app.stateId,
        districtId: app.districtId,
        chapterId: app.chapterId,
        approvedBy: reviewerUser._id,
        approvedAt: new Date(),
        documents: [
          app.step3.documents.registrationCertificate ? {
            name: "Registration Certificate",
            url: app.step3.documents.registrationCertificate.url,
            publicId: app.step3.documents.registrationCertificate.publicId,
            type: "license",
          } : null,
          app.step3.documents.gstCertificate ? {
            name: "GST Certificate",
            url: app.step3.documents.gstCertificate.url,
            publicId: app.step3.documents.gstCertificate.publicId,
            type: "gst",
          } : null,
        ].filter(Boolean),
      };

      await Vendor.findOneAndUpdate(
        { user: app.user },
        vendorData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Notify member (applicant)
    await notificationService.sendNotification({
      recipientId: app.user,
      type: status === "approved" ? "system" : "system",
      title: status === "approved" ? "Vendor Application Approved" : "Vendor Application Rejected",
      message: status === "approved"
        ? "Congratulations! Your vendor application has been approved. Your profile is now active in the directory."
        : `Your vendor application has been rejected. Notes: ${adminNotes || "Requirements not met"}`,
      link: "/member/vendor-application-status",
    });

    // Audit Logging
    await AuditLog.create({
      user: reviewerUser._id,
      action: `vendor_application_${status}`,
      resource: "VendorApplication",
      resourceId: app._id,
      details: {
        applicationNumber: app.applicationNumber,
        reviewerRole: role,
        remarks: adminNotes || null,
      },
    });

    return app;
  }
}

module.exports = new VendorApplicationService();
