const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const supportController = require("../controllers/support.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

router.use(protect);

/**
 * @swagger
 * /support:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/SupportTicketInput'
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Support ticket created successfully
 *       422:
 *         description: Validation error
 */
router.post(
  "/",
  uploadMultiple("attachments", "support", 5),
  [
    body("subject").trim().notEmpty().withMessage("Subject is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("category").optional().isIn(["billing", "technical", "account", ROLES.VENDOR, "general", "other"]).withMessage("Invalid category"),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]).withMessage("Invalid priority"),
  ],
  validate,
  supportController.createTicket
);

/**
 * @swagger
 * /support/my:
 *   get:
 *     summary: Get my support tickets
 *     tags: [Support]
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
 *         schema: { type: string, enum: [open, in_progress, waiting_for_user, resolved, closed] }
 *     responses:
 *       200:
 *         description: Support tickets fetched successfully
 */
router.get("/my", supportController.getMyTickets);

router.get("/admin/dashboard", authorize(ROLES.ADMIN, ROLES.SUPERADMIN), supportController.getSupportDashboard);

/**
 * @swagger
 * /support/{id}:
 *   get:
 *     summary: Get a support ticket by ID
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket data
 *       404:
 *         description: Ticket not found
 */
router.get("/:id", supportController.getTicketById);

/**
 * @swagger
 * /support/{id}/reply:
 *   post:
 *     summary: Reply to a support ticket
 *     tags: [Support]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Reply added successfully
 */
router.post(
  "/:id/reply",
  uploadMultiple("attachments", "support", 3),
  [
    body("message").trim().notEmpty().withMessage("Message is required"),
    body("isInternal").optional().isBoolean().withMessage("isInternal must be boolean"),
  ],
  validate,
  supportController.replyToTicket
);

/**
 * @swagger
 * /support/{id}/close:
 *   patch:
 *     summary: Close a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket closed successfully
 */
router.patch(
  "/:id/close",
  [
    body("satisfactionRating").optional().isInt({ min: 1, max: 5 }).withMessage("Satisfaction rating must be 1 to 5"),
    body("satisfactionComment").optional().isString().trim(),
  ],
  validate,
  supportController.closeTicket
);

/**
 * @swagger
 * /support:
 *   get:
 *     summary: Get all support tickets (Admin only)
 *     tags: [Support]
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
 *         schema: { type: string, enum: [open, in_progress, waiting_for_user, resolved, closed] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [billing, technical, account, vendor, general, other] }
 *     responses:
 *       200:
 *         description: All tickets fetched successfully
 *       403:
 *         description: Not authorized
 */
router.get("/", authorize(ROLES.ADMIN, ROLES.SUPERADMIN), supportController.getAllTickets);

/**
 * @swagger
 * /support/{id}/assign:
 *   patch:
 *     summary: Assign a support ticket to staff (Admin only)
 *     tags: [Support]
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
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket assigned successfully
 *       403:
 *         description: Not authorized
 */
router.patch(
  "/:id/assign",
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  [body("assignedTo").isMongoId().withMessage("Valid assignedTo user ID required")],
  validate,
  supportController.assignTicket
);

module.exports = router;
