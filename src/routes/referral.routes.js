const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referral.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/my", referralController.getMyReferrals);
router.get("/my/code", referralController.getMyReferralCode);
router.get("/my/stats", referralController.getReferralStats);

// Admin
router.get("/", authorize("admin", "superadmin"), referralController.getAllReferrals);
router.patch("/:id/reward", authorize("admin", "superadmin"), referralController.processReferralReward);

module.exports = router;
