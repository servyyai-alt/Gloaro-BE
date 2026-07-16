const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: [
        "lead_new", "lead_update", "review_new", "review_reply",
        "membership_expiry", "membership_activated", "payment_success",
        "payment_failed", "vendor_approved", "vendor_rejected",
        "event_reminder", "event_registration", "referral_reward",
        "product_approved", "service_approved", "support_reply",
        "system", "announcement",
        "user_created", "membership_registered", "membership_approved",
        "membership_rejected", "meeting_created", "attendance_submitted",
        "membership_application_new",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Map, of: mongoose.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    channels: {
      inApp: { sent: { type: Boolean, default: false }, sentAt: Date },
      email: { sent: { type: Boolean, default: false }, sentAt: Date },
      sms: { sent: { type: Boolean, default: false }, sentAt: Date },
      push: { sent: { type: Boolean, default: false }, sentAt: Date },
    },
    link: String,
    image: String,
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
