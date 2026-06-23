const { body } = require("express-validator");

const createProductValidation = [
  body("title").trim().notEmpty().withMessage("Product title is required").isLength({ max: 300 }),
  body("category").isMongoId().withMessage("Valid category ID is required"),
  body("pricing.mrp")
    .notEmpty()
    .withMessage("MRP is required")
    .isFloat({ min: 0 })
    .withMessage("MRP must be a positive number"),
  body("pricing.sellingPrice")
    .notEmpty()
    .withMessage("Selling price is required")
    .isFloat({ min: 0 })
    .withMessage("Selling price must be a positive number")
    .custom((val, { req }) => {
      if (parseFloat(val) > parseFloat(req.body.pricing?.mrp)) {
        throw new Error("Selling price cannot exceed MRP");
      }
      return true;
    }),
  body("inventory.quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),
];

const updateProductValidation = [
  body("title").optional().trim().notEmpty().isLength({ max: 300 }),
  body("pricing.mrp").optional().isFloat({ min: 0 }),
  body("pricing.sellingPrice").optional().isFloat({ min: 0 }),
  body("inventory.quantity").optional().isInt({ min: 0 }),
];

module.exports = { createProductValidation, updateProductValidation };
