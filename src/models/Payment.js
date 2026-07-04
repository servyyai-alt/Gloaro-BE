const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    type: {
      type: String,
      enum: ["membership", "featured_listing", "event_registration", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    gateway: { type: String, enum: ["razorpay", "stripe", "free"], required: true },
    // Razorpay
    razorpay: {
      orderId: String,
      paymentId: String,
      signature: String,
      subscriptionId: String,
    },
    // Stripe
    stripe: {
      paymentIntentId: String,
      sessionId: String,
      subscriptionId: String,
      customerId: String,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
      default: "pending",
    },
    description: String,
    invoiceNumber: { type: String, unique: true, sparse: true, immutable: true, trim: true, uppercase: true, index: true },
    refund: {
      amount: Number,
      reason: String,
      refundId: String,
      refundedAt: Date,
      status: { type: String, enum: ["pending", "completed", "failed"] },
    },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
    failureReason: String,
    paidAt: Date,
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponCode: String,
    receiptUrl: String,
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1 });
paymentSchema.index({ vendor: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ gateway: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Payment", paymentSchema);
