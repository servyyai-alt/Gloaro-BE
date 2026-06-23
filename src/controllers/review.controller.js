const Review = require("../models/Review");
const Vendor = require("../models/Vendor");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.createReview = asyncHandler(async (req, res) => {
  const existing = await Review.findOne({ vendor: req.body.vendor, user: req.user._id });
  if (existing) throw new AppError("You have already reviewed this vendor", 409);

  const images = req.files ? req.files.map((f) => ({ url: f.path, publicId: f.filename })) : [];
  const review = await Review.create({ ...req.body, user: req.user._id, images });
  successResponse(res, 201, "Review submitted for moderation", review);
});

exports.getVendorReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { vendor: req.params.vendorId, status: "approved" };
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate("user", "name avatar").sort("-createdAt").skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  paginatedResponse(res, reviews, page, limit, total);
});

exports.getAllReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.vendor) filter.vendor = req.query.vendor;
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate("user", "name email").populate("vendor", "businessName").sort("-createdAt").skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  paginatedResponse(res, reviews, page, limit, total);
});

exports.moderateReview = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const review = await Review.findByIdAndUpdate(req.params.id, {
    status: action === "approve" ? "approved" : action === "spam" ? "spam" : "rejected",
    moderatedBy: req.user._id,
    moderatedAt: new Date(),
    rejectedReason: reason,
  }, { new: true });
  if (!review) throw new AppError("Review not found", 404);
  successResponse(res, 200, `Review ${action}d`, review);
});

exports.replyToReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id).populate("vendor");
  if (!review) throw new AppError("Review not found", 404);
  const vendor = await Vendor.findOne({ user: req.user._id });
  const isVendorOwner = vendor && review.vendor._id.toString() === vendor._id.toString();
  if (!isVendorOwner && !["admin", "superadmin"].includes(req.user.role)) throw new AppError("Not authorized", 403);

  review.reply = { content: req.body.content, repliedAt: new Date(), repliedBy: req.user._id };
  await review.save();
  successResponse(res, 200, "Reply added", review);
});

exports.voteHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("Review not found", 404);
  const idx = review.helpfulVotes.indexOf(req.user._id);
  if (idx > -1) review.helpfulVotes.splice(idx, 1);
  else review.helpfulVotes.push(req.user._id);
  await review.save();
  successResponse(res, 200, "Vote updated", { helpfulCount: review.helpfulVotes.length });
});

exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("Review not found", 404);
  const isOwner = review.user.toString() === req.user._id.toString();
  if (!isOwner && !["admin", "superadmin"].includes(req.user.role)) throw new AppError("Not authorized", 403);
  await review.deleteOne();
  successResponse(res, 200, "Review deleted");
});
