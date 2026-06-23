const { MembershipPlan, Membership } = require("../models/Membership");
const Vendor = require("../models/Vendor");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");
const moment = require("moment");

exports.getPlans = asyncHandler(async (req, res) => {
  const plans = await MembershipPlan.find({ isActive: true }).sort("order");
  successResponse(res, 200, "Membership plans", plans);
});

exports.createPlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.create(req.body);
  successResponse(res, 201, "Plan created", plan);
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) throw new AppError("Plan not found", 404);
  successResponse(res, 200, "Plan updated", plan);
});

exports.purchaseMembership = asyncHandler(async (req, res) => {
  const { plan, billingCycle = "monthly" } = req.body;
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) throw new AppError("Vendor profile not found", 404);

  const planDetails = await MembershipPlan.findOne({ name: plan, isActive: true });
  if (!planDetails) throw new AppError("Plan not found", 404);

  const price = planDetails.price[billingCycle];
  const startDate = new Date();
  const endDate = moment(startDate).add(billingCycle === "yearly" ? 1 : 1, billingCycle === "yearly" ? "year" : "month").toDate();

  // Cancel existing active membership
  await Membership.findOneAndUpdate({ vendor: vendor._id, status: "active" }, { status: "cancelled", cancelledAt: new Date() });

  const membership = await Membership.create({
    vendor: vendor._id,
    user: req.user._id,
    plan,
    billingCycle,
    startDate,
    endDate,
    price,
    status: price === 0 ? "active" : "pending",
    isActive: price === 0,
  });

  if (price === 0) {
    await Vendor.findByIdAndUpdate(vendor._id, {
      "membership.plan": plan,
      "membership.startDate": startDate,
      "membership.endDate": endDate,
      "membership.isActive": true,
    });
    return successResponse(res, 201, "Free plan activated", membership);
  }

  successResponse(res, 201, "Membership created. Proceed to payment.", { membership, price, plan });
});

exports.getMyMembership = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) throw new AppError("Vendor profile not found", 404);

  const membership = await Membership.findOne({ vendor: vendor._id, status: "active" }).populate("payment");
  successResponse(res, 200, "Membership retrieved", membership || { plan: "free", isActive: false });
});

exports.getMembershipHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) throw new AppError("Vendor profile not found", 404);

  const [memberships, total] = await Promise.all([
    Membership.find({ vendor: vendor._id }).populate("payment").sort("-createdAt").skip(skip).limit(limit),
    Membership.countDocuments({ vendor: vendor._id }),
  ]);
  paginatedResponse(res, memberships, page, limit, total);
});

exports.cancelMembership = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) throw new AppError("Vendor profile not found", 404);

  const membership = await Membership.findOne({ vendor: vendor._id, status: "active" });
  if (!membership) throw new AppError("No active membership found", 404);

  membership.status = "cancelled";
  membership.isActive = false;
  membership.cancelledAt = new Date();
  membership.cancelReason = req.body.reason;
  await membership.save();

  await Vendor.findByIdAndUpdate(vendor._id, { "membership.isActive": false, "membership.plan": "free" });
  successResponse(res, 200, "Membership cancelled");
});

exports.getAllMemberships = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.plan) filter.plan = req.query.plan;

  const [memberships, total] = await Promise.all([
    Membership.find(filter).populate("vendor", "businessName").populate("user", "name email").sort("-createdAt").skip(skip).limit(limit),
    Membership.countDocuments(filter),
  ]);
  paginatedResponse(res, memberships, page, limit, total);
});
