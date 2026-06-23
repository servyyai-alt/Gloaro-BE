const Referral = require("../models/Referral");
const User = require("../models/User");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.getMyReferrals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [referrals, total] = await Promise.all([
    Referral.find({ referrer: req.user._id })
      .populate("referred", "name email createdAt")
      .sort("-createdAt").skip(skip).limit(limit),
    Referral.countDocuments({ referrer: req.user._id }),
  ]);

  const stats = await Referral.aggregate([
    { $match: { referrer: req.user._id } },
    { $group: { _id: "$status", count: { $sum: 1 }, totalCommission: { $sum: "$commission.amount" } } },
  ]);

  paginatedResponse(res, referrals, page, limit, total, "Referrals retrieved");
});

exports.getMyReferralCode = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("referralCode name");
  successResponse(res, 200, "Referral code", {
    referralCode: user.referralCode,
    referralLink: `${process.env.CLIENT_URL}/register?ref=${user.referralCode}`,
  });
});

exports.getReferralStats = asyncHandler(async (req, res) => {
  const stats = await Referral.aggregate([
    { $match: { referrer: req.user._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        rewarded: { $sum: { $cond: [{ $eq: ["$status", "rewarded"] }, 1, 0] } },
        totalEarnings: { $sum: "$commission.amount" },
        pendingEarnings: { $sum: { $cond: [{ $eq: ["$reward.isGiven", false] }, "$commission.amount", 0] } },
      },
    },
  ]);

  successResponse(res, 200, "Referral stats", stats[0] || { total: 0, rewarded: 0, totalEarnings: 0, pendingEarnings: 0 });
});

exports.getAllReferrals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [referrals, total] = await Promise.all([
    Referral.find(req.query.status ? { status: req.query.status } : {})
      .populate("referrer", "name email")
      .populate("referred", "name email")
      .sort("-createdAt").skip(skip).limit(limit),
    Referral.countDocuments(),
  ]);
  paginatedResponse(res, referrals, page, limit, total);
});

exports.processReferralReward = asyncHandler(async (req, res) => {
  const referral = await Referral.findByIdAndUpdate(req.params.id, {
    "reward.isGiven": true,
    "reward.givenAt": new Date(),
    status: "rewarded",
  }, { new: true });
  if (!referral) throw new AppError("Referral not found", 404);
  successResponse(res, 200, "Reward processed", referral);
});
