const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const membershipApplicationController = require("../controllers/membershipApplication.controller");
const { uploadDocumentMemoryFields, uploadMemoryDocumentsToCloudinary } = require("../config/cloudinary");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const parseApplicationDocuments = uploadDocumentMemoryFields(
  [
    { name: "profilePhoto", maxCount: 1 },
    { name: "registrationCertificate", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
    { name: "companyProfile", maxCount: 1 },
    { name: "visitingCard", maxCount: 1 },
  ],
  "membership-applications"
);

router.post(
  "/",
  optionalAuth,
  parseApplicationDocuments,
  uploadMemoryDocumentsToCloudinary("membership-applications"),
  membershipApplicationController.createApplication
);
router.get("/track", membershipApplicationController.trackApplication);

router.use(protect, authorize("admin", "superadmin"));

router.get("/", membershipApplicationController.getApplications);
router.get("/:id/documents/:field/url", membershipApplicationController.getApplicationDocumentUrl);
router.get("/:id", membershipApplicationController.getApplicationById);
router.patch(
  "/:id/status",
  [
    body("status").isIn(["submitted", "under_review", "approved", "rejected"]).withMessage("Invalid status"),
    body("adminNotes").optional().isString(),
  ],
  validate,
  membershipApplicationController.updateApplicationStatus
);

module.exports = router;
