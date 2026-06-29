const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect, authorize } = require("../middleware/auth");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");

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
const notificationBodyValidation = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("message").trim().notEmpty().withMessage("Message is required"),
  body("type").optional().isString().trim(),
  body("priority").optional().isIn(["low", "normal", "high"]).withMessage("Invalid priority"),
];

router.post(
  "/broadcast",
  authorize("admin", "superadmin"),
  notificationBodyValidation,
  validate,
  notificationController.sendBroadcast
);
router.post(
  "/users/:userId",
  authorize("admin", "superadmin"),
  notificationBodyValidation,
  validate,
  notificationController.sendUserNotification
);
router.post(
  "/vendors/:vendorId",
  authorize("admin", "superadmin"),
  notificationBodyValidation,
  validate,
  notificationController.sendVendorNotification
);

module.exports = router;
