const paymentService = require("../services/payment.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse } = require("../utils/response");

exports.createRazorpayOrder = asyncHandler(async (req, res) => {
  const { vendorId, type, amount, currency, description } = req.body;
  const result = await paymentService.createRazorpayOrder(req.user._id, vendorId, type, amount, currency, description);
  successResponse(res, 201, "Razorpay order created", result);
});

exports.verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const payment = await paymentService.verifyRazorpayPayment(paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature);
  successResponse(res, 200, "Payment verified", payment);
});

exports.createStripePaymentIntent = asyncHandler(async (req, res) => {
  const { vendorId, type, amount, currency, description } = req.body;
  const result = await paymentService.createStripePaymentIntent(req.user._id, vendorId, type, amount, currency, description);
  successResponse(res, 201, "Payment intent created", result);
});

exports.stripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const result = await paymentService.handleStripeWebhook(req.rawBody || req.body, sig);
  res.json(result);
});

exports.requestRefund = asyncHandler(async (req, res) => {
  const { reason, amount } = req.body;
  const result = await paymentService.requestRefund(req.params.id, req.user._id, reason, amount);
  successResponse(res, 200, result.message, result);
});

exports.getPayments = asyncHandler(async (req, res) => {
  const { payments, total, page, limit } = await paymentService.getPayments(req.query, req.user._id, req.user.role);
  paginatedResponse(res, payments, page, limit, total);
});

exports.getPaymentById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id, req.user._id, req.user.role);
  successResponse(res, 200, "Payment retrieved", payment);
});
