const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin", "superadmin"));

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *       403:
 *         description: Not authorized
 */
router.get("/dashboard", adminController.getDashboard);

/**
 * @swagger
 * /admin/pending-approvals:
 *   get:
 *     summary: Get all pending approvals (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending approvals (vendors, products, services, reviews)
 *       403:
 *         description: Not authorized
 */
router.get("/pending-approvals", adminController.getPendingApprovals);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Get audit logs (Admin only)
 *     tags: [Admin]
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
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit logs
 *       403:
 *         description: Not authorized
 */
router.get("/audit-logs", adminController.getAuditLogs);

/**
 * @swagger
 * /admin/system-stats:
 *   get:
 *     summary: Get system statistics (Superadmin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 *       403:
 *         description: Not authorized (superadmin only)
 */
router.get("/system-stats", authorize("superadmin"), adminController.getSystemStats);

/**
 * @swagger
 * /admin/create-admin:
 *   post:
 *     summary: Create a new admin user (Superadmin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, superadmin]
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       403:
 *         description: Not authorized
 */
router.post("/create-admin", authorize("superadmin"), adminController.createAdmin);

module.exports = router;
