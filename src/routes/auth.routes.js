const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               phone: { type: string }
 *               role: { type: string, enum: [user, vendor] }
 *               referralCode: { type: string }
 *     responses:
 *       201: { description: Registration successful }
 *       409: { description: Email already registered }
 */
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  authController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  authController.login
);

router.post("/logout", protect, authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", [body("email").isEmail()], validate, authController.forgotPassword);
router.post(
  "/reset-password/:token",
  [body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 chars")],
  validate,
  authController.resetPassword
);
router.post(
  "/change-password",
  protect,
  [body("currentPassword").notEmpty(), body("newPassword").isLength({ min: 8 })],
  validate,
  authController.changePassword
);
router.get("/verify-email/:token", authController.verifyEmail);
router.post("/send-otp", protect, authController.sendOTP);
router.post(
  "/verify-otp",
  protect,
  [body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits")],
  validate,
  authController.verifyOTP
);
router.get("/me", protect, authController.getMe);

module.exports = router;
