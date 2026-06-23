const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

// Public: get vendor reviews
router.get("/vendor/:vendorId", reviewController.getVendorReviews);

router.use(protect);

// User: create review
router.post("/", uploadMultiple("images", "reviews", 3), reviewController.createReview);
router.post("/:id/helpful", reviewController.voteHelpful);
router.delete("/:id", reviewController.deleteReview);

// Vendor: reply
router.post("/:id/reply", reviewController.replyToReview);

// Admin
router.get("/", authorize("admin", "superadmin"), reviewController.getAllReviews);
router.patch("/:id/moderate", authorize("admin", "superadmin"), reviewController.moderateReview);

module.exports = router;
