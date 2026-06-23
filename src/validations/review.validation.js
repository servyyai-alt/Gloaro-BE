const { body } = require("express-validator");

const createReviewValidation = [
  body("vendor").isMongoId().withMessage("Valid vendor ID is required"),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("title").optional().trim().isLength({ max: 200 }).withMessage("Title too long"),
  body("comment")
    .trim()
    .notEmpty()
    .withMessage("Review comment is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Comment must be 10-1000 characters"),
];

const replyValidation = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Reply content is required")
    .isLength({ max: 500 })
    .withMessage("Reply cannot exceed 500 characters"),
];

module.exports = { createReviewValidation, replyValidation };
