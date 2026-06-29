const express = require("express");
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
router.get("/profile", userController.getProfile);

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
router.get("/:id", authorize("admin", "superadmin"), userController.getUserById);

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
router.patch("/:id", authorize("admin", "superadmin"), uploadSingle("avatar", "avatars"), userController.updateUser);

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
router.delete("/:id", authorize("admin", "superadmin"), userController.deleteUser);

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
router.patch("/:id/suspend", authorize("admin", "superadmin"), userController.suspendUser);

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
router.patch("/:id/unsuspend", authorize("admin", "superadmin"), userController.unsuspendUser);

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
router.patch("/:id/block", authorize("admin", "superadmin"), userController.blockUser);

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
router.patch("/:id/unblock", authorize("admin", "superadmin"), userController.unblockUser);

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
router.get("/:id/activity", authorize("admin", "superadmin"), userController.getUserActivityLogs);

module.exports = router;
