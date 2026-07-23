const { ROLES } = require("../constants/roleConfig");
const Wishlist = require("../models/Wishlist");
const Lead = require("../models/Lead");
const Event = require("../models/Event");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

const getWishlistField = (itemType) => {
  if (itemType === ROLES.VENDOR) return ROLES.VENDOR;
  if (itemType === "product") return "product";
  if (itemType === "service") return "service";
  throw new AppError("Invalid wishlist item type", 400);
};

exports.getWishlist = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.itemType) filter.itemType = req.query.itemType;

  const [items, total] = await Promise.all([
    Wishlist.find(filter)
      .populate(ROLES.VENDOR, "businessName slug logo address stats")
      .populate("product", "title slug images pricing stats")
      .populate("service", "title slug gallery pricing stats")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    Wishlist.countDocuments(filter),
  ]);

  paginatedResponse(res, items, page, limit, total, "Wishlist retrieved");
});

exports.addToWishlist = asyncHandler(async (req, res) => {
  const { itemType, itemId, notes } = req.body;
  const field = getWishlistField(itemType);

  const item = await Wishlist.findOneAndUpdate(
    { user: req.user._id, [field]: itemId },
    { user: req.user._id, itemType, [field]: itemId, notes },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  successResponse(res, 200, "Added to wishlist", item);
});

exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const { itemType } = req.query;
  const field = getWishlistField(itemType);

  await Wishlist.findOneAndDelete({ user: req.user._id, [field]: req.params.itemId });
  successResponse(res, 200, "Removed from wishlist");
});

exports.getMyEnquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { submittedBy: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate(ROLES.VENDOR, "businessName slug logo")
      .populate("service", "title slug")
      .populate("product", "title slug")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(filter),
  ]);

  paginatedResponse(res, leads, page, limit, total, "Customer enquiries retrieved");
});

exports.getMyEventRegistrations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { "attendees.user": req.user._id };
  if (req.query.status) filter["attendees.status"] = req.query.status;

  const [events, total] = await Promise.all([
    Event.find(filter)
      .select("title slug type venue startDate endDate attendees status coverImage")
      .sort("-startDate")
      .skip(skip)
      .limit(limit),
    Event.countDocuments(filter),
  ]);

  const registrations = events.map((event) => {
    const registration = event.attendees.find((attendee) => attendee.user.toString() === req.user._id.toString());
    return { event, registration };
  });

  paginatedResponse(res, registrations, page, limit, total, "Event registrations retrieved");
});
