const MembershipApplication = require("../models/MembershipApplication");
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { cloudinary } = require("../config/cloudinary");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const { sendTemplateEmail } = require("../utils/email");
const { resolveHierarchy, resolveOfficials } = require("../utils/hierarchyHelper");
const idGenerator = require("../services/idGenerator.service");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.meta.toObject === "function") return user.meta.toObject();
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const parseData = (body) => {
  if (!body.data) return body;
  if (typeof body.data === "object") return body.data;
  return JSON.parse(body.data);
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

exports.createApplication = asyncHandler(async (req, res) => {
  const payload = parseData(req.body);
  const files = req.files || {};

  const role = req.user.role;
  const isSuperOrAdmin = ["superadmin", "admin"].includes(role);

  let targetChapterId = payload.chapterId;
  let targetDistrictId = payload.districtId;
  let targetStateId = payload.stateId;
  let targetRegionId = payload.regionId;

  if (!isSuperOrAdmin) {
    if (role !== "vice_president") {
      throw new AppError("Only the Chapter Vice President can register new members.", 403);
    }

    const meta = getUserMeta(req.user);
    const profile = meta.adminProfile || {};
    const org = profile.organization || {};

    if (!org.chapter) {
      throw new AppError("Vice President profile must have an assigned Chapter to register members.", 400);
    }

    targetChapterId = org.chapter;
    targetDistrictId = org.district;
    targetStateId = org.state;
    targetRegionId = org.region;
  }

  // 1. Resolve Hierarchy and validate
  const hierarchy = await resolveHierarchy({
    regionId: targetRegionId,
    stateId: targetStateId,
    districtId: targetDistrictId,
    chapterId: targetChapterId,
  });

  // 2. Resolve Officials
  const officials = await resolveOfficials(hierarchy);

  const documents = {
    profilePhoto: fileFromUpload(files.profilePhoto?.[0], "profilePhoto"),
    registrationCertificate: fileFromUpload(files.registrationCertificate?.[0], "registrationCertificate"),
    gstCertificate: fileFromUpload(files.gstCertificate?.[0], "gstCertificate"),
    companyProfile: fileFromUpload(files.companyProfile?.[0], "companyProfile"),
    visitingCard: fileFromUpload(files.visitingCard?.[0], "visitingCard"),
  };

  Object.keys(documents).forEach((key) => {
    if (!documents[key]) delete documents[key];
  });

  // Create initial workflow step
  const initialWorkflow = {
    user: req.user?._id || null,
    role: req.user?.role || "applicant",
    action: "submit",
    remarks: "Membership application submitted",
    timestamp: new Date(),
    previousStatus: "draft",
    newStatus: "submitted",
  };

  const application = await MembershipApplication.create({
    ...payload,
    applicationNumber: await idGenerator.generateGenericModuleId("membership_application"),
    documents: { ...(payload.documents || {}), ...documents },
    submittedBy: req.user?._id,
    status: "submitted",

    regionId: hierarchy.region._id,
    stateId: hierarchy.state._id,
    districtId: hierarchy.district._id,
    chapterId: hierarchy.chapter._id,

    // Set officials
    ...officials,

    // Workflow History
    workflowHistory: [initialWorkflow],
  });

  // 3. Notify all officials and admins
  const officialIds = [
    officials.vicePresidentId,
    officials.chapterPresidentId,
    officials.directConsultantId,
    officials.launchDirectorId,
    officials.executiveDirectorId,
    officials.districtDirectorId,
    officials.stateDirectorId,
    officials.regionDirectorId,
  ].filter(Boolean);

  const adminUsers = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id email name");
  const adminIds = adminUsers.map((a) => a._id);

  const recipientIds = [...new Set([...officialIds.map(id => id.toString()), ...adminIds.map(id => id.toString())])];

  if (recipientIds.length > 0) {
    await Notification.insertMany(
      recipientIds.map((recId) => ({
        recipient: recId,
        type: "membership_application_new",
        title: "New Membership Application",
        message: `A new application ${application.applicationNumber} has been submitted for chapter ${hierarchy.chapter.name}.`,
        link: `/admin/applications/membership/${application._id}`,
      }))
    );
  }

  // Socket notification
  const { getSocketIO } = require("../sockets");
  const io = getSocketIO();
  if (io) {
    recipientIds.forEach((recId) => {
      io.to(`user:${recId}`).emit("notification", {
        title: "New Membership Application",
        message: `Application ${application.applicationNumber} has been submitted.`,
        link: `/admin/applications/membership/${application._id}`,
      });
    });
  }

  // Optional: Send email notifications to officials and admins
  const officialUsers = await User.find({ _id: { $in: officialIds } }).select("email name");
  const allNotifyUsers = [...officialUsers, ...adminUsers];

  for (const notifyUser of allNotifyUsers) {
    try {
      await sendTemplateEmail(
        notifyUser.email,
        "membershipApplicationNew",
        notifyUser.name,
        application.applicationNumber,
        hierarchy.chapter.name
      );
    } catch (_) {}
  }

  successResponse(res, 201, "Membership application submitted", application);
});

exports.getApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.$text = { $search: req.query.search };

  // Jurisdictional visibility filtering
  const role = req.user.role;
  const isSuperOrAdmin = ["superadmin", "admin"].includes(role);

  if (!isSuperOrAdmin) {
    const meta = req.user.meta ? (typeof req.user.meta.toObject === "function" ? req.user.meta.toObject() : (req.user.meta instanceof Map ? Object.fromEntries(req.user.meta) : req.user.meta)) : {};
    const profile = meta.adminProfile || {};
    const org = profile.organization || {};

    const resolveLocationIds = async (org) => {
      const filters = {};
      const isValidId = (val) => mongoose.Types.ObjectId.isValid(val);

      if (org.region) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "region", $or: [isValidId(org.region) ? { _id: org.region } : null, { code: org.region }, { name: org.region }].filter(Boolean) });
        if (match) filters.regionId = match._id;
      }
      if (org.state) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "state", $or: [isValidId(org.state) ? { _id: org.state } : null, { code: org.state }, { name: org.state }].filter(Boolean) });
        if (match) filters.stateId = match._id;
      }
      if (org.district) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "district", $or: [isValidId(org.district) ? { _id: org.district } : null, { code: org.district }, { name: org.district }].filter(Boolean) });
        if (match) filters.districtId = match._id;
      }
      if (org.chapter) {
        const match = await EnterpriseRecord.findOne({ module: "organization", type: "chapter", $or: [isValidId(org.chapter) ? { _id: org.chapter } : null, { code: org.chapter }, { name: org.chapter }].filter(Boolean) });
        if (match) filters.chapterId = match._id;
      }
      return filters;
    };

    const locationIds = await resolveLocationIds(org);

    // Apply query filters according to role
    if (role === "region_director") {
      filter.regionId = locationIds.regionId || new mongoose.Types.ObjectId();
    } else if (role === "state_director") {
      filter.stateId = locationIds.stateId || new mongoose.Types.ObjectId();
    } else if (["executive_director", "district_director"].includes(role)) {
      filter.districtId = locationIds.districtId || new mongoose.Types.ObjectId();
    } else if (["launch_director", "direct_consultant", "chapter_president", "vice_president"].includes(role)) {
      filter.chapterId = locationIds.chapterId || new mongoose.Types.ObjectId();
    } else {
      // Any other user should only see their own applications
      filter.submittedBy = req.user._id;
    }
  }

  if (req.query.export === "csv") {
    const applications = await MembershipApplication.find(filter)
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email")
      .populate("regionId", "name code")
      .populate("stateId", "name code")
      .populate("districtId", "name code")
      .populate("chapterId", "name code")
      .sort("-createdAt")
      .lean();
    const { exportToCSV } = require("../utils/csv");
    return exportToCSV(res, applications, [
      { label: "Application Number", key: "applicationNumber" },
      { label: "Applicant Name", key: "submittedBy.name" },
      { label: "Applicant Email", key: "submittedBy.email" },
      { label: "Status", key: "status" },
      { label: "Region", key: "regionId.name" },
      { label: "State", key: "stateId.name" },
      { label: "District", key: "districtId.name" },
      { label: "Chapter", key: "chapterId.name" },
      { label: "Created At", key: "createdAt" }
    ], "membership_applications.csv");
  }

  const [applications, total] = await Promise.all([
    MembershipApplication.find(filter)
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email")
      .populate("regionId", "name code")
      .populate("stateId", "name code")
      .populate("districtId", "name code")
      .populate("chapterId", "name code")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    MembershipApplication.countDocuments(filter),
  ]);

  paginatedResponse(res, applications, page, limit, total, "Membership applications retrieved");
});

