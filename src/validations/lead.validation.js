const { ROLES } = require("../constants/roleConfig");
const { body } = require("express-validator");

const submitLeadValidation = [
  body(ROLES.VENDOR).isMongoId().withMessage("Valid vendor ID is required"),
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
  body("email").optional().isEmail().withMessage("Invalid email format").normalizeEmail(),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Valid 10-digit Indian phone number required"),
  body("subject").trim().notEmpty().withMessage("Subject is required").isLength({ max: 200 }),
  body("message").trim().notEmpty().withMessage("Message is required").isLength({ max: 1000 }),
  body("budget.min").optional().isFloat({ min: 0 }).withMessage("Budget min must be positive"),
  body("budget.max")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget max must be positive")
    .custom((val, { req }) => {
      if (req.body.budget?.min && parseFloat(val) < parseFloat(req.body.budget.min)) {
        throw new Error("Budget max must be >= min");
      }
      return true;
    }),
];

const updateLeadStatusValidation = [
  body("status")
    .isIn(["new", "contacted", "qualified", "proposal_sent", "won", "lost"])
    .withMessage("Invalid lead status"),
];

module.exports = { submitLeadValidation, updateLeadStatusValidation };
