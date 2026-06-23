const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.get("/", categoryController.getCategories);
router.get("/:id", categoryController.getCategoryById);

// Admin-only routes
router.use(protect, authorize("admin", "superadmin"));
router.post("/", categoryController.createCategory);
router.patch("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
