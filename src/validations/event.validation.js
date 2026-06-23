const { body } = require("express-validator");

const createEventValidation = [
  body("title").trim().notEmpty().withMessage("Event title is required").isLength({ max: 200 }),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("type").isIn(["online", "offline", "hybrid"]).withMessage("Invalid event type"),
  body("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Invalid start date format")
    .custom((val) => {
      if (new Date(val) < new Date()) throw new Error("Start date must be in the future");
      return true;
    }),
  body("endDate")
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("Invalid end date format")
    .custom((val, { req }) => {
      if (new Date(val) <= new Date(req.body.startDate)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
  body("registration.maxAttendees")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max attendees must be at least 1"),
  body("registration.price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be non-negative"),
];

module.exports = { createEventValidation };
