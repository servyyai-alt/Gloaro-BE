const mongoose = require("mongoose");

const membershipPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, enum: ["free", "silver", "gold", "platinum"] },
    displayName: { type: String, required: true },
    description: String,
    price: { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
    currency: { type: String, default: "INR" },
    features: [{ name: String, value: mongoose.Schema.Types.Mixed, isHighlighted: Boolean }],
    limits: {
      products: { type: Number, default: 5 },
      services: { type: Number, default: 3 },
      images: { type: Number, default: 5 },
      leads: { type: Number, default: 10 },
      featuredListing: { type: Boolean, default: false },
      verifiedBadge: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      analyticsAccess: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    razorpayPlanId: { monthly: String, yearly: String },
    stripePriceId: { monthly: String, yearly: String },
    color: String,
    badge: String,
  },
  { timestamps: true }
);

const membershipSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["free", "silver", "gold", "platinum"], required: true },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    isAutoRenew: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "expired", "cancelled", "pending"], default: "active" },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    price: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    previousPlan: String,
    upgradedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    expiryNotificationSent: { type: Boolean, default: false },
    renewalAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

membershipSchema.index({ vendor: 1 });
membershipSchema.index({ status: 1 });
membershipSchema.index({ endDate: 1 });

const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);
const Membership = mongoose.model("Membership", membershipSchema);

module.exports = { MembershipPlan, Membership };
