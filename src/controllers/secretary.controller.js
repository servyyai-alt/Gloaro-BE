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
