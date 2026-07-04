const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    action: String,
    note: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const enterpriseRecordSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
      enum: [
        "organization",
        "assignment",
        "visitor",
        "meeting",
        "business",
        "chapter",
        "event",
        "vendor_management",
        "marketplace",
        "business_wall",
        "training",
        "testimonial",
        "report",
        "scorecard",
        "activity",
        "workflow",
        "referral_pipeline",
        "visitor_conversion",
        "attendance",
        "vendor_approval",
        "marketplace_approval",
        "notification_automation",
        "task",
        "calendar",
        "executive_dashboard",
        "chapter_dashboard",
        "member_journey",
        "ai_insight",
      ],
    },
    type: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, unique: true, sparse: true, immutable: true, index: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
    director: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
    status: {
      type: String,
      enum: ["draft", "pending", "under_review", "active", "inactive", "approved", "rejected", "cancelled", "archived", "won", "lost", "closed", "converted", "completed"],
      default: "active",
      index: true,
    },
    membersCount: { type: Number, default: 0 },
    meetingsCount: { type: Number, default: 0 },
    attendanceCount: { type: Number, default: 0 },
    visitorsCount: { type: Number, default: 0 },
    businessValue: { type: Number, default: 0 },
    referralValue: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeline: [timelineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

enterpriseRecordSchema.index({ module: 1, type: 1, status: 1 });
enterpriseRecordSchema.index({ name: "text", code: "text", "metadata.company": "text", "metadata.contact": "text" });
enterpriseRecordSchema.index({ parent: 1 });
enterpriseRecordSchema.index({ code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("EnterpriseRecord", enterpriseRecordSchema);
