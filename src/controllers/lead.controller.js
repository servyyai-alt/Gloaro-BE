const leadService = require("../services/lead.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse } = require("../utils/response");

exports.submitLead = asyncHandler(async (req, res) => {
  const lead = await leadService.submitLead(req.body, req.user?._id, req.ip, req.get("User-Agent"));
  successResponse(res, 201, "Enquiry submitted successfully", lead);
});

exports.getLeads = asyncHandler(async (req, res) => {
  const { leads, total, page, limit } = await leadService.getLeads(req.query, req.user._id, req.user.role);
  paginatedResponse(res, leads, page, limit, total, "Leads retrieved");
});

exports.getLeadById = asyncHandler(async (req, res) => {
  const lead = await leadService.getLeadById(req.params.id, req.user._id, req.user.role);
  successResponse(res, 200, "Lead retrieved", lead);
});

exports.updateLeadStatus = asyncHandler(async (req, res) => {
  const lead = await leadService.updateLeadStatus(req.params.id, req.body.status, req.user._id, req.user.role);
  successResponse(res, 200, "Lead status updated", lead);
});

exports.addNote = asyncHandler(async (req, res) => {
  const lead = await leadService.addNote(req.params.id, req.body.content, req.user._id, req.body.isInternal);
  successResponse(res, 200, "Note added", lead);
});

exports.scheduleFollowUp = asyncHandler(async (req, res) => {
  const lead = await leadService.scheduleFollowUp(req.params.id, req.body);
  successResponse(res, 200, "Follow-up scheduled", lead);
});

exports.assignLead = asyncHandler(async (req, res) => {
  const lead = await leadService.assignLead(req.params.id, req.body.assignedTo);
  successResponse(res, 200, "Lead assigned", lead);
});

exports.getLeadAnalytics = asyncHandler(async (req, res) => {
  const analytics = await leadService.getLeadAnalytics(req.query.vendorId);
  successResponse(res, 200, "Lead analytics", analytics);
});
