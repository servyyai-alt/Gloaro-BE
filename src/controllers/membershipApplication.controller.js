const MembershipApplication = require("../models/MembershipApplication");
const { cloudinary } = require("../config/cloudinary");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse, paginatedResponse, getPagination } = require("../utils/response");

const parseData = (body) => {
  if (!body.data) return body;
  if (typeof body.data === "object") return body.data;
  return JSON.parse(body.data);
};

const generateApplicationNumber = () => {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `GLO-${year}-${suffix}`;
};

const fileFromUpload = (file, field) => {
  if (!file) return undefined;
  return {
    url: file.path,
    publicId: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    field,
    resourceType: file.resourceType,
  };
};

exports.createApplication = asyncHandler(async (req, res) => {
  const payload = parseData(req.body);
  const files = req.files || {};
  const documents = {
    profilePhoto: fileFromUpload(files.profilePhoto?.[0], "profilePhoto"),
    registrationCertificate: fileFromUpload(files.registrationCertificate?.[0], "registrationCertificate"),
    gstCertificate: fileFromUpload(files.gstCertificate?.[0], "gstCertificate"),
    companyProfile: fileFromUpload(files.companyProfile?.[0], "companyProfile"),
    visitingCard: fileFromUpload(files.visitingCard?.[0], "visitingCard"),
  };

  Object.keys(documents).forEach((key) => {
    if (!documents[key]) delete documents[key];
  });

  const application = await MembershipApplication.create({
    ...payload,
    applicationNumber: payload.applicationNumber || generateApplicationNumber(),
    documents: { ...(payload.documents || {}), ...documents },
    submittedBy: req.user?._id,
    status: "submitted",
  });

  successResponse(res, 201, "Membership application submitted", application);
});

exports.getApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [applications, total] = await Promise.all([
    MembershipApplication.find(filter).populate("submittedBy", "name email role").populate("reviewedBy", "name email").sort("-createdAt").skip(skip).limit(limit),
    MembershipApplication.countDocuments(filter),
  ]);

  paginatedResponse(res, applications, page, limit, total, "Membership applications retrieved");
});

exports.trackApplication = asyncHandler(async (req, res) => {
  const { applicationId, mobileNumber } = req.query;
  if (!applicationId || !mobileNumber) {
    return res.status(400).json({ success: false, message: "Application ID and mobile number are required" });
  }

  const application = await MembershipApplication.findOne({
    applicationNumber: String(applicationId).trim(),
    "personal.mobileNumber": String(mobileNumber).trim(),
  }).select("-reviewedBy");

  if (!application) return res.status(404).json({ success: false, message: "Application not found" });
  successResponse(res, 200, "Application tracking details retrieved", application);
});

exports.getApplicationById = asyncHandler(async (req, res) => {
  const application = await MembershipApplication.findById(req.params.id).populate("submittedBy", "name email role").populate("reviewedBy", "name email");
  if (!application) return res.status(404).json({ success: false, message: "Membership application not found" });
  successResponse(res, 200, "Membership application retrieved", application);
});

exports.getApplicationDocumentUrl = asyncHandler(async (req, res) => {
  const { id, field } = req.params;
  const application = await MembershipApplication.findById(id).select("documents");
  if (!application) return res.status(404).json({ success: false, message: "Membership application not found" });

  const file = application.documents?.[field];
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

exports.updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const application = await MembershipApplication.findByIdAndUpdate(
    req.params.id,
    { status, adminNotes, reviewedBy: req.user._id, reviewedAt: new Date() },
    { new: true, runValidators: true }
  );
  if (!application) return res.status(404).json({ success: false, message: "Membership application not found" });
  successResponse(res, 200, "Membership application updated", application);
});
