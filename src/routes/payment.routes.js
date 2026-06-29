const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { protect } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  createRazorpayOrderValidation,
  verifyRazorpayValidation,
  createStripeIntentValidation,
  refundValidation,
} = require("../validations/payment.validation");

/**
 * @swagger
 * /payments/webhook/stripe:
 *   post:
 *     summary: Stripe webhook endpoint (raw body)
 *     tags: [Payments]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook
);

router.post("/webhook/razorpay", paymentController.razorpayWebhook);

router.use(protect);

/**
 * @swagger
 * /payments/razorpay/order:
 *   post:
 *     summary: Create a Razorpay order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RazorpayOrderInput'
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: order_xxxxxxxxx
 *                         amount:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         status:
 *                           type: string
 */
router.post("/razorpay/order", createRazorpayOrderValidation, validate, paymentController.createRazorpayOrder);

/**
 * @swagger
 * /payments/razorpay/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_payment_id
 *               - razorpay_order_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Payment verification failed
 */
router.post("/razorpay/verify", verifyRazorpayValidation, validate, paymentController.verifyRazorpayPayment);

/**
 * @swagger
 * /payments/stripe/intent:
 *   post:
 *     summary: Create Stripe payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StripePaymentIntentInput'
 *     responses:
 *       200:
 *         description: Payment intent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                     paymentIntent:
 *                       type: object
 */
router.post("/stripe/intent", createStripeIntentValidation, validate, paymentController.createStripePaymentIntent);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: gateway
 *         schema: { type: string, enum: [razorpay, stripe] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, completed, failed, refunded] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [membership, featured_listing, event_registration, other] }
 *     responses:
 *       200:
 *         description: Payments fetched successfully
 */
router.get("/", paymentController.getPayments);

router.get("/transactions", paymentController.getTransactions);
router.get("/invoices", paymentController.getInvoices);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment data
 *       404:
 *         description: Payment not found
 */
router.get("/:id", paymentController.getPaymentById);

/**
 * @swagger
 * /payments/{id}/refund:
 *   post:
 *     summary: Request a refund for a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed successfully
 */
router.post("/:id/refund", refundValidation, validate, paymentController.requestRefund);

module.exports = router;
