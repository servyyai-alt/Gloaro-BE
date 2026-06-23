const express = require("express");
const router = express.Router();
const leadController = require("../controllers/lead.controller");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

// Public: submit enquiry (optional auth)
router.post(
  "/",
  optionalAuth,
  [
    body("vendor").notEmpty().withMessage("Vendor ID required"),
    body("name").trim().notEmpty().withMessage("Name required"),
    body("phone").notEmpty().withMessage("Phone required"),
    body("subject").notEmpty().withMessage("Subject required"),
    body("message").notEmpty().withMessage("Message required"),
  ],
  validate,
  leadController.submitLead
);

// Protected routes
router.use(protect);

router.get("/", leadController.getLeads);
router.get("/analytics", leadController.getLeadAnalytics);
router.get("/:id", leadController.getLeadById);
router.patch("/:id/status", leadController.updateLeadStatus);
router.post("/:id/notes", leadController.addNote);
router.post("/:id/followups", leadController.scheduleFollowUp);
router.patch("/:id/assign", authorize("admin", "superadmin"), leadController.assignLead);

module.exports = router;
