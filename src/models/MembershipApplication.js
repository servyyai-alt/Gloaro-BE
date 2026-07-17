const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    originalName: String,
    mimetype: String,
    field: String,
    resourceType: String,
  },
  { _id: false }
);

const membershipApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: { type: String, unique: true, sparse: true, immutable: true, trim: true, uppercase: true, index: true },
    step: { type: Number, default: 3 },
    status: { type: String, enum: ["draft", "submitted", "pending_review", "documents_verified", "under_review", "forwarded", "approved", "rejected", "changes_requested"], default: "submitted" },
    agreement: {
      declarationsAccepted: [String],
      legalName: String,
      digitalSignature: String,
      signatureDate: String,
      signatureLocation: String,
      acceptedTermsAt: Date,
    },
    personal: {
      fullName: String,
      dateOfBirth: String,
      gender: String,
      mobileNumber: String,
      emailAddress: String,
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },
    professional: {
      companyName: String,
      designation: String,
      industry: String,
      businessType: String,
      yearsOfExperience: String,
      backgroundSummary: String,
      joinReason: String,
      expertise: [String],
      companyWebsite: String,
      linkedInProfile: String,
      businessEmail: String,
    },
    credentials: {
      businessRegistrationNumber: String,
      gstNumber: String,
      panNumber: String,
      companyType: String,
    },
    references: [
      {
        fullName: String,
        companyName: String,
        designation: String,
        phoneNumber: String,
        emailAddress: String,
      },
    ],
    referralCode: String,
    documents: {
      profilePhoto: fileSchema,
      registrationCertificate: fileSchema,
      gstCertificate: fileSchema,
      companyProfile: fileSchema,
      visitingCard: fileSchema,
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    adminNotes: String,

    // Location-driven workflow fields
    regionId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    stateId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    areaId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },

    // Assigned Officials
    vicePresidentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    chapterPresidentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    directConsultantId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    launchDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    executiveDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    districtDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stateDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    regionDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Approval Auditing
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedRole: String,
    approvedAt: Date,
    rejectionReason: String,

    // Workflow History
    workflowHistory: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: String,
        action: String,
        remarks: String,
        timestamp: { type: Date, default: Date.now },
        previousStatus: String,
        newStatus: String,
      }
    ],
  },
  { timestamps: true }
);

membershipApplicationSchema.index({ status: 1, createdAt: -1 });
membershipApplicationSchema.index({ "personal.emailAddress": 1 });
membershipApplicationSchema.index({ "professional.companyName": "text", "personal.fullName": "text", "personal.emailAddress": "text" });
membershipApplicationSchema.index({ applicationNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("MembershipApplication", membershipApplicationSchema);
