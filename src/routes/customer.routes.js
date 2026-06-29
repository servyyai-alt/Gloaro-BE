const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");
const customerController = require("../controllers/customer.controller");
const { protect, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

router.use(protect, authorize("customer", "user"));

router.get("/wishlist", customerController.getWishlist);

router.post(
  "/wishlist",
  [
    body("itemType").isIn(["vendor", "product", "service"]).withMessage("itemType must be vendor, product, or service"),
    body("itemId").isMongoId().withMessage("Valid itemId required"),
    body("notes").optional().isString().trim().isLength({ max: 500 }).withMessage("Notes can be up to 500 characters"),
  ],
  validate,
  customerController.addToWishlist
);

router.delete(
  "/wishlist/:itemId",
  [
    query("itemType").isIn(["vendor", "product", "service"]).withMessage("itemType query is required"),
  ],
  validate,
  customerController.removeFromWishlist
);

router.get("/enquiries", customerController.getMyEnquiries);
router.get("/events", customerController.getMyEventRegistrations);

module.exports = router;
