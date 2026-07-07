const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendTemplateEmail } = require("../utils/email");
const logger = require("../utils/logger");

class NotificationService {
  async sendNotification({ recipientId, type, title, message, link, emailTemplate, emailParams = [] }) {
    try {
      // 1. Save to Database
      const notification = await Notification.create({
        recipient: recipientId,
        type,
        title,
        message,
        link,
        channels: {
          inApp: { sent: true, sentAt: new Date() },
          email: { sent: Boolean(emailTemplate), sentAt: emailTemplate ? new Date() : null },
          push: { sent: false },
          sms: { sent: false }
        }
      });

      // 2. Real-time WebSocket Emitter
      try {
        const { getSocketIO } = require("../sockets");
        const io = getSocketIO();
        if (io) {
          io.to(`user:${recipientId}`).emit("notification", {
            _id: notification._id,
            type,
            title,
            message,
            link,
            createdAt: notification.createdAt
          });
        }
      } catch (socketErr) {
        logger.warn(`Socket notification fail for user ${recipientId}: ${socketErr.message}`);
      }

      // 3. Email dispatch
      if (emailTemplate) {
        const recipientUser = await User.findById(recipientId).select("email name");
        if (recipientUser && recipientUser.email) {
          try {
            await sendTemplateEmail(recipientUser.email, emailTemplate, recipientUser.name, ...emailParams);
            notification.channels.email.sent = true;
            notification.channels.email.sentAt = new Date();
            await notification.save();
          } catch (emailErr) {
            logger.error(`Email dispatch fail to ${recipientUser.email}: ${emailErr.message}`);
          }
        }
      }

      // 4. Push Notification warning/payload logs (future-ready)
      logger.info(`Notification sent to User ${recipientId}: ${title}`);
      return notification;
    } catch (err) {
      logger.error(`Notification failure: ${err.message}`);
      return null;
    }
  }

  async sendBulkNotifications({ recipientIds, type, title, message, link, emailTemplate, emailParams = [] }) {
    const results = [];
    for (const recipientId of recipientIds) {
      const res = await this.sendNotification({
        recipientId,
        type,
        title,
        message,
        link,
        emailTemplate,
        emailParams
      });
      results.push(res);
    }
    return results;
  }
}

module.exports = new NotificationService();
