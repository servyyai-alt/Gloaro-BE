const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin", "superadmin"));

router.get("/dashboard", reportController.getDashboardSummary);
router.get("/users", reportController.getUserReport);
router.get("/vendors", reportController.getVendorReport);
router.get("/revenue", reportController.getRevenueReport);
router.get("/memberships", reportController.getMembershipReport);
router.get("/leads", reportController.getLeadReport);
router.get("/products", reportController.getProductReport);
router.get("/services", reportController.getServiceReport);
router.get("/events", reportController.getEventReport);

module.exports = router;
