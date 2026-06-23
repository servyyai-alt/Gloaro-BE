const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referral.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/**
 * @swagger
 * /referrals/my:
 *   get:
 *     summary: Get my referrals
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referrals fetched successfully
 */
router.get("/my", referralController.getMyReferrals);

/**
 * @swagger
 * /referrals/my/code:
 *   get:
 *     summary: Get my referral code
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code fetched successfully
 */
router.get("/my/code", referralController.getMyReferralCode);

/**
 * @swagger
 * /referrals/my/stats:
 *   get:
 *     summary: Get my referral statistics
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral stats fetched successfully
 */
router.get("/my/stats", referralController.getReferralStats);

/**
 * @swagger
 * /referrals:
 *   get:
 *     summary: Get all referrals (Admin only)
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All referrals fetched successfully
 *       403:
 *         description: Not authorized
 */
router.get("/", authorize("admin", "superadmin"), referralController.getAllReferrals);

/**
 * @swagger
 * /referrals/{id}/reward:
 *   patch:
 *     summary: Process referral reward (Admin only)
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [cash, discount, credits]
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Reward processed successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/reward", authorize("admin", "superadmin"), referralController.processReferralReward);

module.exports = router;
