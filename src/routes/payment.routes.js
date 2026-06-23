const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { protect, authorize } = require("../middleware/auth");

// Stripe webhook - raw body needed
router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook
);

router.use(protect);

// Razorpay
router.post("/razorpay/order", paymentController.createRazorpayOrder);
router.post("/razorpay/verify", paymentController.verifyRazorpayPayment);

// Stripe
router.post("/stripe/intent", paymentController.createStripePaymentIntent);

// Payment history
router.get("/", paymentController.getPayments);
router.get("/:id", paymentController.getPaymentById);
router.post("/:id/refund", paymentController.requestRefund);

module.exports = router;
