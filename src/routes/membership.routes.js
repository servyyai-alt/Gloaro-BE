const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membership.controller");
const { protect, authorize } = require("../middleware/auth");

/**
 * @swagger
 * /memberships/plans:
 *   get:
 *     summary: Get all membership plans (Public)
 *     tags: [Memberships]
 *     security: []
 *     responses:
 *       200:
 *         description: Membership plans fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MembershipPlan'
 */
router.get("/plans", membershipController.getPlans);

router.use(protect);

/**
 * @swagger
 * /memberships/purchase:
 *   post:
 *     summary: Purchase a membership plan
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MembershipPurchaseInput'
 *     responses:
 *       201:
 *         description: Membership purchased successfully
 *       400:
 *         description: Invalid plan or payment
 */
router.post("/purchase", membershipController.purchaseMembership);
router.post("/renew", membershipController.renewMembership);

/**
 * @swagger
 * /memberships/my:
 *   get:
 *     summary: Get current user/vendor membership
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current membership data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Membership'
 */
router.get("/my", membershipController.getMyMembership);

/**
 * @swagger
 * /memberships/my/history:
 *   get:
 *     summary: Get membership purchase history
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership history fetched successfully
 */
router.get("/my/history", membershipController.getMembershipHistory);

/**
 * @swagger
 * /memberships/my/cancel:
 *   patch:
 *     summary: Cancel current membership
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
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
 *         description: Membership cancelled successfully
 */
router.patch("/my/cancel", membershipController.cancelMembership);

router.use(authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

/**
 * @swagger
 * /memberships:
 *   get:
 *     summary: Get all memberships (Admin only)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All memberships fetched successfully
 */
router.get("/", membershipController.getAllMemberships);

/**
 * @swagger
 * /memberships/plans:
 *   post:
 *     summary: Create a new membership plan (Admin only)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 enum: [silver, gold, platinum]
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: object
 *                 properties:
 *                   monthly:
 *                     type: number
 *                   yearly:
 *                     type: number
 *               limits:
 *                 type: object
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       403:
 *         description: Not authorized
 */
router.post("/plans", membershipController.createPlan);

/**
 * @swagger
 * /memberships/plans/{id}:
 *   patch:
 *     summary: Update a membership plan (Admin only)
 *     tags: [Memberships]
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
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/plans/:id", membershipController.updatePlan);

module.exports = router;
