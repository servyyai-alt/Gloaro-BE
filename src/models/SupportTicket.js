const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true },
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

supportTicketSchema.pre("save", async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model("SupportTicket").countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(6, "0")}`;
    // SLA: 24h for high, 48h for medium, 72h for low
    const hours = this.priority === "critical" ? 4 : this.priority === "high" ? 24 : this.priority === "medium" ? 48 : 72;
    this.slaDeadline = new Date(Date.now() + hours * 3600000);
  }
  next();
});

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
