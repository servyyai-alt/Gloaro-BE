const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

// Public routes
router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);

// Vendor routes
router.use(protect);
router.post("/", authorize("vendor"), uploadMultiple("images", "products"), productController.createProduct);
router.patch("/:id", uploadMultiple("images", "products"), productController.updateProduct);
router.patch("/:id/inventory", productController.updateInventory);
router.delete("/:id", productController.deleteProduct);

// Admin-only routes
router.patch("/:id/approve", authorize("admin", "superadmin"), productController.approveProduct);

module.exports = router;
