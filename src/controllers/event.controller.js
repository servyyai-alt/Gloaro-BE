const Event = require("../models/Event");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const { isAdminRole } = require("../constants/adminRoles");
const idGenerator = require("../services/idGenerator.service");

exports.createEvent = asyncHandler(async (req, res) => {
  if (req.file) req.body.coverImage = { url: req.file.path, publicId: req.file.filename };
  delete req.body.eventId;

  const scope = req.body.scope || (req.body.chapterCode ? "chapter" : req.body.stateCode ? "state" : "national");
  const event = await Event.create({
    ...req.body,
    eventId: await idGenerator.generateEventId({
      scope,
      stateCode: req.body.stateCode,
      chapterCode: req.body.chapterCode,
      startDate: req.body.startDate,
    }),
    organizer: req.user._id,
  });
  successResponse(res, 201, "Event created", event);
});

exports.getEvents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status: "published" };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.upcoming === "true") filter.startDate = { $gte: new Date() };
  if (req.query.featured === "true") filter.isFeatured = true;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [events, total] = await Promise.all([
    Event.find(filter).populate("organizer", "name").populate("category", "name").sort("startDate").skip(skip).limit(limit),
    Event.countDocuments(filter),
  ]);
  paginatedResponse(res, events, page, limit, total);
});

exports.getEventById = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id)
    .populate("organizer", "name email")
    .populate("category", "name")
    .populate("attendees.user", "name email avatar");
  if (!event) throw new AppError("Event not found", 404);
  await Event.findByIdAndUpdate(req.params.id, { $inc: { "stats.totalViews": 1 } });
  successResponse(res, 200, "Event retrieved", event);
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new AppError("Event not found", 404);
  const isOwner = event.organizer.toString() === req.user._id.toString();
  if (!isOwner && !isAdminRole(req.user.role)) throw new AppError("Not authorized", 403);
  delete req.body.eventId;
  if (req.file) req.body.coverImage = { url: req.file.path, publicId: req.file.filename };
  const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  successResponse(res, 200, "Event updated", updated);
});

exports.registerForEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new AppError("Event not found", 404);
  if (event.status !== "published") throw new AppError("Event not available for registration", 400);

  const alreadyRegistered = event.attendees.some((a) => a.user.toString() === req.user._id.toString());
  if (alreadyRegistered) throw new AppError("Already registered for this event", 409);

  if (event.registration.maxAttendees && event.attendees.length >= event.registration.maxAttendees) {
    throw new AppError("Event is fully booked", 400);
  }

  if (event.registration.registrationDeadline && new Date() > event.registration.registrationDeadline) {
    throw new AppError("Registration deadline has passed", 400);
  }

  event.attendees.push({
    user: req.user._id,
    ticketNumber: await idGenerator.generateEventTicketId({ eventId: event.eventId || event._id }),
    guestCount: req.body.guestCount || 0,
  });
  event.stats.totalRegistrations = event.attendees.length;
  await event.save();
  successResponse(res, 200, "Registered for event successfully", { ticketNumber: event.attendees.at(-1).ticketNumber });
});

exports.cancelRegistration = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new AppError("Event not found", 404);
  const attendeeIdx = event.attendees.findIndex((a) => a.user.toString() === req.user._id.toString());
  if (attendeeIdx === -1) throw new AppError("Not registered for this event", 404);
  event.attendees[attendeeIdx].status = "cancelled";
  await event.save();
  successResponse(res, 200, "Registration cancelled");
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new AppError("Event not found", 404);
  const isOwner = event.organizer.toString() === req.user._id.toString();
  if (!isOwner && !isAdminRole(req.user.role)) throw new AppError("Not authorized", 403);
  await event.deleteOne();
  successResponse(res, 200, "Event deleted");
});
