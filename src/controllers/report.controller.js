const reportService = require("../services/report.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/response");

exports.getUserReport = asyncHandler(async (req, res) => {
  const data = await reportService.getUserReport(req.query);
  successResponse(res, 200, "User report", data);
});

exports.getVendorReport = asyncHandler(async (req, res) => {
  const data = await reportService.getVendorReport(req.query);
  successResponse(res, 200, "Vendor report", data);
});

exports.getRevenueReport = asyncHandler(async (req, res) => {
  const data = await reportService.getRevenueReport(req.query);
  successResponse(res, 200, "Revenue report", data);
});

exports.getMembershipReport = asyncHandler(async (req, res) => {
  const data = await reportService.getMembershipReport();
  successResponse(res, 200, "Membership report", data);
});

exports.getLeadReport = asyncHandler(async (req, res) => {
  const data = await reportService.getLeadReport(req.query);
  successResponse(res, 200, "Lead report", data);
});

exports.getProductReport = asyncHandler(async (req, res) => {
  const data = await reportService.getProductReport();
  successResponse(res, 200, "Product report", data);
});

exports.getServiceReport = asyncHandler(async (req, res) => {
  const data = await reportService.getServiceReport();
  successResponse(res, 200, "Service report", data);
});

exports.getEventReport = asyncHandler(async (req, res) => {
  const data = await reportService.getEventReport();
  successResponse(res, 200, "Event report", data);
});

exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const [users, vendors, revenue, leads] = await Promise.all([
    reportService.getUserReport({}),
    reportService.getVendorReport({}),
    reportService.getRevenueReport({}),
    reportService.getLeadReport({}),
  ]);
  successResponse(res, 200, "Dashboard summary", { users, vendors, revenue, leads });
});

exports.getAnalyticsSummary = asyncHandler(async (req, res) => {
  const data = await reportService.getAnalyticsSummary(req.query);
  successResponse(res, 200, "Analytics summary", data);
});
