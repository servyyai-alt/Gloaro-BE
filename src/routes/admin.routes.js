const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

router.use(protect, authorize("admin", "superadmin"));

const getMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.meta.toObject === "function") return user.meta.toObject();
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

const inferAdminModule = (path) => {
  if (path === "/dashboard") return "dashboard";
  if (path.startsWith("/admin-accounts")) return "settings";
  if (path.startsWith("/super-config") || path.startsWith("/settings") || path.startsWith("/system")) return "settings";
  if (path.startsWith("/audit-logs")) return "reports";
  if (path.startsWith("/enterprise/search")) return "settings";
  if (path.includes("vendor")) return "vendors";
  if (path.includes("marketplace") || path.includes("products") || path.includes("services") || path.includes("banners")) return "marketplace";
  if (path.includes("membership") || path.includes("users") || path.includes("plans")) return "members";
  if (path.includes("visitor")) return "visitors";
  if (path.includes("meeting")) return "meetings";
  if (path.includes("attendance")) return "attendance";
  if (path.includes("training")) return "training";
  if (path.includes("event")) return "events";
  if (path.includes("referral")) return "referrals";
  if (path.includes("business")) return "business";
  if (path.includes("notification")) return "notifications";
  if (path.includes("report") || path.includes("analytics")) return "reports";
  return null;
};

const requiredPermission = (method) => {
  if (method === "GET") return "canView";
  if (method === "POST") return "canCreate";
  if (["PUT", "PATCH"].includes(method)) return "canEdit";
  if (method === "DELETE") return "canDelete";
  return "canView";
};

