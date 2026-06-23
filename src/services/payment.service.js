const Razorpay = require("razorpay");
const Stripe = require("stripe");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const { Membership } = require("../models/Membership");
const Vendor = require("../models/Vendor");
const Notification = require("../models/Notification");
const { AppError } = require("../middleware/errorHandler");
const { getPagination } = require("../utils/response");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class PaymentService {
  // ========== RAZORPAY ==========
  async createRazorpayOrder(userId, vendorId, type, amount, currency = "INR", description) {
    const options = {
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes: { userId: userId.toString(), vendorId: vendorId?.toString(), type },
    };

    const order = await razorpay.orders.create(options);

    const payment = await Payment.create({
      user: userId,
      vendor: vendorId,
      type,
      amount,
      currency,
      gateway: "razorpay",
      razorpay: { orderId: order.id },
      description,
      status: "pending",
    });

    return { order, payment, keyId: process.env.RAZORPAY_KEY_ID };
  }

  async verifyRazorpayPayment(paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    // Verify signature
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      await Payment.findByIdAndUpdate(paymentId, { status: "failed", failureReason: "Signature mismatch" });
      throw new AppError("Payment verification failed", 400);
    }

    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status: "completed",
        paidAt: new Date(),
        "razorpay.paymentId": razorpayPaymentId,
        "razorpay.signature": razorpaySignature,
      },
      { new: true }
    );

    await this.postPaymentSuccess(payment);
    return payment;
  }

  // ========== STRIPE ==========
  async createStripePaymentIntent(userId, vendorId, type, amount, currency = "inr", description) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: { userId: userId.toString(), vendorId: vendorId?.toString(), type },
    });

    const payment = await Payment.create({
      user: userId,
      vendor: vendorId,
      type,
      amount,
      currency: currency.toUpperCase(),
      gateway: "stripe",
      stripe: { paymentIntentId: paymentIntent.id },
      description,
      status: "pending",
    });

    return { clientSecret: paymentIntent.client_secret, payment };
  }

  async handleStripeWebhook(payload, sig) {
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      throw new AppError(`Stripe webhook error: ${err.message}`, 400);
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const payment = await Payment.findOneAndUpdate(
          { "stripe.paymentIntentId": pi.id },
          { status: "completed", paidAt: new Date() },
          { new: true }
        );
        if (payment) await this.postPaymentSuccess(payment);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await Payment.findOneAndUpdate(
          { "stripe.paymentIntentId": pi.id },
          { status: "failed", failureReason: pi.last_payment_error?.message }
        );
        break;
      }
    }

    return { received: true };
  }

  // ========== POST PAYMENT ==========
  async postPaymentSuccess(payment) {
    if (payment.type === "membership") {
      // Activate membership
      await Membership.findOneAndUpdate(
        { payment: payment._id },
        { isActive: true, status: "active" }
      );
      // Update vendor membership
      const membership = await Membership.findOne({ payment: payment._id });
      if (membership) {
        await Vendor.findByIdAndUpdate(payment.vendor, {
          "membership.plan": membership.plan,
          "membership.startDate": membership.startDate,
          "membership.endDate": membership.endDate,
          "membership.isActive": true,
        });
      }
    }

    // Notification
    await Notification.create({
      recipient: payment.user,
      type: "payment_success",
      title: "Payment Successful",
      message: `Payment of ${payment.currency} ${payment.amount} was successful.`,
      data: new Map([["paymentId", payment._id.toString()]]),
    });
  }

  async requestRefund(paymentId, userId, reason, amount) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.user.toString() !== userId.toString()) throw new AppError("Not authorized", 403);
    if (payment.status !== "completed") throw new AppError("Can only refund completed payments", 400);

    const refundAmount = amount || payment.amount;

    let refundId;
    if (payment.gateway === "razorpay") {
      const refund = await razorpay.payments.refund(payment.razorpay.paymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { reason },
      });
      refundId = refund.id;
    } else if (payment.gateway === "stripe") {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe.paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: "requested_by_customer",
      });
      refundId = refund.id;
    }

    await Payment.findByIdAndUpdate(paymentId, {
      status: refundAmount >= payment.amount ? "refunded" : "partially_refunded",
      "refund.amount": refundAmount,
      "refund.reason": reason,
      "refund.refundId": refundId,
      "refund.refundedAt": new Date(),
      "refund.status": "completed",
    });

    return { message: "Refund initiated successfully", refundId };
  }

  async getPayments(query, userId, role) {
    const { page, limit, skip } = getPagination(query);
    const filter = {};
    if (!["admin", "superadmin"].includes(role)) filter.user = userId;
    if (query.status) filter.status = query.status;
    if (query.gateway) filter.gateway = query.gateway;
    if (query.type) filter.type = query.type;

    const [payments, total] = await Promise.all([
      Payment.find(filter).populate("user", "name email").sort("-createdAt").skip(skip).limit(limit),
      Payment.countDocuments(filter),
    ]);

    return { payments, total, page, limit };
  }

  async getPaymentById(paymentId, userId, role) {
    const payment = await Payment.findById(paymentId).populate("user", "name email").populate("vendor", "businessName");
    if (!payment) throw new AppError("Payment not found", 404);
    if (!["admin", "superadmin"].includes(role) && payment.user._id.toString() !== userId.toString()) {
      throw new AppError("Not authorized", 403);
    }
    return payment;
  }
}

module.exports = new PaymentService();
