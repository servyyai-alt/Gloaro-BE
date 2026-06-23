const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin", "superadmin"));

router.get("/dashboard", adminController.getDashboard);
router.get("/pending-approvals", adminController.getPendingApprovals);
router.get("/audit-logs", adminController.getAuditLogs);
router.get("/system-stats", authorize("superadmin"), adminController.getSystemStats);
router.post("/create-admin", authorize("superadmin"), adminController.createAdmin);

module.exports = router;
