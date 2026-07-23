const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const { protect, authorize } = require("../middleware/auth");

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [business, product, service] }
 *         description: Filter by category type
 *       - in: query
 *         name: parent
 *         schema: { type: string }
 *         description: Filter by parent category ID
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Categories fetched successfully
 */
router.get("/", categoryController.getCategories);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category data
 *       404:
 *         description: Category not found
 */
router.get("/:id", categoryController.getCategoryById);

router.use(protect, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryInput'
 *     responses:
 *       201:
 *         description: Category created successfully
 *       403:
 *         description: Not authorized
 */
router.post("/", categoryController.createCategory);

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Update category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryInput'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id", categoryController.updateCategory);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       403:
 *         description: Not authorized
 */
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
