const fs = require("fs");
const path = require("path");

const routesDir = path.join(__dirname, "..", "src", "routes");

const routeFiles = {
  "user.routes.js": `const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get("/profile", userController.updateProfile);

/**
 * @swagger
 * /users/profile:
 *   patch:
 *     summary: Update current user profile (with avatar upload)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture (jpg, jpeg, png, webp) max 5MB
 *               address[street]:
 *                 type: string
 *               address[city]:
 *                 type: string
 *               address[state]:
 *                 type: string
 *               address[country]:
 *                 type: string
 *               address[pincode]:
 *                 type: string
 *               preferences[emailNotifications]:
 *                 type: boolean
 *               preferences[smsNotifications]:
 *                 type: boolean
 *               preferences[pushNotifications]:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Not authenticated
 */
router.patch("/profile", uploadSingle("avatar", "avatars"), userController.updateProfile);

/**
 * @swagger
 * /users/activity:
 *   get:
 *     summary: Get current user activity logs
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User activity logs retrieved successfully
 */
router.get("/activity", async (req, res, next) => {
  req.params.id = req.user._id.toString();
  userController.getUserActivityLogs(req, res, next);
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *       403:
 *         description: Not authorized (admin only)
 */
router.get("/", authorize("admin", "superadmin"), userController.getUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data fetched successfully
 *       404:
 *         description: User not found
 */
router.get("/:id", userController.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user by ID (Admin only)
 *     tags: [Users]
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
 *               name: { type: string }
 *               phone: { type: string }
 *               role:
 *                 type: string
 *                 enum: [user, vendor, admin, superadmin]
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id", uploadSingle("avatar", "avatars"), userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user by ID (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Not authorized
 */
router.delete("/:id", userController.deleteUser);

/**
 * @swagger
 * /users/{id}/suspend:
 *   patch:
 *     summary: Suspend a user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User suspended successfully
 */
router.patch("/:id/suspend", userController.suspendUser);

/**
 * @swagger
 * /users/{id}/unsuspend:
 *   patch:
 *     summary: Unsuspend a user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User unsuspended successfully
 */
router.patch("/:id/unsuspend", userController.unsuspendUser);

/**
 * @swagger
 * /users/{id}/block:
 *   patch:
 *     summary: Block a user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User blocked successfully
 */
router.patch("/:id/block", userController.blockUser);

/**
 * @swagger
 * /users/{id}/unblock:
 *   patch:
 *     summary: Unblock a user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User unblocked successfully
 */
router.patch("/:id/unblock", userController.unblockUser);

/**
 * @swagger
 * /users/{id}/activity:
 *   get:
 *     summary: Get user activity logs (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Activity logs fetched successfully
 */
router.get("/:id/activity", userController.getUserActivityLogs);

module.exports = router;
`,

  "vendor.routes.js": `const express = require("express");
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
`,

  "category.routes.js": `const express = require("express");
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

router.use(protect, authorize("admin", "superadmin"));

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
`,

  "service.routes.js": `const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/service.controller");
const { protect, authorize } = require("../middleware/auth");
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
router.get("/", serviceController.getServices);

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
`,

  "product.routes.js": `const express = require("express");
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
`,

  "payment.routes.js": `const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { protect, authorize } = require("../middleware/auth");

/**
 * @swagger
 * /payments/webhook/stripe:
 *   post:
 *     summary: Stripe webhook endpoint (raw body)
 *     tags: [Payments]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook
);

router.use(protect);

/**
 * @swagger
 * /payments/razorpay/order:
 *   post:
 *     summary: Create a Razorpay order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RazorpayOrderInput'
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: order_xxxxxxxxx
 *                         amount:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         status:
 *                           type: string
 */
router.post("/razorpay/order", paymentController.createRazorpayOrder);

/**
 * @swagger
 * /payments/razorpay/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_payment_id
 *               - razorpay_order_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Payment verification failed
 */
router.post("/razorpay/verify", paymentController.verifyRazorpayPayment);

/**
 * @swagger
 * /payments/stripe/intent:
 *   post:
 *     summary: Create Stripe payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StripePaymentIntentInput'
 *     responses:
 *       200:
 *         description: Payment intent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                     paymentIntent:
 *                       type: object
 */
router.post("/stripe/intent", paymentController.createStripePaymentIntent);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: gateway
 *         schema: { type: string, enum: [razorpay, stripe] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, completed, failed, refunded] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [membership, featured_listing, event_registration, other] }
 *     responses:
 *       200:
 *         description: Payments fetched successfully
 */
router.get("/", paymentController.getPayments);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment data
 *       404:
 *         description: Payment not found
 */
router.get("/:id", paymentController.getPaymentById);

/**
 * @swagger
 * /payments/{id}/refund:
 *   post:
 *     summary: Request a refund for a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed successfully
 */
router.post("/:id/refund", paymentController.requestRefund);

module.exports = router;
`,

  "lead.routes.js": `const express = require("express");
const router = express.Router();
const leadController = require("../controllers/lead.controller");
const { protect, authorize, optionalAuth } = require("../middleware/auth");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

/**
 * @swagger
 * /leads:
 *   post:
 *     summary: Submit a new lead/enquiry (Public)
 *     tags: [Leads]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeadInput'
 *     responses:
 *       201:
 *         description: Lead submitted successfully
 *       422:
 *         description: Validation error
 */
router.post(
  "/",
  optionalAuth,
  [
    body("vendor").notEmpty().withMessage("Vendor ID required"),
    body("name").trim().notEmpty().withMessage("Name required"),
    body("phone").notEmpty().withMessage("Phone required"),
    body("subject").notEmpty().withMessage("Subject required"),
    body("message").notEmpty().withMessage("Message required"),
  ],
  validate,
  leadController.submitLead
);

router.use(protect);

/**
 * @swagger
 * /leads:
 *   get:
 *     summary: Get leads for current vendor or all (Admin)
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [new, contacted, qualified, proposal_sent, won, lost] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, urgent] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *     responses:
 *       200:
 *         description: Leads fetched successfully
 */
router.get("/", leadController.getLeads);

/**
 * @swagger
 * /leads/analytics:
 *   get:
 *     summary: Get lead analytics and statistics
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lead analytics data
 */
router.get("/analytics", leadController.getLeadAnalytics);

/**
 * @swagger
 * /leads/{id}:
 *   get:
 *     summary: Get lead by ID
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead data
 *       404:
 *         description: Lead not found
 */
router.get("/:id", leadController.getLeadById);

/**
 * @swagger
 * /leads/{id}/status:
 *   patch:
 *     summary: Update lead status
 *     tags: [Leads]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [new, contacted, qualified, proposal_sent, won, lost]
 *     responses:
 *       200:
 *         description: Lead status updated
 */
router.patch("/:id/status", leadController.updateLeadStatus);

/**
 * @swagger
 * /leads/{id}/notes:
 *   post:
 *     summary: Add internal note to a lead
 *     tags: [Leads]
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
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               isInternal:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Note added successfully
 */
router.post("/:id/notes", leadController.addNote);

/**
 * @swagger
 * /leads/{id}/followups:
 *   post:
 *     summary: Schedule a follow-up for a lead
 *     tags: [Leads]
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
 *             required:
 *               - scheduledAt
 *               - type
 *             properties:
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *                 enum: [call, email, meeting, other]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Follow-up scheduled successfully
 */
router.post("/:id/followups", leadController.scheduleFollowUp);

/**
 * @swagger
 * /leads/{id}/assign:
 *   patch:
 *     summary: Assign lead to a user (Admin only)
 *     tags: [Leads]
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
 *             required:
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 description: User ID to assign the lead to
 *     responses:
 *       200:
 *         description: Lead assigned successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/assign", authorize("admin", "superadmin"), leadController.assignLead);

module.exports = router;
`,

  "membership.routes.js": `const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membership.controller");
const { protect, authorize } = require("../middleware/auth");

/**
 * @swagger
 * /memberships/plans:
 *   get:
 *     summary: Get all membership plans (Public)
 *     tags: [Memberships]
 *     security: []
 *     responses:
 *       200:
 *         description: Membership plans fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MembershipPlan'
 */
router.get("/plans", membershipController.getPlans);

router.use(protect);

/**
 * @swagger
 * /memberships/purchase:
 *   post:
 *     summary: Purchase a membership plan
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MembershipPurchaseInput'
 *     responses:
 *       201:
 *         description: Membership purchased successfully
 *       400:
 *         description: Invalid plan or payment
 */
router.post("/purchase", membershipController.purchaseMembership);

/**
 * @swagger
 * /memberships/my:
 *   get:
 *     summary: Get current user/vendor membership
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current membership data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Membership'
 */
router.get("/my", membershipController.getMyMembership);

/**
 * @swagger
 * /memberships/my/history:
 *   get:
 *     summary: Get membership purchase history
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership history fetched successfully
 */
router.get("/my/history", membershipController.getMembershipHistory);

/**
 * @swagger
 * /memberships/my/cancel:
 *   patch:
 *     summary: Cancel current membership
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Membership cancelled successfully
 */
router.patch("/my/cancel", membershipController.cancelMembership);

router.use(authorize("admin", "superadmin"));

/**
 * @swagger
 * /memberships:
 *   get:
 *     summary: Get all memberships (Admin only)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All memberships fetched successfully
 */
router.get("/", membershipController.getAllMemberships);

/**
 * @swagger
 * /memberships/plans:
 *   post:
 *     summary: Create a new membership plan (Admin only)
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 enum: [silver, gold, platinum]
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: object
 *                 properties:
 *                   monthly:
 *                     type: number
 *                   yearly:
 *                     type: number
 *               limits:
 *                 type: object
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       403:
 *         description: Not authorized
 */
router.post("/plans", membershipController.createPlan);

/**
 * @swagger
 * /memberships/plans/{id}:
 *   patch:
 *     summary: Update a membership plan (Admin only)
 *     tags: [Memberships]
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
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/plans/:id", membershipController.updatePlan);

module.exports = router;
`,

  "review.routes.js": `const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

/**
 * @swagger
 * /reviews/vendor/{vendorId}:
 *   get:
 *     summary: Get all reviews for a vendor (Public)
 *     tags: [Reviews]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: rating
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *         description: Filter by rating
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: -createdAt }
 *     responses:
 *       200:
 *         description: Vendor reviews fetched successfully
 */
router.get("/vendor/:vendorId", reviewController.getVendorReviews);

router.use(protect);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a review for a vendor/product/service
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ReviewInput'
 *     responses:
 *       201:
 *         description: Review created successfully
 *       422:
 *         description: Validation error
 */
router.post("/", uploadMultiple("images", "reviews", 3), reviewController.createReview);

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     summary: Mark a review as helpful
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review marked as helpful
 */
router.post("/:id/helpful", reviewController.voteHelpful);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review deleted successfully
 */
router.delete("/:id", reviewController.deleteReview);

/**
 * @swagger
 * /reviews/{id}/reply:
 *   post:
 *     summary: Reply to a review (Vendor only)
 *     tags: [Reviews]
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
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply added successfully
 */
router.post("/:id/reply", reviewController.replyToReview);

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Get all reviews (Admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, spam] }
 *     responses:
 *       200:
 *         description: Reviews fetched successfully
 *       403:
 *         description: Not authorized
 */
router.get("/", authorize("admin", "superadmin"), reviewController.getAllReviews);

/**
 * @swagger
 * /reviews/{id}/moderate:
 *   patch:
 *     summary: Moderate a review (Admin only)
 *     tags: [Reviews]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, spam]
 *               rejectedReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review moderated successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/moderate", authorize("admin", "superadmin"), reviewController.moderateReview);

module.exports = router;
`,

  "event.routes.js": `const express = require("express");
const router = express.Router();
const eventController = require("../controllers/event.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");

/**
 * @swagger
 * /events:
 *   get:
 *     summary: Get all events (Public)
 *     tags: [Events]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [online, offline, hybrid] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, cancelled, completed] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title or description
 *       - in: query
 *         name: isFeatured
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Events fetched successfully
 */
router.get("/", eventController.getEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event by ID (Public)
 *     tags: [Events]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event data
 *       404:
 *         description: Event not found
 */
router.get("/:id", eventController.getEventById);

router.use(protect);

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/EventInput'
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Event created successfully
 */
router.post("/", uploadSingle("coverImage", "events"), eventController.createEvent);

/**
 * @swagger
 * /events/{id}:
 *   patch:
 *     summary: Update an event
 *     tags: [Events]
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
 *             $ref: '#/components/schemas/EventInput'
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Event updated successfully
 */
router.patch("/:id", uploadSingle("coverImage", "events"), eventController.updateEvent);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event deleted successfully
 */
router.delete("/:id", eventController.deleteEvent);

/**
 * @swagger
 * /events/{id}/register:
 *   post:
 *     summary: Register for an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Registration successful
 *       400:
 *         description: Registration failed (event full, already registered, etc.)
 */
router.post("/:id/register", eventController.registerForEvent);

/**
 * @swagger
 * /events/{id}/register:
 *   delete:
 *     summary: Cancel event registration
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Registration cancelled successfully
 */
router.delete("/:id/register", eventController.cancelRegistration);

module.exports = router;
`,

  "referral.routes.js": `const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referral.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/**
 * @swagger
 * /referrals/my:
 *   get:
 *     summary: Get my referrals
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referrals fetched successfully
 */
router.get("/my", referralController.getMyReferrals);

/**
 * @swagger
 * /referrals/my/code:
 *   get:
 *     summary: Get my referral code
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code fetched successfully
 */
router.get("/my/code", referralController.getMyReferralCode);

/**
 * @swagger
 * /referrals/my/stats:
 *   get:
 *     summary: Get my referral statistics
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral stats fetched successfully
 */
router.get("/my/stats", referralController.getReferralStats);

/**
 * @swagger
 * /referrals:
 *   get:
 *     summary: Get all referrals (Admin only)
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All referrals fetched successfully
 *       403:
 *         description: Not authorized
 */
router.get("/", authorize("admin", "superadmin"), referralController.getAllReferrals);

/**
 * @swagger
 * /referrals/{id}/reward:
 *   patch:
 *     summary: Process referral reward (Admin only)
 *     tags: [Referrals]
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
 *               type:
 *                 type: string
 *                 enum: [cash, discount, credits]
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Reward processed successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/reward", authorize("admin", "superadmin"), referralController.processReferralReward);

module.exports = router;
`,

  "notification.routes.js": `const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get my notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *         description: Filter by notification type
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
 */
router.get("/", notificationController.getNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get count of unread notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
 */
router.get("/unread-count", notificationController.getUnreadCount);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch("/read-all", notificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch("/:id/read", notificationController.markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 */
router.delete("/:id", notificationController.deleteNotification);

/**
 * @swagger
 * /notifications/broadcast:
 *   post:
 *     summary: Send broadcast notification to all users (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationBroadcastInput'
 *     responses:
 *       201:
 *         description: Broadcast sent successfully
 *       403:
 *         description: Not authorized
 */
router.post("/broadcast", authorize("admin", "superadmin"), notificationController.sendBroadcast);

module.exports = router;
`,

  "report.routes.js": `const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin", "superadmin"));

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     summary: Get dashboard summary (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *       403:
 *         description: Not authorized
 */
router.get("/dashboard", reportController.getDashboardSummary);

/**
 * @swagger
 * /reports/users:
 *   get:
 *     summary: Get user report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month] }
 *     responses:
 *       200:
 *         description: User report data
 */
router.get("/users", reportController.getUserReport);

/**
 * @swagger
 * /reports/vendors:
 *   get:
 *     summary: Get vendor report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month] }
 *     responses:
 *       200:
 *         description: Vendor report data
 */
router.get("/vendors", reportController.getVendorReport);

/**
 * @swagger
 * /reports/revenue:
 *   get:
 *     summary: Get revenue report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, year] }
 *     responses:
 *       200:
 *         description: Revenue report data
 */
router.get("/revenue", reportController.getRevenueReport);

/**
 * @swagger
 * /reports/memberships:
 *   get:
 *     summary: Get membership report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership report data
 */
router.get("/memberships", reportController.getMembershipReport);

/**
 * @swagger
 * /reports/leads:
 *   get:
 *     summary: Get leads report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leads report data
 */
router.get("/leads", reportController.getLeadReport);

/**
 * @swagger
 * /reports/products:
 *   get:
 *     summary: Get products report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products report data
 */
router.get("/products", reportController.getProductReport);

/**
 * @swagger
 * /reports/services:
 *   get:
 *     summary: Get services report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Services report data
 */
router.get("/services", reportController.getServiceReport);

/**
 * @swagger
 * /reports/events:
 *   get:
 *     summary: Get events report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Events report data
 */
router.get("/events", reportController.getEventReport);

module.exports = router;
`,

  "support.routes.js": `const express = require("express");
const router = express.Router();
const supportController = require("../controllers/support.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

router.use(protect);

/**
 * @swagger
 * /support:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/SupportTicketInput'
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Support ticket created successfully
 *       422:
 *         description: Validation error
 */
router.post("/", uploadMultiple("attachments", "support", 5), supportController.createTicket);

/**
 * @swagger
 * /support/my:
 *   get:
 *     summary: Get my support tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, in_progress, waiting_for_user, resolved, closed] }
 *     responses:
 *       200:
 *         description: Support tickets fetched successfully
 */
router.get("/my", supportController.getMyTickets);

/**
 * @swagger
 * /support/{id}:
 *   get:
 *     summary: Get a support ticket by ID
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket data
 *       404:
 *         description: Ticket not found
 */
router.get("/:id", supportController.getTicketById);

/**
 * @swagger
 * /support/{id}/reply:
 *   post:
 *     summary: Reply to a support ticket
 *     tags: [Support]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Reply added successfully
 */
router.post("/:id/reply", uploadMultiple("attachments", "support", 3), supportController.replyToTicket);

/**
 * @swagger
 * /support/{id}/close:
 *   patch:
 *     summary: Close a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket closed successfully
 */
router.patch("/:id/close", supportController.closeTicket);

/**
 * @swagger
 * /support:
 *   get:
 *     summary: Get all support tickets (Admin only)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, in_progress, waiting_for_user, resolved, closed] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [billing, technical, account, vendor, general, other] }
 *     responses:
 *       200:
 *         description: All tickets fetched successfully
 *       403:
 *         description: Not authorized
 */
router.get("/", authorize("admin", "superadmin"), supportController.getAllTickets);

/**
 * @swagger
 * /support/{id}/assign:
 *   patch:
 *     summary: Assign a support ticket to staff (Admin only)
 *     tags: [Support]
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
 *             required:
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket assigned successfully
 *       403:
 *         description: Not authorized
 */
router.patch("/:id/assign", authorize("admin", "superadmin"), supportController.assignTicket);

module.exports = router;
`,

  "directory.routes.js": `const express = require("express");
const router = express.Router();
const directoryController = require("../controllers/directory.controller");

/**
 * @swagger
 * /directory/search:
 *   get:
 *     summary: Search directory listings (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *         description: Comma-separated tags
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Search results
 */
router.get("/search", directoryController.searchDirectory);

/**
 * @swagger
 * /directory/featured:
 *   get:
 *     summary: Get featured listings (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Featured listings
 */
router.get("/featured", directoryController.getFeaturedListings);

/**
 * @swagger
 * /directory/nearby:
 *   get:
 *     summary: Get nearby listings (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: distance
 *         schema: { type: number, default: 10 }
 *         description: Distance in km
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Nearby listings
 */
router.get("/nearby", directoryController.getNearbyVendors);

/**
 * @swagger
 * /directory/filters:
 *   get:
 *     summary: Get directory filter options (Public)
 *     tags: [Directory]
 *     security: []
 *     responses:
 *       200:
 *         description: Filter options (categories, cities, states)
 */
router.get("/filters", directoryController.getDirectoryFilters);

/**
 * @swagger
 * /directory/global-search:
 *   get:
 *     summary: Global search across vendors, products, services, events (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [vendors, products, services, events, all] }
 *         default: all
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Global search results
 */
router.get("/global-search", directoryController.globalSearch);

module.exports = router;
`,

  "admin.routes.js": `const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin", "superadmin"));

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *       403:
 *         description: Not authorized
 */
router.get("/dashboard", adminController.getDashboard);

/**
 * @swagger
 * /admin/pending-approvals:
 *   get:
 *     summary: Get all pending approvals (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending approvals (vendors, products, services, reviews)
 *       403:
 *         description: Not authorized
 */
router.get("/pending-approvals", adminController.getPendingApprovals);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Get audit logs (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit logs
 *       403:
 *         description: Not authorized
 */
router.get("/audit-logs", adminController.getAuditLogs);

/**
 * @swagger
 * /admin/system-stats:
 *   get:
 *     summary: Get system statistics (Superadmin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 *       403:
 *         description: Not authorized (superadmin only)
 */
router.get("/system-stats", authorize("superadmin"), adminController.getSystemStats);

/**
 * @swagger
 * /admin/create-admin:
 *   post:
 *     summary: Create a new admin user (Superadmin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, superadmin]
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       403:
 *         description: Not authorized
 */
router.post("/create-admin", authorize("superadmin"), adminController.createAdmin);

module.exports = router;
`
};

// Write all route files
Object.entries(routeFiles).forEach(([filename, content]) => {
  const filePath = path.join(routesDir, filename);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`✅ Written: ${filename}`);
});

console.log("\n✅ All route files updated with Swagger annotations!");