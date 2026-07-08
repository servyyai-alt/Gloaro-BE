const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { protect, authorize } = require("../middleware/auth");

const { ADMIN_ROLE_VALUES } = require("../constants/adminRoles");

router.use(protect, (req, res, next) => {
  const cleanPath = req.path.replace(/^\/+|\/+$/g, "");
  if (cleanPath === "analytics") {
    return authorize(...ADMIN_ROLE_VALUES)(req, res, next);
  }
  return authorize("admin", "superadmin")(req, res, next);
});

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     summary: Get dashboard summary (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary
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
router.get("/dashboard", reportController.getDashboardSummary);
router.get("/analytics", reportController.getAnalyticsSummary);

/**
 * @swagger
 * /reports/users:
 *   get:
 *     summary: Get user report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month] }
 *     responses:
 *       200:
 *         description: User report data
 */
router.get("/users", reportController.getUserReport);

/**
 * @swagger
 * /reports/vendors:
 *   get:
 *     summary: Get vendor report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month] }
 *     responses:
 *       200:
 *         description: Vendor report data
 */
router.get("/vendors", reportController.getVendorReport);

/**
 * @swagger
 * /reports/revenue:
 *   get:
 *     summary: Get revenue report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, year] }
 *     responses:
 *       200:
 *         description: Revenue report data
 */
router.get("/revenue", reportController.getRevenueReport);

/**
 * @swagger
 * /reports/memberships:
 *   get:
 *     summary: Get membership report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership report data
 */
router.get("/memberships", reportController.getMembershipReport);

/**
 * @swagger
 * /reports/leads:
 *   get:
 *     summary: Get leads report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leads report data
 */
router.get("/leads", reportController.getLeadReport);

/**
 * @swagger
 * /reports/products:
 *   get:
 *     summary: Get products report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products report data
 */
router.get("/products", reportController.getProductReport);

/**
 * @swagger
 * /reports/services:
 *   get:
 *     summary: Get services report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Services report data
 */
router.get("/services", reportController.getServiceReport);

/**
 * @swagger
 * /reports/events:
 *   get:
 *     summary: Get events report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Events report data
 */
router.get("/officials", reportController.getOfficialReport);
router.get("/attendance", reportController.getAttendanceReport);
router.get("/meetings", reportController.getMeetingReport);
router.get("/payments", reportController.getPaymentReport);
router.get("/referrals", reportController.getReferralReport);

module.exports = router;
