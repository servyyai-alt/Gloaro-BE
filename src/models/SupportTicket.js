const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, sparse: true, immutable: true, trim: true, uppercase: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["billing", "technical", "account", "vendor", "general", "other"],
      default: "general",
    },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: {
      type: String,
      enum: ["open", "in_progress", "waiting_for_user", "resolved", "closed"],
      default: "open",
    },
    attachments: [{ url: String, publicId: String, name: String }],
    replies: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        message: { type: String, required: true },
        attachments: [{ url: String, publicId: String, name: String }],
        isInternal: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: Date,
    closedAt: Date,
    satisfactionRating: { type: Number, min: 1, max: 5 },
    satisfactionComment: String,
    slaDeadline: Date,
    firstResponseAt: Date,
    tags: [String],
  },
  { timestamps: true }
);

supportTicketSchema.index({ user: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ assignedTo: 1 });
supportTicketSchema.index({ ticketNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
