const { ROLES } = require("../constants/roleConfig");
const MembershipApplication = require("../models/MembershipApplication");
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { cloudinary } = require("../config/cloudinary");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const { sendTemplateEmail } = require("../utils/email");
const { resolveHierarchy, resolveOfficials } = require("../utils/hierarchyHelper");
const idGenerator = require("../services/idGenerator.service");
const { runInTransaction } = require("../utils/dbHelper");
const logger = require("../utils/logger");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const parseData = (body) => {
  if (!body.data) return body;
  if (typeof body.data === "object") return body.data;
  return JSON.parse(body.data);
};

const normalizeReviewerRole = (role = "") => {
  const normalized = String(role || "").trim().toLowerCase().replace(/\s+/g, "_");
  return normalized;
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

  if (!req.user) {
    throw new AppError("Authentication required to save or submit a membership application.", 401);
  }

  const role = req.user.role;
  const isSuperOrAdmin = [ROLES.SUPERADMIN, ROLES.ADMIN].includes(role);

  // Check if they already have an application
  let application = await MembershipApplication.findOne({ submittedBy: req.user._id });
  
  if (application && application.status !== "draft") {
    throw new AppError("You have already submitted a membership application.", 400);
  }

  const status = payload.status === "draft" ? "draft" : "submitted";

  let targetChapterId = payload.chapterId;
  let targetDistrictId = payload.districtId;
  let targetStateId = payload.stateId;
  let targetRegionId = payload.regionId;

  if (status === "submitted" && !isSuperOrAdmin) {
    if (role !== ROLES.VICE_PRESIDENT && role !== ROLES.CUSTOMER) {
      throw new AppError("Only Chapter Vice Presidents and Applicants can submit membership applications.", 403);
    }

    if (role === ROLES.VICE_PRESIDENT) {
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
  }

  // Resolve hierarchy only if chapterId is provided (drafts might not have it yet)
  let hierarchy = {};
  let officials = {};
  if (targetChapterId) {
    hierarchy = await resolveHierarchy({
      regionId: targetRegionId,
      stateId: targetStateId,
      districtId: targetDistrictId,
      chapterId: targetChapterId,
    });
    officials = await resolveOfficials(hierarchy);
  }

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

  const updatedDocuments = {
    ...(application?.documents || {}),
    ...(payload.documents || {}),
    ...documents
  };

  if (!application) {
    // Create new application
    const initialWorkflow = {
      user: req.user?._id || null,
      role: req.user?.role || "applicant",
      action: status === "draft" ? "save_draft" : "submit",
      remarks: status === "draft" ? "Membership application draft saved" : "Membership application submitted",
      timestamp: new Date(),
      previousStatus: "none",
      newStatus: status,
    };

    application = await MembershipApplication.create({
      ...payload,
      applicationNumber: await idGenerator.generateGenericModuleId("membership_application"),
      documents: updatedDocuments,
      submittedBy: req.user?._id,
      status,

      regionId: hierarchy.region?._id || undefined,
      stateId: hierarchy.state?._id || undefined,
      districtId: hierarchy.district?._id || undefined,
      chapterId: hierarchy.chapter?._id || undefined,

      ...officials,
      workflowHistory: [initialWorkflow],
    });
  } else {
    // Update existing draft application
    const updateWorkflow = {
      user: req.user?._id || null,
      role: req.user?.role || "applicant",
      action: status === "draft" ? "save_draft" : "submit",
      remarks: status === "draft" ? "Membership application draft updated" : "Membership application submitted",
      timestamp: new Date(),
      previousStatus: application.status,
      newStatus: status,
    };

    // Update fields
    application.set({
      ...payload,
      documents: updatedDocuments,
      status,
      regionId: hierarchy.region?._id || application.regionId,
      stateId: hierarchy.state?._id || application.stateId,
      districtId: hierarchy.district?._id || application.districtId,
      chapterId: hierarchy.chapter?._id || application.chapterId,
      ...officials,
    });

    application.workflowHistory.push(updateWorkflow);
    await application.save();
  }

  // Sync location/chapter to customer user meta so officials can see them in their roster
  if (status === "submitted" && req.user && req.user.role === ROLES.CUSTOMER && hierarchy.chapter) {
    const userMeta = getUserMeta(req.user);
    req.user.meta = {
      ...userMeta,
      adminProfile: {
        ...(userMeta.adminProfile || {}),
        organization: {
          region: hierarchy.region._id.toString(),
          state: hierarchy.state._id.toString(),
          district: hierarchy.district._id.toString(),
          chapter: hierarchy.chapter._id.toString(),
        }
      }
    };
    await req.user.save({ validateBeforeSave: false });
  }

  // 3. Notify officials and admins ONLY if submitting
  if (status === "submitted" && hierarchy.chapter) {
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

    const adminUsers = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.SUPERADMIN] } }).select("_id email name");
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

    // Background email loop
    (async () => {
      try {
        const officialUsers = await User.find({ _id: { $in: officialIds } }).select("email name");
        const allNotifyUsers = [...officialUsers, ...adminUsers];

        for (const notifyUser of allNotifyUsers) {
          try {
            await sendTemplateEmail(
              notifyUser.email,
              "membershipApplicationNew",
              notifyUser.name,
              application.applicationNumber,
              hierarchy.chapter.name,
              `/admin/applications/membership/${application._id}`
            );
          } catch (err) {
            logger.error(`Error sending email to ${notifyUser.email}:`, err);
          }
        }
      } catch (err) {
        logger.error("Error executing background notification task:", err);
      }
    })();
  }

  return successResponse(res, 201, status === "draft" ? "Application draft saved" : "Membership application submitted", application);
});

