const { body } = require("express-validator");

const createRazorpayOrderValidation = [
  body("type")
    .isIn(["membership", "featured_listing", "event_registration", "other"])
    .withMessage("Invalid payment type"),
  body("amount")
    .isFloat({ min: 1 })
    .withMessage("Amount must be greater than 0"),
  body("currency")
    .optional()
    .isIn(["INR", "USD", "EUR"])
    .withMessage("Unsupported currency"),
];

const verifyRazorpayValidation = [
  body("paymentId").isMongoId().withMessage("Valid payment ID required"),
  body("razorpay_order_id").notEmpty().withMessage("Razorpay order ID required"),
  body("razorpay_payment_id").notEmpty().withMessage("Razorpay payment ID required"),
  body("razorpay_signature").notEmpty().withMessage("Razorpay signature required"),
];

const createStripeIntentValidation = [
  body("type")
    .isIn(["membership", "featured_listing", "event_registration", "other"])
    .withMessage("Invalid payment type"),
  body("amount").isFloat({ min: 1 }).withMessage("Amount must be > 0"),
];

const refundValidation = [
  body("reason").trim().notEmpty().withMessage("Refund reason is required"),
  body("amount").optional().isFloat({ min: 1 }).withMessage("Amount must be > 0"),
];

module.exports = {
  createRazorpayOrderValidation,
  verifyRazorpayValidation,
  createStripeIntentValidation,
  refundValidation,
};
