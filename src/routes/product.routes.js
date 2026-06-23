const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by category ID
 *       - in: query
 *         name: vendor
 *         schema: { type: string }
 *         description: Filter by vendor ID
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title or description
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, price, rating, name] }
 *         default: createdAt
 *     responses:
 *       200:
 *         description: Products fetched successfully
 */
router.get("/", productController.getProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product data
 *       404:
 *         description: Product not found
 */
router.get("/:id", productController.getProductById);

router.use(protect);

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product (Vendor only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - category
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               shortDescription: { type: string }
 *               category: { type: string }
 *               sku: { type: string }
 *               pricing[mrp]: { type: number }
 *               pricing[sellingPrice]: { type: number }
 *               pricing[costPrice]: { type: number }
 *               pricing[currency]: { type: string, default: INR }
 *               pricing[taxPercent]: { type: number }
 *               inventory[quantity]: { type: integer }
 *               inventory[unit]: { type: string }
 *               inventory[lowStockAlert]: { type: integer }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 *       403:
 *         description: Not authorized (vendor only)
 */
router.post("/", authorize("vendor"), uploadMultiple("images", "products"), productController.createProduct);

/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Update a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               pricing[mrp]: { type: number }
 *               pricing[sellingPrice]: { type: number }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.patch("/:id", uploadMultiple("images", "products"), productController.updateProduct);

/**
 * @swagger
 * /products/{id}/inventory:
 *   patch:
 *     summary: Update product inventory
 *     tags: [Products]
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
 *             type: object
 *             properties:
 *               quantity: { type: integer }
 *               lowStockAlert: { type: integer }
 *               isUnlimited: { type: boolean }
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 */
router.patch("/:id/inventory", productController.updateInventory);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deleted successfully
 */
router.delete("/:id", productController.deleteProduct);

/**
 * @swagger
 * /products/{id}/approve:
 *   patch:
 *     summary: Approve or reject a product (Admin only)
 *     tags: [Products]
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
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               rejectedReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product status updated
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/approve", authorize("admin", "superadmin"), productController.approveProduct);

module.exports = router;