exports.getApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.$text = { $search: req.query.search };

  // Jurisdictional visibility filtering
  const role = req.user.role;
  const isSuperOrAdmin = [ROLES.SUPERADMIN, ROLES.ADMIN].includes(role);

  if (!isSuperOrAdmin) {
    const meta = getUserMeta(req.user);
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
    if (role === ROLES.REGION_DIRECTOR) {
      filter.regionId = locationIds.regionId || new mongoose.Types.ObjectId();
    } else if (role === ROLES.STATE_DIRECTOR) {
      filter.stateId = locationIds.stateId || new mongoose.Types.ObjectId();
    } else if (role === ROLES.DISTRICT_DIRECTOR) {
      filter.districtId = locationIds.districtId || new mongoose.Types.ObjectId();
    } else if ([ROLES.EXECUTIVE_DIRECTOR, ROLES.LAUNCH_DIRECTOR, ROLES.DIRECT_CONSULTANT, ROLES.CHAPTER_PRESIDENT, ROLES.VICE_PRESIDENT].includes(role)) {
      filter.chapterId = locationIds.chapterId || new mongoose.Types.ObjectId();
    } else {
      // Any other user should only see their own applications
      filter.submittedBy = req.user._id;
    }
  }

  if (req.query.export === "csv") {
    const applications = await MembershipApplication.find(filter)
      .populate({
        path: "submittedBy",
        select: "name email role memberId referredBy",
        populate: {
          path: "referredBy",
          select: "name email referralCode"
        }
      })
      .populate("reviewedBy", "name email")
      .populate("vicePresidentId", "name email")
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
      { label: "Referred By", key: "submittedBy.referredBy.name" },
      { label: "Referral Code Used", key: "referralCode" },
      { label: "Status", key: "status" },
      { label: "Region", key: "regionId.name" },
      { label: "State", key: "stateId.name" },
      { label: "District", key: "districtId.name" },
      { label: "Chapter", key: "chapterId.name" },
      { label: "Created At", key: "createdAt" }
    ], "membership_applications.csv");
  }

  let allApps = await MembershipApplication.find(filter)
    .populate({
      path: "submittedBy",
      select: "name email role memberId referredBy",
      populate: {
        path: "referredBy",
        select: "name email referralCode"
      }
    })
    .populate("reviewedBy", "name email")
    .populate("vicePresidentId", "name email")
    .populate("regionId", "name code")
    .populate("stateId", "name code")
    .populate("districtId", "name code")
    .populate("chapterId", "name code")
    .sort("-createdAt")
    .lean();

  if (!req.query.status || req.query.status === "submitted" || req.query.status === "pending_review") {
    const pendingUsers = await User.find({ role: ROLES.CUSTOMER, status: "pending_approval" })
      .populate("referredBy")
      .lean();
    
    const getNestedVal = (obj, path) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    for (const user of pendingUsers) {
      const hasApp = await MembershipApplication.exists({ submittedBy: user._id });
      if (hasApp) continue;

      let isVisible = false;

      if (isSuperOrAdmin) {
        isVisible = true;
      } else {
        const userMeta = getUserMeta(user);
        const referrerMeta = user.referredBy ? getUserMeta(user.referredBy) : {};

        const userChapter = getNestedVal(userMeta, 'adminProfile.organization.chapter') || 
                            getNestedVal(userMeta, 'memberProfile.organization.chapter') ||
                            getNestedVal(referrerMeta, 'adminProfile.organization.chapter') ||
                            getNestedVal(referrerMeta, 'memberProfile.organization.chapter');

        const userDistrict = getNestedVal(userMeta, 'adminProfile.organization.district') || 
                             getNestedVal(userMeta, 'memberProfile.organization.district') ||
                             getNestedVal(referrerMeta, 'adminProfile.organization.district') ||
                             getNestedVal(referrerMeta, 'memberProfile.organization.district');

        const userState = getNestedVal(userMeta, 'adminProfile.organization.state') || 
                          getNestedVal(userMeta, 'memberProfile.organization.state') ||
                          getNestedVal(referrerMeta, 'adminProfile.organization.state') ||
                          getNestedVal(referrerMeta, 'memberProfile.organization.state');

        const userRegion = getNestedVal(userMeta, 'adminProfile.organization.region') || 
                           getNestedVal(userMeta, 'memberProfile.organization.region') ||
                           getNestedVal(referrerMeta, 'adminProfile.organization.region') ||
                           getNestedVal(referrerMeta, 'memberProfile.organization.region');

        const loggedInMeta = getUserMeta(req.user);
        const loggedInChapter = getNestedVal(loggedInMeta, 'adminProfile.organization.chapter') || getNestedVal(loggedInMeta, 'memberProfile.organization.chapter');
        const loggedInDistrict = getNestedVal(loggedInMeta, 'adminProfile.organization.district') || getNestedVal(loggedInMeta, 'memberProfile.organization.district');
        const loggedInState = getNestedVal(loggedInMeta, 'adminProfile.organization.state') || getNestedVal(loggedInMeta, 'memberProfile.organization.state');
        const loggedInRegion = getNestedVal(loggedInMeta, 'adminProfile.organization.region') || getNestedVal(loggedInMeta, 'memberProfile.organization.region');

        if (role === ROLES.REGION_DIRECTOR) {
          isVisible = userRegion?.toString() === loggedInRegion?.toString();
        } else if (role === ROLES.STATE_DIRECTOR) {
          isVisible = userState?.toString() === loggedInState?.toString();
        } else if (role === ROLES.DISTRICT_DIRECTOR) {
          isVisible = userDistrict?.toString() === loggedInDistrict?.toString();
        } else if ([ROLES.EXECUTIVE_DIRECTOR, ROLES.LAUNCH_DIRECTOR, ROLES.DIRECT_CONSULTANT, ROLES.CHAPTER_PRESIDENT, ROLES.VICE_PRESIDENT].includes(role)) {
          isVisible = userChapter?.toString() === loggedInChapter?.toString();
        }
      }

      if (isVisible) {
        allApps.push({
          _id: user._id,
          applicationNumber: "N/A",
          status: "submitted",
          personal: {
            fullName: user.name,
            emailAddress: user.email,
            mobileNumber: user.phone
          },
          submittedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: ROLES.CUSTOMER,
            referredBy: user.referredBy
          },
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isVirtual: true
        });
      }
    }
  }

  allApps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = allApps.length;
  const paginatedApps = allApps.slice(skip, skip + limit);

  paginatedResponse(res, paginatedApps, page, limit, total, "Membership applications retrieved");
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

