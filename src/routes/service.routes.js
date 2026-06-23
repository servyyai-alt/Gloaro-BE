const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/service.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

// Public routes
router.get("/", serviceController.getServices);
router.get("/:id", serviceController.getServiceById);
router.get("/vendor/:vendorId", serviceController.getVendorServices);

// Vendor routes
router.use(protect);
router.post("/", authorize("vendor"), uploadMultiple("gallery", "services"), serviceController.createService);
router.patch("/:id", uploadMultiple("gallery", "services"), serviceController.updateService);
router.delete("/:id", serviceController.deleteService);

// Admin-only routes
router.patch("/:id/approve", authorize("admin", "superadmin"), serviceController.approveService);

module.exports = router;
