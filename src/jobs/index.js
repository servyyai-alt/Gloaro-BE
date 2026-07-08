const cron = require("node-cron");
const logger = require("../utils/logger");
const { Membership } = require("../models/Membership");
const Vendor = require("../models/Vendor");
const Notification = require("../models/Notification");
const { sendTemplateEmail } = require("../utils/email");
const moment = require("moment");

const startJobs = () => {
  logger.info("🔄 Starting background jobs...");

  // =============================================
  // JOB 1: Check expiring memberships (daily at 8am)
  // =============================================
  cron.schedule("0 8 * * *", async () => {
    try {
      logger.info("Running: Membership expiry check");

      const warningDays = [7, 3, 1];

      for (const days of warningDays) {
        const targetDate = moment().add(days, "days").toDate();
        const startOfDay = moment(targetDate).startOf("day").toDate();
        const endOfDay = moment(targetDate).endOf("day").toDate();

        const expiring = await Membership.find({
          status: "active",
          endDate: { $gte: startOfDay, $lte: endOfDay },
          expiryNotificationSent: false,
        }).populate("user", "name email preferences").populate("vendor", "businessName");

        for (const membership of expiring) {
          const notificationService = require("../services/notification.service");
          await notificationService.sendNotification({
            recipientId: membership.user._id,
            type: "membership_expiry",
            title: "Membership Expiring Soon",
            message: `Your ${membership.plan} membership expires in ${days} day${days > 1 ? "s" : ""}. Renew now to avoid interruption.`,
            link: "/membership/renew",
            emailTemplate: membership.user.preferences?.emailNotifications ? "membershipExpiry" : null,
            emailParams: [membership.user.name, membership.plan, days]
          });

          if (days === 1) {
            await Membership.findByIdAndUpdate(membership._id, { expiryNotificationSent: true });
          }
        }

        logger.info(`Membership expiry check (${days} days): Notified ${expiring.length} vendors`);
      }
    } catch (err) {
      logger.error("Membership expiry job error:", err.message);
    }
  });

  // =============================================
  // JOB 2: Deactivate expired memberships (daily at midnight)
  // =============================================
  cron.schedule("0 0 * * *", async () => {
    try {
      logger.info("Running: Deactivate expired memberships");

      const expired = await Membership.find({
        status: "active",
        endDate: { $lt: new Date() },
      });

      for (const membership of expired) {
        membership.status = "expired";
        membership.isActive = false;
        await membership.save();

        // Downgrade vendor to free plan
        await Vendor.findByIdAndUpdate(membership.vendor, {
          "membership.plan": "free",
          "membership.isActive": false,
        });

        // Notification
        await Notification.create({
          recipient: membership.user,
          type: "membership_expiry",
          title: "Membership Expired",
          message: `Your ${membership.plan} membership has expired. Upgrade to continue enjoying premium features.`,
          link: "/membership",
          priority: "high",
        });
      }

      logger.info(`Deactivated ${expired.length} expired memberships`);
    } catch (err) {
      logger.error("Membership deactivation job error:", err.message);
    }
  });

  // =============================================
  // JOB 3: Remove expired featured vendor flags (hourly)
  // =============================================
  cron.schedule("0 * * * *", async () => {
    try {
      const result = await Vendor.updateMany(
        { isFeatured: true, featuredUntil: { $lt: new Date() } },
        { isFeatured: false }
      );
      if (result.modifiedCount > 0) {
        logger.info(`Removed featured flag from ${result.modifiedCount} vendors`);
      }
    } catch (err) {
      logger.error("Featured vendor cleanup job error:", err.message);
    }
  });

  // =============================================
  // JOB 4: Clean up old notifications (weekly on Sunday)
  // =============================================
  cron.schedule("0 0 * * 0", async () => {
    try {
      const thirtyDaysAgo = moment().subtract(30, "days").toDate();
      const result = await Notification.deleteMany({
        isRead: true,
        createdAt: { $lt: thirtyDaysAgo },
      });
      logger.info(`Cleaned up ${result.deletedCount} old notifications`);
    } catch (err) {
      logger.error("Notification cleanup job error:", err.message);
    }
  });

  // =============================================
  // JOB 5: Daily stats compilation (daily at 1am)
  // =============================================
  cron.schedule("0 1 * * *", async () => {
    try {
      logger.info("Running: Daily stats compilation");
      // Could save to a DailyStats collection for dashboards
      // For now just log
      const [totalVendors, activeMembers, pendingApprovals] = await Promise.all([
        Vendor.countDocuments({ status: "approved" }),
        Membership.countDocuments({ status: "active" }),
        Vendor.countDocuments({ status: "pending" }),
      ]);
      logger.info(`Daily Stats - Vendors: ${totalVendors}, Active Members: ${activeMembers}, Pending: ${pendingApprovals}`);
    } catch (err) {
      logger.error("Daily stats job error:", err.message);
    }
  });

  logger.info("✅ Background jobs started");
};

module.exports = { startJobs };