exports.trackApplication = asyncHandler(async (req, res) => {
  const { applicationId, mobileNumber } = req.query;
  if (!applicationId || !mobileNumber) {
    return res.status(400).json({ success: false, message: "Application ID and mobile number are required" });
  }

  const application = await MembershipApplication.findOne({
    applicationNumber: String(applicationId).trim(),
    "personal.mobileNumber": String(mobileNumber).trim(),
  }).select("-reviewedBy");

  if (!application) return res.status(404).json({ success: false, message: "Application not found" });
  successResponse(res, 200, "Application tracking details retrieved", application);
});

exports.getApplicationById = asyncHandler(async (req, res) => {
  const application = await MembershipApplication.findById(req.params.id)
    .populate("submittedBy", "name email role")
    .populate("reviewedBy", "name email")
    .populate("regionId", "name code")
    .populate("stateId", "name code")
    .populate("districtId", "name code")
    .populate("chapterId", "name code");
  if (!application) return res.status(404).json({ success: false, message: "Membership application not found" });
  successResponse(res, 200, "Membership application retrieved", application);
});

exports.getApplicationDocumentUrl = asyncHandler(async (req, res) => {
  const { id, field } = req.params;
  const application = await MembershipApplication.findById(id).select("documents");
  if (!application) return res.status(404).json({ success: false, message: "Membership application not found" });

  const file = application.documents?.[field];
  if (!file?.url) return res.status(404).json({ success: false, message: "Document not found" });

  const isPdf = file.mimetype === "application/pdf" || file.originalName?.toLowerCase().endsWith(".pdf") || file.url.toLowerCase().endsWith(".pdf");
  if (!isPdf) return successResponse(res, 200, "Document URL generated", { url: file.url });

  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  const resourceType = file.resourceType || (file.url.includes("/raw/upload/") ? "raw" : "image");
  const publicId = String(file.publicId || "").replace(/\.pdf$/i, "");

  const url = cloudinary.utils.private_download_url(publicId, "pdf", {
    resource_type: resourceType,
    type: "upload",
    attachment: false,
    expires_at: expiresAt,
  });

  successResponse(res, 200, "Document URL generated", { url, expiresAt });
});

