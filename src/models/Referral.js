const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // optional for vendor referrals
    referredVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: false }, // optional for vendor target
    code: { type: String, required: true, unique: true, immutable: true, trim: true, uppercase: true },
    type: { type: String, enum: ["signup", "business"], default: "signup" },
    businessValue: { type: Number, default: 0 },
    details: String,
    status: { 
      type: String, 
      enum: ["pending", "completed", "rewarded", "expired", "created", "assigned", "accepted", "contacted", "meeting_scheduled", "proposal_sent", "negotiation", "won", "lost"], 
      default: "pending" 
    },
    reward: {
      type: { type: String, enum: ["cash", "discount", "credits", "none"], default: "none" },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      isGiven: { type: Boolean, default: false },
      givenAt: Date,
    },
    commission: {
      percent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      onPayment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    },
    completedAt: Date,
    expiresAt: Date,
    name: String,
    email: String,
    mobileNumber: String,
    requirement: String,
    estimatedValue: { type: Number, default: 0 },
    actualValue: { type: Number, default: 0 },
    priority: { type: String, enum: ["high", "medium", "low"], default: "low" },
    notes: String,
    expectedClosing: Date,
    isLinkedMember: { type: Boolean, default: false },
    linkedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model("Referral", referralSchema);
