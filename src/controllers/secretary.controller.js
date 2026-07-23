const secretaryService = require("../services/secretary.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await secretaryService.getDashboardData(req.user);
  successResponse(res, 200, "Secretary module initialized successfully", result);
});

exports.getMembers = asyncHandler(async (req, res) => {
  const paginationParams = getPagination(req.query);
  const { search, status } = req.query;
  const { items, total, summary } = await secretaryService.getMembersData(req.user, {
    ...paginationParams,
    search,
    status
  });

  const totalPages = Math.ceil(total / paginationParams.limit);
  
  res.status(200).json({
    success: true,
    message: "Members retrieved successfully",
    data: items,
    pagination: {
      currentPage: parseInt(paginationParams.page),
      totalPages,
      totalItems: total,
      itemsPerPage: parseInt(paginationParams.limit),
      hasNextPage: paginationParams.page < totalPages,
      hasPrevPage: paginationParams.page > 1,
    },
    summary
  });
});

exports.getMinutes = asyncHandler(async (req, res) => {
  const paginationParams = getPagination(req.query);
  const { search, status } = req.query;
  const { items, total } = await secretaryService.getMinutesData(req.user, {
    ...paginationParams,
    search,
    status
  });

  paginatedResponse(
    res,
    items,
    paginationParams.page,
    paginationParams.limit,
    total,
    "Meeting minutes retrieved successfully"
  );
});

exports.getAttendance = asyncHandler(async (req, res) => {
  const paginationParams = getPagination(req.query);
  const { search, status } = req.query;
  const { items, total } = await secretaryService.getAttendanceData(req.user, {
    ...paginationParams,
    search,
    status
  });

  paginatedResponse(
    res,
    items,
    paginationParams.page,
    paginationParams.limit,
    total,
    "Attendance retrieved successfully"
  );
});
const list = (fn) => asyncHandler(async (req, res) => { const pagination = getPagination(req.query); const result = await fn(req.user, { ...pagination, ...req.query }); res.status(200).json({ success: true, data: result.items, pagination: { currentPage: Number(pagination.page), totalPages: Math.ceil(result.total / pagination.limit), totalItems: result.total, itemsPerPage: Number(pagination.limit) } }); });
exports.getCategories = list((user, params) => secretaryService.getCategories(user, params));
exports.getMembersDirectory = list((user, params) => secretaryService.getMembers(user, params));
exports.getTasks = list((user, params) => secretaryService.getRecords(user, "task", params));
exports.getAttendanceRecords = list((user, params) => secretaryService.getRecords(user, "attendance", params));
exports.createCategory = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await secretaryService.saveCategory(req.user, null, req.body) }));
exports.updateCategory = asyncHandler(async (req, res) => res.json({ success: true, data: await secretaryService.saveCategory(req.user, req.params.id, req.body) }));
exports.deleteCategory = asyncHandler(async (req, res) => { await secretaryService.deleteCategory(req.user, req.params.id); res.status(204).send(); });
exports.createMember = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await secretaryService.createMember(req.user, req.body) }));
exports.getMember = asyncHandler(async (req, res) => res.json({ success: true, data: await secretaryService.getMember(req.user, req.params.id) }));
exports.updateMember = asyncHandler(async (req, res) => res.json({ success: true, data: await secretaryService.updateMember(req.user, req.params.id, req.body) }));
exports.deleteMember = asyncHandler(async (req, res) => { await secretaryService.deleteMember(req.user, req.params.id); res.status(204).send(); });
exports.createTask = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await secretaryService.saveRecord(req.user, "task", null, req.body) }));
exports.updateTask = asyncHandler(async (req, res) => res.json({ success: true, data: await secretaryService.saveRecord(req.user, "task", req.params.id, req.body) }));
exports.deleteTask = asyncHandler(async (req, res) => { await secretaryService.deleteRecord(req.user, "task", req.params.id); res.status(204).send(); });
exports.createAttendance = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await secretaryService.saveRecord(req.user, "attendance", null, { ...req.body, name: `Attendance - ${req.body.member}`, status: "completed" }) }));
exports.getEvents = list((user, params) => secretaryService.getSecretaryEvents(user, params));
exports.createEvent = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await secretaryService.createSecretaryEvent(req.user, req.body) }));
exports.assignEventMember = asyncHandler(async (req, res) => res.json({ success: true, data: await secretaryService.updateEventMembers(req.user, req.params.id, req.body) }));
exports.markEventAttendance = asyncHandler(async (req, res) => res.json({ success: true, data: await secretaryService.updateEventAttendance(req.user, req.params.id, req.params.attendeeId, req.body) }));
