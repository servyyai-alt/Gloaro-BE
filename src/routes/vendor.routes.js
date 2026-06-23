const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendor.controller");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { uploadFields } = require("../config/cloudinary");

const vendorUpload = uploadFields(
  [{ name: "logo", maxCount: 1 }, { name: "coverImage", maxCount: 1 }],
  "vendors"
);

// Public routes
router.get("/", optionalAuth, vendorController.getVendors);
router.get("/nearby", vendorController.getNearbyVendors);
router.get("/slug/:slug", vendorController.getVendorBySlug);
router.get("/:id", vendorController.getVendorById);

// Authenticated routes
router.use(protect);

router.post("/", vendorUpload, vendorController.createVendor);
router.get("/me/profile", vendorController.getMyProfile);
router.patch("/:id", vendorUpload, vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

// Admin-only routes
router.patch("/:id/approve", authorize("admin", "superadmin"), vendorController.approveVendor);
router.patch("/:id/feature", authorize("admin", "superadmin"), vendorController.featureVendor);

module.exports = router;
