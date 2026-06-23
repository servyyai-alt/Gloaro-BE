const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membership.controller");
const { protect, authorize } = require("../middleware/auth");

// Public: view plans
router.get("/plans", membershipController.getPlans);

// Protected routes
router.use(protect);

router.post("/purchase", membershipController.purchaseMembership);
router.get("/my", membershipController.getMyMembership);
router.get("/my/history", membershipController.getMembershipHistory);
router.patch("/my/cancel", membershipController.cancelMembership);

// Admin-only routes
router.use(authorize("admin", "superadmin"));
router.get("/", membershipController.getAllMemberships);
router.post("/plans", membershipController.createPlan);
router.patch("/plans/:id", membershipController.updatePlan);

module.exports = router;
