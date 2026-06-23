const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

// Admin broadcast
router.post("/broadcast", authorize("admin", "superadmin"), notificationController.sendBroadcast);

module.exports = router;
