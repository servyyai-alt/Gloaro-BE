const vendorApplicationService = require("../services/vendorApplication.service");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse } = require("../utils/response");
const { cloudinary } = require("../config/cloudinary");
const VendorApplication = require("../models/VendorApplication");

const parseData = (body) => {
  if (!body.data) return body;
  if (typeof body.data === "object") return body.data;
  try {
    return JSON.parse(body.data);
  } catch (err) {
    return body;
  }
};

exports.getMyApplication = asyncHandler(async (req, res) => {
  const application = await vendorApplicationService.getMyApplication(req.user._id);
  if (!application) {
    return res.status(404).json({ success: false, message: "No application found" });
  }
  successResponse(res, 200, "Your vendor application retrieved", application);
});

exports.saveDraft = asyncHandler(async (req, res) => {
  const payload = parseData(req.body);
  const files = req.files || {};
  const application = await vendorApplicationService.saveDraft(req.user._id, payload, files);
  successResponse(res, 200, "Draft saved successfully", application);
});

exports.submitApplication = asyncHandler(async (req, res) => {
  const payload = parseData(req.body);
  const files = req.files || {};
  const application = await vendorApplicationService.submitApplication(req.user._id, payload, files);
  successResponse(res, 200, "Application submitted successfully", application);
});

exports.getApplications = asyncHandler(async (req, res) => {
  const result = await vendorApplicationService.getApplications(req.user, req.query);

  if (req.query.export === "csv") {
    const { exportToCSV } = require("../utils/csv");
    return exportToCSV(res, result.applications, [
      { label: "Application Number", key: "applicationNumber" },
      { label: "Business Name", key: "step2.details.businessName" },
      { label: "Owner Name", key: "step2.personal.fullName" },
      { label: "Status", key: "status" },
      { label: "Region", key: "regionId.name" },
      { label: "State", key: "stateId.name" },
      { label: "District", key: "districtId.name" },
      { label: "Chapter", key: "chapterId.name" },
      { label: "Created At", key: "createdAt" }
    ], "vendor_applications.csv");
  }

  paginatedResponse(
    res,
    result.applications,
    result.page,
    result.limit,
    result.total,
    "Vendor applications retrieved successfully"
  );
});

exports.getApplicationById = asyncHandler(async (req, res) => {
  const application = await vendorApplicationService.getApplicationById(req.params.id, req.user);
  successResponse(res, 200, "Vendor application details retrieved", application);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const application = await vendorApplicationService.updateStatus(req.params.id, req.user, status, adminNotes);
  successResponse(res, 200, `Application marked as ${status}`, application);
});

exports.getApplicationDocumentUrl = asyncHandler(async (req, res) => {
  const { id, field } = req.params;
  const application = await VendorApplication.findById(id);
  if (!application) return res.status(404).json({ success: false, message: "Vendor application not found" });

  let file;
  if (field === "profilePhoto") {
    file = application.step2?.personal?.profilePhoto;
  } else {
    file = application.step3?.documents?.[field];
  }

  if (!file?.url) return res.status(404).json({ success: false, message: "Document not found" });

  const isPdf = file.mimetype === "application/pdf" || file.originalName?.toLowerCase().endsWith(".pdf") || file.url.toLowerCase().endsWith(".pdf");
  if (!isPdf) return successResponse(res, 200, "Document URL generated", { url: file.url });

  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  const resourceType = file.resourceType || (file.url.includes("/raw/upload/") ? "raw" : "image");
  const publicId = String(file.publicId || "").replace(/\.pdf$/i, "");

  const url = cloudinary.utils.private_download_url(publicId, "pdf", {
    resource_type: resourceType,
    type: "upload",
    attachment: false,
    expires_at: expiresAt,
  });

  successResponse(res, 200, "Document URL generated", { url, expiresAt });
});
