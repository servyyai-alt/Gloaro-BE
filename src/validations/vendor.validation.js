const { body, param, query } = require("express-validator");

const createVendorValidation = [
  body("businessName").trim().notEmpty().withMessage("Business name is required").isLength({ max: 200 }),
  body("ownerName").trim().notEmpty().withMessage("Owner name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Valid Indian phone number required"),
  body("businessCategory").isMongoId().withMessage("Valid business category ID required"),
  body("address.street").trim().notEmpty().withMessage("Street address is required"),
  body("address.city").trim().notEmpty().withMessage("City is required"),
  body("address.state").trim().notEmpty().withMessage("State is required"),
  body("address.pincode")
    .trim()
    .notEmpty()
    .withMessage("Pincode is required")
    .matches(/^\d{6}$/)
    .withMessage("Valid 6-digit pincode required"),
  body("gstNumber")
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage("Invalid GST number format"),
  body("panNumber")
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage("Invalid PAN number format"),
  body("website").optional().isURL().withMessage("Invalid website URL"),
];

const updateVendorValidation = [
  body("businessName").optional().trim().notEmpty().isLength({ max: 200 }),
  body("email").optional().isEmail().normalizeEmail(),
  body("phone")
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Valid Indian phone number required"),
  body("gstNumber")
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage("Invalid GST number format"),
  body("website").optional().isURL().withMessage("Invalid website URL"),
];

const approveVendorValidation = [
  param("id").isMongoId().withMessage("Invalid vendor ID"),
  body("action").isIn(["approve", "reject"]).withMessage("Action must be approve or reject"),
  body("reason")
    .if(body("action").equals("reject"))
    .notEmpty()
    .withMessage("Reason is required when rejecting"),
];

module.exports = { createVendorValidation, updateVendorValidation, approveVendorValidation };
