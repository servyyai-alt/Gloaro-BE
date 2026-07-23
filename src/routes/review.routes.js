const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

/**
 * @swagger
 * /reviews/vendor/{vendorId}:
 *   get:
 *     summary: Get all reviews for a vendor (Public)
 *     tags: [Reviews]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: rating
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *         description: Filter by rating
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *     responses:
 *       200:
 *         description: Vendor reviews fetched successfully
 */
router.get("/vendor/:vendorId", reviewController.getVendorReviews);

router.use(protect);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a review for a vendor/product/service
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ReviewInput'
 *     responses:
 *       201:
 *         description: Review created successfully
 *       422:
 *         description: Validation error
 */
router.post("/", uploadMultiple("images", "reviews", 3), reviewController.createReview);

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     summary: Mark a review as helpful
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review marked as helpful
 */
router.post("/:id/helpful", reviewController.voteHelpful);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review deleted successfully
 */
router.delete("/:id", reviewController.deleteReview);

/**
 * @swagger
 * /reviews/{id}/reply:
 *   post:
 *     summary: Reply to a review (Vendor only)
 *     tags: [Reviews]
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
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply added successfully
 */
router.post("/:id/reply", reviewController.replyToReview);

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Get all reviews (Admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, spam] }
 *     responses:
 *       200:
 *         description: Reviews fetched successfully
 *       403:
 *         description: Not authorized
 */
router.get("/", authorize(ROLES.ADMIN, ROLES.SUPERADMIN), reviewController.getAllReviews);

/**
 * @swagger
 * /reviews/{id}/moderate:
 *   patch:
 *     summary: Moderate a review (Admin only)
 *     tags: [Reviews]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, spam]
 *               rejectedReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review moderated successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/moderate", authorize(ROLES.ADMIN, ROLES.SUPERADMIN), reviewController.moderateReview);

module.exports = router;
