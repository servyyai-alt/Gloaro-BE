const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const vendorApplicationController = require("../controllers/vendorApplication.controller");
const { uploadDocumentMemoryFields, uploadMemoryDocumentsToCloudinary } = require("../config/cloudinary");
const { protect, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const parseVendorApplicationDocuments = uploadDocumentMemoryFields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "registrationCertificate", maxCount: 1 },
  { name: "gstCertificate", maxCount: 1 },
  { name: "businessLogo", maxCount: 1 },
  { name: "ownerIdProof", maxCount: 1 },
  { name: "shopPhoto", maxCount: 1 },
]);

router.use(protect);

router.get("/my-application", vendorApplicationController.getMyApplication);

router.post(
  "/my-application",
  parseVendorApplicationDocuments,
  uploadMemoryDocumentsToCloudinary("vendor-applications"),
  vendorApplicationController.saveDraft
);

router.post(
  "/my-application/submit",
  parseVendorApplicationDocuments,
  uploadMemoryDocumentsToCloudinary("vendor-applications"),
  vendorApplicationController.submitApplication
);

router.get("/", vendorApplicationController.getApplications);
router.get("/:id", vendorApplicationController.getApplicationById);
router.get("/:id/documents/:field/url", vendorApplicationController.getApplicationDocumentUrl);

router.patch(
  "/:id/status",
  [
    body("status").isIn(["pending_vp_review", "rejected_by_vp", "submitted", "under_review", "approved", "rejected"]).withMessage("Invalid status"),
    body("adminNotes").optional().isString().trim(),
  ],
  validate,
  vendorApplicationController.updateStatus
);

module.exports = router;
