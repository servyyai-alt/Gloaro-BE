const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

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

router.get("/banners", adminController.getBanners);
router.post(
  "/banners",
  uploadSingle("image", "banners"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("placement").optional().isIn(["home", "directory", "marketplace", "events", "dashboard"]).withMessage("Invalid placement"),
  ],
  validate,
  adminController.createBanner
);
router.patch(
  "/banners/:id",
  uploadSingle("image", "banners"),
  [
    body("title").optional().notEmpty().withMessage("Title cannot be empty"),
    body("placement").optional().isIn(["home", "directory", "marketplace", "events", "dashboard"]).withMessage("Invalid placement"),
  ],
  validate,
  adminController.updateBanner
);
router.delete("/banners/:id", adminController.deleteBanner);

router.get("/faqs", adminController.getFAQs);
router.post(
  "/faqs",
  [
    body("question").notEmpty().withMessage("Question is required"),
    body("answer").notEmpty().withMessage("Answer is required"),
  ],
  validate,
  adminController.createFAQ
);
router.patch(
  "/faqs/:id",
  [
    body("question").optional().notEmpty().withMessage("Question cannot be empty"),
    body("answer").optional().notEmpty().withMessage("Answer cannot be empty"),
  ],
  validate,
  adminController.updateFAQ
);
router.delete("/faqs/:id", adminController.deleteFAQ);

router.get("/settings", adminController.getSettings);
router.put(
  "/settings/:key",
  [
    body("value").exists().withMessage("Value is required"),
    body("group").optional().isString().trim(),
    body("description").optional().isString().trim(),
    body("isPublic").optional().isBoolean().withMessage("isPublic must be boolean"),
  ],
  validate,
  (req, res, next) => {
    req.body.key = req.params.key;
    adminController.upsertSetting(req, res, next);
  }
);

module.exports = router;
