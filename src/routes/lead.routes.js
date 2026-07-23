const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const leadController = require("../controllers/lead.controller");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

/**
 * @swagger
 * /leads:
 *   post:
 *     summary: Submit a new lead/enquiry (Public)
 *     tags: [Leads]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeadInput'
 *     responses:
 *       201:
 *         description: Lead submitted successfully
 *       422:
 *         description: Validation error
 */
router.post(
  "/",
  optionalAuth,
  [
    body(ROLES.VENDOR).notEmpty().withMessage("Vendor ID required"),
    body("name").trim().notEmpty().withMessage("Name required"),
    body("phone").notEmpty().withMessage("Phone required"),
    body("subject").notEmpty().withMessage("Subject required"),
    body("message").notEmpty().withMessage("Message required"),
  ],
  validate,
  leadController.submitLead
);

router.use(protect);

/**
 * @swagger
 * /leads:
 *   get:
 *     summary: Get leads for current vendor or all (Admin)
 *     tags: [Leads]
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
 *         name: status
 *         schema: { type: string, enum: [new, contacted, qualified, proposal_sent, won, lost] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, urgent] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *     responses:
 *       200:
 *         description: Leads fetched successfully
 */
router.get("/", leadController.getLeads);

/**
 * @swagger
 * /leads/analytics:
 *   get:
 *     summary: Get lead analytics and statistics
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lead analytics data
 */
router.get("/analytics", leadController.getLeadAnalytics);

/**
 * @swagger
 * /leads/{id}:
 *   get:
 *     summary: Get lead by ID
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead data
 *       404:
 *         description: Lead not found
 */
router.get("/:id", leadController.getLeadById);

/**
 * @swagger
 * /leads/{id}/status:
 *   patch:
 *     summary: Update lead status
 *     tags: [Leads]
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
 *                 enum: [new, contacted, qualified, proposal_sent, won, lost]
 *     responses:
 *       200:
 *         description: Lead status updated
 */
router.patch("/:id/status", leadController.updateLeadStatus);

/**
 * @swagger
 * /leads/{id}/notes:
 *   post:
 *     summary: Add internal note to a lead
 *     tags: [Leads]
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
 *               isInternal:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Note added successfully
 */
router.post("/:id/notes", leadController.addNote);

/**
 * @swagger
 * /leads/{id}/followups:
 *   post:
 *     summary: Schedule a follow-up for a lead
 *     tags: [Leads]
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
 *               - scheduledAt
 *               - type
 *             properties:
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *                 enum: [call, email, meeting, other]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Follow-up scheduled successfully
 */
router.post("/:id/followups", leadController.scheduleFollowUp);

/**
 * @swagger
 * /leads/{id}/assign:
 *   patch:
 *     summary: Assign lead to a user (Admin only)
 *     tags: [Leads]
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
 *                 description: User ID to assign the lead to
 *     responses:
 *       200:
 *         description: Lead assigned successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/assign", authorize(ROLES.ADMIN, ROLES.SUPERADMIN), leadController.assignLead);

module.exports = router;