router.use((req, res, next) => {
  if (req.user.role === "superadmin") return next();
  const profile = getMeta(req.user).adminProfile;
  if (!profile?.modules?.length) return next();
  if (req.path.startsWith("/super-config/role/")) return next();

  const moduleName = inferAdminModule(req.path);
  if (!moduleName) return next();
  const permissions = profile.permissions?.[moduleName] || {};
  const hasModule = profile.modules.includes(moduleName);
  const canUseApi = permissions.apiAccess === true;
  const canPerform = permissions[requiredPermission(req.method)] === true;

  if (!hasModule || !canUseApi || !canPerform) {
    return res.status(403).json({ success: false, message: "You do not have permission to access this admin module" });
  }
  next();
});

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
router.get("/system-logs", authorize("superadmin"), adminController.getSystemLogs);
router.get("/admin-accounts", authorize("superadmin", "admin"), adminController.getAdminAccounts);
router.post(
  "/admin-accounts",
  authorize("superadmin"),
  uploadSingle("avatar", "admin-avatars"),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  validate,
  adminController.createAdminAccount
);
router.patch(
  "/admin-accounts/:id",
  authorize("superadmin", "admin"),
  uploadSingle("avatar", "admin-avatars"),
  [
    body("email").not().exists().withMessage("Email cannot be changed"),
    body("password").not().exists().withMessage("Use reset password endpoint"),
  ],
  validate,
  adminController.updateAdminAccount
);
router.post(
  "/admin-accounts/:id/clone",
  authorize("superadmin"),
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  adminController.cloneAdminAccount
);
router.patch(
  "/admin-accounts/:id/status",
  authorize("superadmin", "admin"),
  [body("action").isIn(["suspend", "activate", "lock", "unlock"]).withMessage("Invalid status action")],
  validate,
  adminController.updateAdminAccountStatus
);
router.patch(
  "/admin-accounts/:id/reset-password",
  authorize("superadmin", "admin"),
  [body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")],
  validate,
  adminController.resetAdminPassword
);
router.patch(
  "/admin-accounts/:id/transfer",
  authorize("superadmin", "admin"),
  [body("organization").isObject().withMessage("Organization is required")],
  validate,
  adminController.transferAdminOrganization
);
router.post("/admin-accounts/:id/login-as", authorize("superadmin"), adminController.loginAsAdmin);
router.get("/admin-accounts/:id/activity", authorize("superadmin", "admin"), adminController.getAdminActivity);
router.delete("/admin-accounts/:id", authorize("superadmin", "admin"), adminController.deleteAdminAccount);
router.get("/enterprise/search", adminController.globalEnterpriseSearch);
router.get("/enterprise/organization/tree", adminController.getOrganizationTree);
router.get("/enterprise/calendar/items", adminController.getEnterpriseCalendar);
router.get("/enterprise/analytics/summary", adminController.getEnterpriseAnalytics);
router.get("/enterprise/:module", adminController.getEnterpriseRecords);
router.get("/enterprise/:module/stats", adminController.getEnterpriseStats);
router.get("/enterprise/:module/kanban", adminController.getEnterpriseKanban);
router.post(
  "/enterprise/:module",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("status").optional().isIn(["draft", "pending", "under_review", "active", "inactive", "approved", "rejected", "cancelled", "archived", "won", "lost", "closed", "converted", "completed"]),
  ],
  validate,
  adminController.createEnterpriseRecord
);
router.post(
  "/enterprise/:module/import",
  [
    body("records").isArray({ min: 1 }).withMessage("records must be a non-empty array"),
    body("records.*.name").notEmpty().withMessage("Every record needs a name"),
  ],
  validate,
  adminController.bulkImportEnterpriseRecords
);
router.get("/enterprise-records/:id", adminController.getEnterpriseRecord);
router.patch(
  "/enterprise-records/:id",
  [
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("status").optional().isIn(["draft", "pending", "under_review", "active", "inactive", "approved", "rejected", "cancelled", "archived", "won", "lost", "closed", "converted", "completed"]),
  ],
  validate,
  adminController.updateEnterpriseRecord
);
router.patch(
  "/enterprise-records/:id/status",
  [body("status").isIn(["draft", "pending", "under_review", "active", "inactive", "approved", "rejected", "cancelled", "archived", "won", "lost", "closed", "converted", "completed"])],
  validate,
  adminController.updateEnterpriseStatus
);
router.patch(
  "/enterprise-records/:id/transition",
  [
    body("stage").optional().isString(),
    body("status").optional().isIn(["draft", "pending", "under_review", "active", "inactive", "approved", "rejected", "cancelled", "archived", "won", "lost", "closed", "converted", "completed"]),
    body("note").optional().isString(),
    body("createTask").optional().isObject(),
  ],
  validate,
  adminController.transitionEnterpriseRecord
);
router.delete("/enterprise-records/:id", adminController.deleteEnterpriseRecord);
router.get("/super-config", authorize("superadmin"), adminController.getSuperAdminConfig);
router.get("/super-config/role/:role", authorize("superadmin", "admin"), adminController.getRoleConfiguration);
router.get("/super-config/:section", authorize("superadmin"), adminController.getSuperAdminConfigSection);
router.put(
  "/super-config/:section",
  authorize("superadmin"),
  [body("value").exists().withMessage("Configuration value is required")],
  validate,
  adminController.updateSuperAdminConfigSection
);
router.patch(
  "/super-config/features/:role/:module",
  authorize("superadmin"),
  [
    body("enabled").optional().isBoolean(),
    body("canView").optional().isBoolean(),
    body("canCreate").optional().isBoolean(),
    body("canEdit").optional().isBoolean(),
    body("canDelete").optional().isBoolean(),
    body("canApprove").optional().isBoolean(),
    body("canExport").optional().isBoolean(),
    body("canPrint").optional().isBoolean(),
    body("showSidebar").optional().isBoolean(),
    body("showDashboardCard").optional().isBoolean(),
    body("enableNotifications").optional().isBoolean(),
    body("apiAccess").optional().isBoolean(),
    body("readOnly").optional().isBoolean(),
  ],
  validate,
  adminController.updateFeaturePermission
);

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
router.post("/create-admin", authorize("superadmin", "admin"), adminController.createAdmin);

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