exports.updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const application = await MembershipApplication.findById(req.params.id);
  if (!application) return res.status(404).json({ success: false, message: "Membership application not found" });

  const role = req.user.role;
  if (role === "admin" || role === "vice_president") {
    return res.status(403).json({ success: false, message: "You do not have permission to approve or reject membership applications." });
  }

  const isSuperAdmin = role === "superadmin";
  const userOrg = req.user.meta ? (typeof req.user.meta.toObject === "function" ? req.user.meta.toObject() : (req.user.meta instanceof Map ? Object.fromEntries(req.user.meta) : req.user.meta))?.adminProfile?.organization || {} : {};

  const isDirectConsultant = role === "direct_consultant" && (
    application.directConsultantId?.toString() === req.user._id.toString() ||
    userOrg.chapter?.toString() === application.chapterId?.toString()
  );

  const isExecutiveDirector = role === "executive_director" && (
    application.executiveDirectorId?.toString() === req.user._id.toString() ||
    userOrg.chapter?.toString() === application.chapterId?.toString()
  );

  let isAuthorized = isSuperAdmin || isDirectConsultant || isExecutiveDirector;

  // Check PBAC fallback but restrict it for non-admin/non-vp
  if (!isAuthorized) {
    const meta = req.user.meta ? (typeof req.user.meta.toObject === "function" ? req.user.meta.toObject() : (req.user.meta instanceof Map ? Object.fromEntries(req.user.meta) : req.user.meta)) : {};
    const profile = meta.adminProfile || {};
    if (profile.permissions?.members?.canApprove === true) {
      const officials = [
        application.directConsultantId?.toString(),
        application.launchDirectorId?.toString(),
        application.executiveDirectorId?.toString(),
        application.districtDirectorId?.toString(),
        application.stateDirectorId?.toString(),
        application.regionDirectorId?.toString()
      ].filter(Boolean);

      if (officials.includes(req.user._id.toString())) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: "Only the assigned Direct Consultant, Executive Director, or Super Admin can approve or reject this membership application." });
  }

  // If status is forwarded, Direct Consultant cannot approve or reject
  if (application.status === "forwarded" && isDirectConsultant && !isSuperAdmin) {
    return res.status(403).json({ success: false, message: "This application has been forwarded to the Executive Director and cannot be modified by the Direct Consultant." });
  }

  // Validate action
  if (!["approved", "rejected", "forwarded"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid action status. Must be approved, rejected, or forwarded." });
  }

  if (status === "forwarded" && !isDirectConsultant && !isSuperAdmin) {
    return res.status(403).json({ success: false, message: "Only the Direct Consultant or Super Admin can forward the application to the Executive Director." });
  }

  const previousStatus = application.status;
  application.status = status;
  if (adminNotes) application.adminNotes = adminNotes;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();

  let generatedMemberId = "";

  if (status === "approved" && application.submittedBy) {
    const user = await User.findById(application.submittedBy);
    if (user) {
      user.isActive = true;
      user.isEmailVerified = true;
      if (!user.memberId) {
        const stateRecord = await EnterpriseRecord.findById(application.stateId);
        const districtRecord = await EnterpriseRecord.findById(application.districtId);
        const stateCode = stateRecord?.code || String(application.address?.state || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
        const districtCode = districtRecord?.code || String(application.address?.city || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

        if (stateCode && districtCode) {
          user.memberId = await idGenerator.generateMemberId({ stateCode, districtCode });
        }
      }
      generatedMemberId = user.memberId || "";
      await user.save({ validateBeforeSave: false });
    }

    application.approvedBy = req.user._id;
    application.approvedRole = role;
    application.approvedAt = new Date();
  } else if (status === "rejected") {
    application.rejectionReason = adminNotes || "Requirements not met";
  }

  // Record workflow history step
  application.workflowHistory.push({
    user: req.user._id,
    role,
    action: status,
    remarks: adminNotes || `Status updated to ${status}`,
    timestamp: new Date(),
    previousStatus,
    newStatus: status,
  });

  await application.save();

  // Create notifications and trigger socket event
  const recipientIds = [
    application.vicePresidentId?.toString(),
    application.chapterPresidentId?.toString(),
    application.directConsultantId?.toString(),
    application.launchDirectorId?.toString(),
    application.executiveDirectorId?.toString(),
    application.districtDirectorId?.toString(),
    application.stateDirectorId?.toString(),
    application.regionDirectorId?.toString()
  ].filter(Boolean);

  const adminUsers = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id email name");
  const adminIds = adminUsers.map((a) => a._id.toString());
  const allRecipients = [...new Set([...recipientIds, ...adminIds])];

  const notificationTitle = status === "approved" ? "Membership Approved" : (status === "rejected" ? "Membership Rejected" : "Membership Forwarded");
  const notificationMessage = status === "approved"
    ? `Application ${application.applicationNumber} has been approved. Member ID: ${generatedMemberId}`
    : (status === "rejected" ? `Application ${application.applicationNumber} has been rejected. Reason: ${adminNotes || "Requirements not met"}` : `Application ${application.applicationNumber} has been forwarded to Executive Director.`);

  const notificationService = require("../services/notification.service");
  if (allRecipients.length > 0) {
    await notificationService.sendBulkNotifications({
      recipientIds: allRecipients,
      type: status === "approved" ? "membership_approved" : (status === "rejected" ? "membership_rejected" : "system"),
      title: notificationTitle,
      message: notificationMessage,
      link: `/admin/applications/membership/${application._id}`
    });
  }

  // Notify applicant via email & push notification
  if (application.submittedBy) {
    const applicantUser = await User.findById(application.submittedBy).select("email name");
    if (applicantUser) {
      if (status === "approved") {
        await notificationService.sendNotification({
          recipientId: applicantUser._id,
          type: "membership_approved",
          title: "Membership Application Approved",
          message: `Congratulations! Your membership application has been approved. Member ID: ${generatedMemberId}`,
          link: "/membership/dashboard",
          emailTemplate: "membershipApplicationApproved",
          emailParams: [applicantUser.name, application.applicationNumber, generatedMemberId]
        });
      } else if (status === "rejected") {
        await notificationService.sendNotification({
          recipientId: applicantUser._id,
          type: "membership_rejected",
          title: "Membership Application Status Update",
          message: `Your membership application has been rejected. Reason: ${adminNotes || "Requirements not met"}`,
          link: "/membership-application",
          emailTemplate: "membershipApplicationRejected",
          emailParams: [applicantUser.name, application.applicationNumber, adminNotes || "Requirements not met"]
        });
      }
    }
  }

  // Audit Logging for Membership Approval/Rejection/Forwarding
  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({
    user: req.user._id,
    action: `membership_${status}`,
    resource: "MembershipApplication",
    resourceId: application._id,
    details: {
      applicationNumber: application.applicationNumber,
      previousStatus,
      newStatus: status,
      remarks: adminNotes || null,
      ipAddress: req.ip,
      device: req.get("User-Agent")
    },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent")
  });

  successResponse(res, 200, "Membership application updated", application);
});
