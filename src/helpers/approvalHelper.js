const MembershipApplication = require("../models/MembershipApplication");
const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const AuditLog = require("../models/AuditLog");
const idGenerator = require("../services/idGenerator.service");
const { runInTransaction } = require("../utils/dbHelper");
const { MAX_MEMBERS_PER_CHAPTER } = require("../constants");
const { AppError } = require("../middleware/errorHandler");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

/**
 * Maps write conflict / transaction errors to HTTP 409 Conflict.
 */
function handleApprovalError(error) {
  const isWriteConflict = 
    error.code === 112 ||
    (error.message && (
      error.message.includes("Write conflict") ||
      error.message.includes("multi-document transaction") ||
      error.message.includes("TransientTransactionError")
    )) ||
    (error.errorLabels && error.errorLabels.includes("TransientTransactionError"));

  if (isWriteConflict) {
    throw new AppError("Another approval transaction completed first.", 409);
  }
  
  if (error.code === 11000) {
    throw new AppError("This membership application has already been processed.", 409);
  }

  throw error;
}

/**
 * Validate that the chapter has capacity for another active member.
 */
async function validateChapterCapacity(targetChapterId, session = null) {
  if (!targetChapterId) {
    throw new AppError("Chapter selection is required", 400);
  }
  const activeCount = await User.countDocuments({
    role: "customer",
    "meta.adminProfile.organization.chapter": targetChapterId.toString(),
    isActive: true,
    isSuspended: { $ne: true },
    isBlocked: { $ne: true }
  }).session(session);

  if (activeCount >= MAX_MEMBERS_PER_CHAPTER) {
    throw new AppError(
      `Maximum member limit reached. This Chapter already contains ${MAX_MEMBERS_PER_CHAPTER} active members. Cannot approve this membership.`,
      409
    );
  }
}

/**
 * Generate a member ID for legacy users.
 */
async function generateMemberIdForUser(user, session = null) {
  const meta = getUserMeta(user);
  const org = meta.adminProfile?.organization || {};
  const stateRecord = org.state ? await EnterpriseRecord.findById(org.state).session(session) : null;
  const districtRecord = org.district ? await EnterpriseRecord.findById(org.district).session(session) : null;
  const stateCode = stateRecord?.code || "GL";
  const districtCode = districtRecord?.code || "GLO";
  return await idGenerator.generateMemberId({ stateCode, districtCode }, session);
}

/**
 * Generate a member ID for application-based users.
 */
