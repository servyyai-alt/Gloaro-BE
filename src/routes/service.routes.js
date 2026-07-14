const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/service.controller");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

/**
 * @swagger
 * /services:
 *   get:
 *     summary: Get all services
 *     tags: [Services]
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
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title or description
 *     responses:
 *       200:
 *         description: Services fetched successfully
 */
router.get("/", optionalAuth, serviceController.getServices);

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     summary: Get service by ID
 *     tags: [Services]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Service data
 *       404:
 *         description: Service not found
 */
router.get("/:id", serviceController.getServiceById);

/**
 * @swagger
 * /services/vendor/{vendorId}:
 *   get:
 *     summary: Get all services for a specific vendor
 *     tags: [Services]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema: { type: string }
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor services fetched successfully
 */
router.get("/vendor/:vendorId", serviceController.getVendorServices);

router.use(protect);

/**
 * @swagger
 * /services:
 *   post:
 *     summary: Create a new service (Vendor only)
 *     tags: [Services]
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
 *               - description
 *               - category
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               shortDescription: { type: string }
 *               category: { type: string }
 *               pricing[type]:
 *                 type: string
 *                 enum: [fixed, hourly, custom, range]
 *               pricing[minPrice]: { type: number }
 *               pricing[maxPrice]: { type: number }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               features:
 *                 type: array
 *                 items: { type: string }
 *               deliveryTime: { type: string }
 *               gallery:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Service created successfully
 *       403:
 *         description: Not authorized (vendor only)
 */
router.post("/", authorize("vendor"), uploadMultiple("gallery", "services"), serviceController.createService);

/**
 * @swagger
 * /services/{id}:
 *   patch:
 *     summary: Update a service
 *     tags: [Services]
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
 *               shortDescription: { type: string }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               features:
 *                 type: array
 *                 items: { type: string }
 *               gallery:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Service updated successfully
 */
router.patch("/:id", uploadMultiple("gallery", "services"), serviceController.updateService);

/**
 * @swagger
 * /services/{id}:
 *   delete:
 *     summary: Delete a service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Service deleted successfully
 */
router.delete("/:id", serviceController.deleteService);

/**
 * @swagger
 * /services/{id}/approve:
 *   patch:
 *     summary: Approve or reject a service (Admin only)
 *     tags: [Services]
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
 *         description: Service status updated
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/approve", authorize("admin", "superadmin"), serviceController.approveService);

module.exports = router;
