const Notification = require("../models/Notification");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { recipient: req.user._id };
  if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === "true";
  if (req.query.type) filter.type = req.query.type;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort("-createdAt").skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  paginatedResponse(res, notifications, page, limit, total, "Notifications retrieved");
});

exports.markAsRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() }
  );
  successResponse(res, 200, "Notification marked as read");
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  successResponse(res, 200, "All notifications marked as read");
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  successResponse(res, 200, "Notification deleted");
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  successResponse(res, 200, "Unread count", { count });
});

exports.sendBroadcast = asyncHandler(async (req, res) => {
  const { title, message, type = "announcement", userIds, role } = req.body;
  const User = require("../models/User");

  let recipients;
  if (userIds?.length) {
    recipients = userIds;
  } else if (role) {
    const users = await User.find({ role }).select("_id");
    recipients = users.map((u) => u._id);
  } else {
    const users = await User.find({ isActive: true }).select("_id");
    recipients = users.map((u) => u._id);
  }

  await Notification.insertMany(
    recipients.map((userId) => ({ recipient: userId, sender: req.user._id, type, title, message }))
  );
  successResponse(res, 200, `Broadcast sent to ${recipients.length} users`);
});