async function generateMemberIdForApplication(application, session = null) {
  const stateRecord = await EnterpriseRecord.findById(application.stateId).session(session);
  const districtRecord = await EnterpriseRecord.findById(application.districtId).session(session);
  const stateCode = stateRecord?.code || String(application.address?.state || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
  const districtCode = districtRecord?.code || String(application.address?.city || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return await idGenerator.generateMemberId({ stateCode, districtCode }, session);
}

/**
 * Core application-based membership approval flow.
 */
async function processMembershipApproval(applicationId, status, adminNotes, reqUser, ip, userAgent) {
  try {
    const application = await MembershipApplication.findById(applicationId);
    if (!application) {
      throw new AppError("Membership application not found", 404);
    }

    // 1. Immutable Decision Check
    if (["approved", "rejected"].includes(application.status)) {
      throw new AppError(
        `This membership application has already been processed. The decision is final and cannot be modified. Current status: ${application.status}`,
        400
      );
    }

    // 2. Validate action status
    if (!["approved", "rejected", "changes_requested", "documents_verified", "under_review"].includes(status)) {
      throw new AppError("Invalid action status. Must be approved, rejected, changes_requested, documents_verified, or under_review.", 400);
    }

    const role = String(reqUser.role || "").trim().toLowerCase().replace(/\s+/g, "_");
    const previousStatus = application.status;
    let generatedMemberId = "";

    const performSave = async (session) => {
      // 3. Capacity Check
      if (status === "approved") {
        let targetChapterId = application.chapterId;
        if (!targetChapterId && application.submittedBy) {
          const applicant = await User.findById(application.submittedBy).session(session);
          if (applicant) {
            const userMeta = getUserMeta(applicant);
            targetChapterId = userMeta.adminProfile?.organization?.chapter || userMeta.memberProfile?.organization?.chapter;
          }
        }
        if (!targetChapterId) {
          throw new AppError("Unable to determine chapter for this membership application.", 400);
        }
        await validateChapterCapacity(targetChapterId, session);
      }

      application.status = status;
      if (adminNotes) application.adminNotes = adminNotes;
      application.reviewedBy = reqUser._id;
      application.reviewedAt = new Date();

      if (status === "approved") {
        application.approvedBy = reqUser._id;
        application.approvedRole = role;
        application.approvedAt = new Date();
      } else if (status === "rejected") {
        application.rejectionReason = adminNotes || "Requirements not met";
      } else if (status === "changes_requested") {
        application.rejectionReason = adminNotes || "Changes requested by reviewer";
      }

      // 4. Update the User record
      if (application.submittedBy) {
        const user = await User.findById(application.submittedBy).session(session);
        if (user) {
          if (status === "approved") {
            user.isActive = true;
            user.isEmailVerified = true;
            user.status = "approved";

            if (!user.memberId) {
              user.memberId = await generateMemberIdForApplication(application, session);
            }
            generatedMemberId = user.memberId || "";

            // Sync user organization metadata
            const userMeta = getUserMeta(user);
            user.meta = {
              ...userMeta,
              adminProfile: {
                ...(userMeta.adminProfile || {}),
                organization: {
                  region: application.regionId?.toString(),
                  state: application.stateId?.toString(),
                  district: application.districtId?.toString(),
                  chapter: application.chapterId?.toString(),
                }
              }
            };
          } else if (status === "rejected") {
            user.isActive = true;
            user.status = "pending_approval";
          } else if (status === "changes_requested") {
            user.isActive = true;
            user.status = "pending_approval";
          }

          await user.save({ session, validateBeforeSave: false });
        }
      }

      // Push history
      application.workflowHistory.push({
        user: reqUser._id,
        role,
        action: status,
        remarks: adminNotes || `Status updated to ${status}`,
        timestamp: new Date(),
        previousStatus,
        newStatus: status,
      });

      await application.save({ session });

      // 5. Audit Log
      await AuditLog.create([{
        user: reqUser._id,
        action: `membership_${status}`,
        resource: "MembershipApplication",
        resourceId: application._id,
        details: {
          applicationNumber: application.applicationNumber,
          previousStatus,
          newStatus: status,
          remarks: adminNotes || null,
          ipAddress: ip,
          device: userAgent
        },
        ipAddress: ip,
        userAgent: userAgent
      }], { session });
    };

    if (status === "approved" && (application.chapterId || application.submittedBy)) {
      await runInTransaction(async (session) => {
        await performSave(session);
      });
    } else {
      await performSave(null);
    }

    // 6. Notifications, Sockets, Emails
    try {
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

      const adminUsers = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id");
      const adminIds = adminUsers.map((a) => a._id.toString());
      const allRecipients = [...new Set([...recipientIds, ...adminIds])];

      const notificationTitle = status === "approved"
        ? "Membership Approved"
        : status === "rejected"
          ? "Membership Rejected"
          : "Membership Application Changes Requested";
      const notificationMessage = status === "approved"
        ? `Application ${application.applicationNumber} has been approved. Member ID: ${generatedMemberId}`
        : status === "rejected"
          ? `Application ${application.applicationNumber} has been rejected. Reason: ${adminNotes || "Requirements not met"}`
          : `Application ${application.applicationNumber} requires changes. Notes: ${adminNotes || "Please review comments"}`;

      const notificationService = require("../services/notification.service");
      
      if (allRecipients.length > 0) {
        await notificationService.sendBulkNotifications({
          recipientIds: allRecipients,
          type: status === "approved" ? "membership_approved" : status === "rejected" ? "membership_rejected" : "membership_changes_requested",
          title: notificationTitle,
          message: notificationMessage,
          link: `/admin/applications/membership/${application._id}`
        });
      }

      const { getSocketIO } = require("../sockets");
      const io = getSocketIO();
      if (io) {
        allRecipients.forEach((recId) => {
          io.to(`user:${recId}`).emit("notification", {
            title: notificationTitle,
            message: notificationMessage,
            link: `/admin/applications/membership/${application._id}`
          });
        });
      }

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
          } else if (status === "changes_requested") {
            await notificationService.sendNotification({
              recipientId: applicantUser._id,
              type: "membership_rejected",
              title: "Membership Application Status Update: Changes Requested",
              message: `Reviewer requested changes to your application. Comments: ${adminNotes || "Please review comments"}`,
              link: "/membership-application",
              emailTemplate: "membershipApplicationRejected",
              emailParams: [applicantUser.name, application.applicationNumber, adminNotes || "Please review comments"]
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to send approval notifications:", err);
    }

    return await MembershipApplication.findById(application._id)
      .populate("submittedBy", "name email role memberId")
      .populate("reviewedBy", "name email");
  } catch (error) {
    handleApprovalError(error);
  }
}

/**
 * Compatibility path to handle legacy users separately.
 */
async function processLegacyMembershipApproval(userId, status, adminNotes, reqUser, ip, userAgent) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("Member not found", 404);
    }

    // 1. Immutable Decision Check
    if (["approved", "rejected"].includes(user.status)) {
      throw new AppError(
        `This membership account has already been processed. The decision is final and cannot be modified. Current status: ${user.status}`,
        400
      );
    }

    // 2. Validate action status
    if (!["approved", "rejected"].includes(status)) {
      throw new AppError("Invalid action status. Must be approved or rejected.", 400);
    }

    const role = String(reqUser.role || "").trim().toLowerCase().replace(/\s+/g, "_");
    const previousStatus = user.status || "pending_approval";
    let generatedMemberId = "";

    const performSave = async (session) => {
      // 3. Chapter Capacity Check
      if (status === "approved") {
        const userMeta = getUserMeta(user);
        const targetChapterId = userMeta.adminProfile?.organization?.chapter || userMeta.memberProfile?.organization?.chapter;
        if (!targetChapterId) {
          throw new AppError("Unable to determine chapter for this legacy member.", 400);
        }
        await validateChapterCapacity(targetChapterId, session);

        // Activate User
        user.isActive = true;
        user.isEmailVerified = true;
        user.status = "approved";

        if (!user.memberId) {
          user.memberId = await generateMemberIdForUser(user, session);
        }
        generatedMemberId = user.memberId || "";
      } else if (status === "rejected") {
        user.isActive = false;
        user.status = "rejected";
      }

      await user.save({ session, validateBeforeSave: false });

      // 4. Audit Log
      await AuditLog.create([{
        user: reqUser._id,
        action: `membership_${status}`,
        resource: "User",
        resourceId: user._id,
        details: {
          previousStatus,
          newStatus: status,
          remarks: adminNotes || null,
          ipAddress: ip,
          device: userAgent
        },
        ipAddress: ip,
        userAgent: userAgent
      }], { session });
    };

    if (status === "approved") {
      await runInTransaction(async (session) => {
        await performSave(session);
      });
    } else {
      await performSave(null);
    }

    // 5. Create Notifications & Trigger Sockets
    try {
      const userMeta = getUserMeta(user);
      const org = userMeta.adminProfile?.organization || {};
      
      const { resolveHierarchy, resolveOfficials } = require("../utils/hierarchyHelper");
      const hierarchy = await resolveHierarchy({
        regionId: org.region,
        stateId: org.state,
        districtId: org.district,
        chapterId: org.chapter,
      });
      const officials = await resolveOfficials(hierarchy);

      const recipientIds = [
        officials.vicePresidentId?.toString(),
        officials.chapterPresidentId?.toString(),
        officials.directConsultantId?.toString(),
        officials.launchDirectorId?.toString(),
        officials.executiveDirectorId?.toString(),
        officials.districtDirectorId?.toString(),
        officials.stateDirectorId?.toString(),
        officials.regionDirectorId?.toString()
      ].filter(Boolean);

      const adminUsers = await User.find({ role: { $in: ["admin", "superadmin"] } }).select("_id");
      const adminIds = adminUsers.map((a) => a._id.toString());
      const allRecipients = [...new Set([...recipientIds, ...adminIds])];

      const notificationTitle = status === "approved" ? "Membership Approved (Legacy)" : "Membership Rejected (Legacy)";
      const notificationMessage = status === "approved"
        ? `Member ${user.name} has been approved. Member ID: ${generatedMemberId}`
        : `Member ${user.name} has been rejected. Reason: ${adminNotes || "Requirements not met"}`;

      const notificationService = require("../services/notification.service");

      if (allRecipients.length > 0) {
        await notificationService.sendBulkNotifications({
          recipientIds: allRecipients,
          type: status === "approved" ? "membership_approved" : "membership_rejected",
          title: notificationTitle,
          message: notificationMessage,
          link: `/admin/members`
        });
      }

      const { getSocketIO } = require("../sockets");
      const io = getSocketIO();
      if (io) {
        allRecipients.forEach((recId) => {
          io.to(`user:${recId}`).emit("notification", {
            title: notificationTitle,
            message: notificationMessage,
            link: `/admin/members`
          });
        });
      }

      // Deliver email to applicant
      if (status === "approved") {
        await notificationService.sendNotification({
          recipientId: user._id,
          type: "membership_approved",
          title: "Membership Approved",
          message: `Congratulations! Your membership has been approved. Member ID: ${generatedMemberId}`,
          link: "/membership/dashboard",
          emailTemplate: "membershipApplicationApproved",
          emailParams: [user.name, "LEGACY_ACCNT", generatedMemberId]
        });
      } else if (status === "rejected") {
        await notificationService.sendNotification({
          recipientId: user._id,
          type: "membership_rejected",
          title: "Membership Status Update",
          message: `Your membership has been rejected. Reason: ${adminNotes || "Requirements not met"}`,
          link: "/membership-application",
          emailTemplate: "membershipApplicationRejected",
          emailParams: [user.name, "LEGACY_ACCNT", adminNotes || "Requirements not met"]
        });
      }
    } catch (err) {
      console.error("Failed to send legacy approval notifications:", err);
    }

    return await User.findById(user._id).select("-password -refreshToken");
  } catch (error) {
    handleApprovalError(error);
  }
}

module.exports = {
  processMembershipApproval,
  processLegacyMembershipApproval
};