exports.getMyApplication = asyncHandler(async (req, res) => {
  const application = await MembershipApplication.findOne({ submittedBy: req.user._id })
    .populate("submittedBy", "name email role")
    .populate("reviewedBy", "name email")
    .populate("regionId", "name code")
    .populate("stateId", "name code")
    .populate("districtId", "name code")
    .populate("chapterId", "name code");

  if (!application) {
    return res.status(200).json({ success: true, data: null, message: "No application found" });
  }
  successResponse(res, 200, "Membership application retrieved", application);
});


exports.getApplicationById = asyncHandler(async (req, res) => {
  let application = await MembershipApplication.findById(req.params.id)
    .populate({
      path: "submittedBy",
      select: "name email role referredBy",
      populate: {
        path: "referredBy",
        select: "name email referralCode"
      }
    })
    .populate("reviewedBy", "name email")
    .populate("regionId", "name code")
    .populate("stateId", "name code")
    .populate("districtId", "name code")
    .populate("chapterId", "name code");
  if (!application) {
    const user = await User.findById(req.params.id).populate("referredBy", "name email referralCode");
    if (user && user.role === ROLES.CUSTOMER) {
      application = {
        _id: user._id,
        applicationNumber: "N/A",
        status: "submitted",
        personal: {
          fullName: user.name,
          emailAddress: user.email,
          mobileNumber: user.phone
        },
        submittedBy: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: ROLES.CUSTOMER,
          referredBy: user.referredBy
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isVirtual: true
      };
      return successResponse(res, 200, "Membership application retrieved", application);
    }
    return res.status(404).json({ success: false, message: "Membership application not found" });
  }
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
  let application = await MembershipApplication.findById(req.params.id);
  if (!application) {
    const user = await User.findById(req.params.id);
    if (user && user.role === ROLES.CUSTOMER) {
      if (status === "approved") {
        user.status = "approved";
        user.isActive = true;
        await user.save();
      } else if (status === "rejected") {
        user.status = "rejected";
        user.isActive = false;
        await user.save();
      } else if (status === "changes_requested") {
        user.status = "pending_approval";
        user.isActive = true;
        await user.save();
      }
      return successResponse(res, 200, "User status updated", user);
    }
    return res.status(404).json({ success: false, message: "Membership application not found" });
  }

  const role = normalizeReviewerRole(req.user.role);
  const isSuperAdmin = role === ROLES.SUPERADMIN;
  const isAdmin = role === ROLES.ADMIN;
  const userOrg = getUserMeta(req.user)?.adminProfile?.organization || {};

  const isVicePresident = role === ROLES.VICE_PRESIDENT && (
    application.vicePresidentId?.toString() === req.user._id.toString() ||
    userOrg.chapter?.toString() === application.chapterId?.toString()
  );

  const isDirectConsultant = role === ROLES.DIRECT_CONSULTANT && (
    application.directConsultantId?.toString() === req.user._id.toString() ||
    userOrg.chapter?.toString() === application.chapterId?.toString()
  );

  const isExecutiveDirector = role === ROLES.EXECUTIVE_DIRECTOR && (
    application.executiveDirectorId?.toString() === req.user._id.toString() ||
    userOrg.chapter?.toString() === application.chapterId?.toString()
  );

  const isChapterReviewer = isVicePresident || isExecutiveDirector;
  let isAuthorized = isSuperAdmin || isAdmin || isChapterReviewer;

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: "Only an authorized chapter reviewer, Admin, or Super Admin can approve or reject this membership application." });
  }

  // If status is forwarded, Direct Consultant cannot approve or reject
  if (application.status === "forwarded" && isDirectConsultant && !isSuperAdmin) {
    return res.status(403).json({ success: false, message: "This application has been forwarded to the Executive Director and cannot be modified by the Direct Consultant." });
  }

  // Validate action
  if (!["approved", "rejected", "forwarded", "changes_requested", "documents_verified", "under_review"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid action status. Must be approved, rejected, forwarded, changes_requested, documents_verified, or under_review." });
  }

  if (status === "forwarded") {
    if (!isDirectConsultant && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Only the Direct Consultant or Super Admin can forward the application to the Executive Director." });
    }

    const previousStatus = application.status;
    application.status = "forwarded";
    if (adminNotes) application.adminNotes = adminNotes;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();

    // Push to workflowHistory
    application.workflowHistory.push({
      user: req.user._id,
      role,
      action: "forwarded",
      remarks: adminNotes || "Forwarded to Executive Director",
      timestamp: new Date(),
      previousStatus,
      newStatus: "forwarded",
    });

    await application.save();

    // Audit Logging
    const AuditLog = require("../models/AuditLog");
    await AuditLog.create({
      user: req.user._id,
      action: "membership_forwarded",
      resource: "MembershipApplication",
      resourceId: application._id,
      details: {
        applicationNumber: application.applicationNumber,
        previousStatus,
        newStatus: "forwarded",
        remarks: adminNotes || null,
        ipAddress: req.ip,
        device: req.get("User-Agent")
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent")
    });

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

    const adminUsers = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.SUPERADMIN] } }).select("_id email name");
    const adminIds = adminUsers.map((a) => a._id.toString());
    const allRecipients = [...new Set([...recipientIds, ...adminIds])];

    const notificationService = require("../services/notification.service");
    if (allRecipients.length > 0) {
      await notificationService.sendBulkNotifications({
        recipientIds: allRecipients,
        type: "system",
        title: "Membership Forwarded",
        message: `Application ${application.applicationNumber} has been forwarded to Executive Director.`,
        link: `/admin/applications/membership/${application._id}`
      });
    }

    // Socket emission
    const { getSocketIO } = require("../sockets");
    const io = getSocketIO();
    if (io) {
      allRecipients.forEach((recId) => {
        io.to(`user:${recId}`).emit("notification", {
          title: "Membership Forwarded",
          message: `Application ${application.applicationNumber} has been forwarded to Executive Director.`,
          link: `/admin/applications/membership/${application._id}`
        });
      });
    }

    return successResponse(res, 200, "Membership application forwarded", application);
  } else {
    // Call unified approval logic helper
    const { processMembershipApproval } = require("../helpers/approvalHelper");
    const updatedApplication = await processMembershipApproval(
      application._id,
      status,
      adminNotes,
      req.user,
      req.ip,
      req.get("User-Agent")
    );
    return successResponse(res, 200, "Membership application updated", updatedApplication);
  }
});
