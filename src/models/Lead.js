const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Contact Info
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    company: String,
    // Enquiry
    subject: { type: String, required: true },
    message: { type: String, required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    budget: { min: Number, max: Number, currency: { type: String, default: "INR" } },
    // Status
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "proposal_sent", "won", "lost"],
      default: "new",
    },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    source: { type: String, enum: ["website", "referral", "direct", "social", "other"], default: "website" },
    // Notes & Follow-up
    notes: [
      {
        content: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedAt: { type: Date, default: Date.now },
        isInternal: { type: Boolean, default: true },
      },
    ],
    followUps: [
      {
        scheduledAt: { type: Date, required: true },
        type: { type: String, enum: ["call", "email", "meeting", "other"] },
        notes: String,
        completedAt: Date,
        isCompleted: { type: Boolean, default: false },
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    // Tracking
    wonAt: Date,
    lostAt: Date,
    lostReason: String,
    dealValue: Number,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

leadSchema.index({ vendor: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Lead", leadSchema);
