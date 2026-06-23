const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true },
    status: { type: String, enum: ["pending", "completed", "rewarded", "expired"], default: "pending" },
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
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ code: 1 });

module.exports = mongoose.model("Referral", referralSchema);
