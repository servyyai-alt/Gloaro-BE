const SupportTicket = require("../models/SupportTicket");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.createTicket = asyncHandler(async (req, res) => {
  const attachments = req.files ? req.files.map((f) => ({ url: f.path, publicId: f.filename, name: f.originalname })) : [];
  const ticket = await SupportTicket.create({ ...req.body, user: req.user._id, attachments });
  successResponse(res, 201, "Support ticket created", ticket);
});

exports.getMyTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter).sort("-createdAt").skip(skip).limit(limit),
    SupportTicket.countDocuments(filter),
  ]);
  paginatedResponse(res, tickets, page, limit, total);
});

exports.getTicketById = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("user", "name email")
    .populate("assignedTo", "name email")
    .populate("replies.sender", "name role avatar");
  if (!ticket) throw new AppError("Ticket not found", 404);

  const isOwner = ticket.user._id.toString() === req.user._id.toString();
  if (!isOwner && !["admin", "superadmin"].includes(req.user.role)) throw new AppError("Not authorized", 403);
  successResponse(res, 200, "Ticket retrieved", ticket);
});

exports.replyToTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const isOwner = ticket.user.toString() === req.user._id.toString();
  const isAdmin = ["admin", "superadmin"].includes(req.user.role);
  if (!isOwner && !isAdmin) throw new AppError("Not authorized", 403);

  const attachments = req.files ? req.files.map((f) => ({ url: f.path, publicId: f.filename, name: f.originalname })) : [];
  ticket.replies.push({
    sender: req.user._id,
    message: req.body.message,
    attachments,
    isInternal: isAdmin && req.body.isInternal,
  });

  if (!ticket.firstResponseAt && isAdmin) ticket.firstResponseAt = new Date();
  if (isAdmin) ticket.status = "in_progress";
  else ticket.status = "waiting_for_user"; // user replied, ball in admin's court — wait for admin

  // Actually flip: if user replies, status = waiting_for_admin
  if (!isAdmin) ticket.status = "open";

  await ticket.save();
  successResponse(res, 200, "Reply added", ticket);
});

exports.closeTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new AppError("Ticket not found", 404);
  const isOwner = ticket.user.toString() === req.user._id.toString();
  if (!isOwner && !["admin", "superadmin"].includes(req.user.role)) throw new AppError("Not authorized", 403);

  ticket.status = "closed";
  ticket.closedAt = new Date();
  if (req.body.satisfactionRating) {
    ticket.satisfactionRating = req.body.satisfactionRating;
    ticket.satisfactionComment = req.body.satisfactionComment;
  }
  await ticket.save();
  successResponse(res, 200, "Ticket closed");
});

exports.getAllTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter).populate("user", "name email").populate("assignedTo", "name").sort("-createdAt").skip(skip).limit(limit),
    SupportTicket.countDocuments(filter),
  ]);
  paginatedResponse(res, tickets, page, limit, total);
});

exports.assignTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, {
    assignedTo: req.body.assignedTo, status: "in_progress",
  }, { new: true }).populate("assignedTo", "name email");
  if (!ticket) throw new AppError("Ticket not found", 404);
  successResponse(res, 200, "Ticket assigned", ticket);
});
