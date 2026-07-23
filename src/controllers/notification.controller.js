const { ROLES } = require("../constants/roleConfig");
const Notification = require("../models/Notification");
const Vendor = require("../models/Vendor");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const { emitToUser } = require("../sockets");

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
    const roleFilter = role === ROLES.CUSTOMER || role === "user" ? { role: { $in: [ROLES.CUSTOMER, "user"] } } : { role };
    const users = await User.find(roleFilter).select("_id");
    recipients = users.map((u) => u._id);
  } else {
    const users = await User.find({ isActive: true }).select("_id");
    recipients = users.map((u) => u._id);
  }

  await Notification.insertMany(
    recipients.map((userId) => ({ recipient: userId, sender: req.user._id, type, title, message }))
  );
  recipients.forEach((userId) => emitToUser(userId, "notification", { type, title, message }));
  successResponse(res, 200, `Broadcast sent to ${recipients.length} users`);
});

exports.sendUserNotification = asyncHandler(async (req, res) => {
  const { title, message, type = "announcement", link, priority = "normal", data } = req.body;
  const notification = await Notification.create({
    recipient: req.params.userId,
    sender: req.user._id,
    type,
    title,
    message,
    link,
    priority,
    data,
  });
  emitToUser(req.params.userId, "notification", notification);
  successResponse(res, 201, "Notification sent", notification);
});

exports.sendVendorNotification = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.vendorId).select("user businessName");
  if (!vendor) throw new AppError("Vendor not found", 404);

  const { title, message, type = "announcement", link, priority = "normal", data } = req.body;
  const notification = await Notification.create({
    recipient: vendor.user,
    sender: req.user._id,
    type,
    title,
    message,
    link,
    priority,
    data,
  });
  emitToUser(vendor.user, "notification", notification);
  successResponse(res, 201, "Vendor notification sent", notification);
});
