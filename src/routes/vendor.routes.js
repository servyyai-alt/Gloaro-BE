const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendor.controller");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { uploadFields } = require("../config/cloudinary");

const vendorUpload = uploadFields(
  [{ name: "logo", maxCount: 1 }, { name: "coverImage", maxCount: 1 }],
  "vendors"
);

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Get all vendors with pagination and filters
 *     tags: [Vendors]
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
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, suspended] }
 *       - in: query
 *         name: isFeatured
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by business name or description
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, rating, name, featured] }
 *         default: createdAt
 *     responses:
 *       200:
 *         description: Vendors fetched successfully
 */
router.get("/", optionalAuth, vendorController.getVendors);

/**
 * @swagger
 * /vendors/nearby:
 *   get:
 *     summary: Get nearby vendors based on location
 *     tags: [Vendors]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *         description: Latitude
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *         description: Longitude
 *       - in: query
 *         name: distance
 *         schema: { type: number, default: 10 }
 *         description: Distance in kilometers
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Nearby vendors fetched successfully
 */
router.get("/nearby", vendorController.getNearbyVendors);

/**
 * @swagger
 * /vendors/slug/{slug}:
 *   get:
 *     summary: Get vendor by slug
 *     tags: [Vendors]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: Vendor slug
 *     responses:
 *       200:
 *         description: Vendor data
 *       404:
 *         description: Vendor not found
 */
router.get("/slug/:slug", vendorController.getVendorBySlug);

/**
 * @swagger
 * /vendors/{id}:
 *   get:
 *     summary: Get vendor by ID
 *     tags: [Vendors]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor data
 *       404:
 *         description: Vendor not found
 */
router.get("/:id", vendorController.getVendorById);

router.use(protect);

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Create a new vendor profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *               - ownerName
 *               - email
 *               - phone
 *               - businessCategory
 *             properties:
 *               businessName: { type: string }
 *               ownerName: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               alternatePhone: { type: string }
 *               description: { type: string }
 *               shortDescription: { type: string }
 *               businessCategory: { type: string }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               gstNumber: { type: string }
 *               panNumber: { type: string }
 *               address[street]: { type: string }
 *               address[city]: { type: string }
 *               address[state]: { type: string }
 *               address[pincode]: { type: string }
 *               website: { type: string }
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Business logo (max 5MB)
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: Cover image (max 5MB)
 *     responses:
 *       201:
 *         description: Vendor created successfully
 *       401:
 *         description: Not authenticated
 */
router.post("/", vendorUpload, vendorController.createVendor);

/**
 * @swagger
 * /vendors/me/profile:
 *   get:
 *     summary: Get own vendor profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor profile data
 *       404:
 *         description: No vendor profile found
 */
router.get("/me/profile", vendorController.getMyProfile);

/**
 * @swagger
 * /vendors/{id}:
 *   patch:
 *     summary: Update vendor profile
 *     tags: [Vendors]
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
 *               businessName: { type: string }
 *               description: { type: string }
 *               shortDescription: { type: string }
 *               phone: { type: string }
 *               website: { type: string }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               address[street]: { type: string }
 *               address[city]: { type: string }
 *               address[state]: { type: string }
 *               address[pincode]: { type: string }
 *               logo:
 *                 type: string
 *                 format: binary
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Vendor updated successfully
 */
router.patch("/:id", vendorUpload, vendorController.updateVendor);

/**
 * @swagger
 * /vendors/{id}:
 *   delete:
 *     summary: Delete vendor profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vendor deleted successfully
 */
router.delete("/:id", vendorController.deleteVendor);

/**
 * @swagger
 * /vendors/{id}/approve:
 *   patch:
 *     summary: Approve or reject vendor (Admin only)
 *     tags: [Vendors]
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
 *         description: Vendor status updated
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/approve", authorize("admin", "superadmin"), vendorController.approveVendor);

/**
 * @swagger
 * /vendors/{id}/feature:
 *   patch:
 *     summary: Toggle featured status for vendor (Admin only)
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vendor featured status updated
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/feature", authorize("admin", "superadmin"), vendorController.featureVendor);

module.exports = router;
