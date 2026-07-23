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

const vendorApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: { type: String, unique: true, sparse: true, immutable: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    step: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["draft", "pending_vp_review", "rejected_by_vp", "submitted", "under_review", "approved", "rejected"],
      default: "draft",
    },
    // Step 1: Vendor Agreement & Marketplace Policies
    step1: {
      vendorResponsibilities: { type: Boolean, default: false },
      marketplaceStandards: { type: Boolean, default: false },
      commissionPaymentTerms: { type: Boolean, default: false },
      productServiceGuidelines: { type: Boolean, default: false },
      privacyPolicy: { type: Boolean, default: false },
      termsConditions: { type: Boolean, default: false },
      finalDeclaration: { type: Boolean, default: false },
      fullName: String,
      signature: String,
      date: String,
      location: String,
    },
    // Step 2: Personal & Business Info
    step2: {
      personal: {
        profilePhoto: fileSchema,
        fullName: String,
        dateOfBirth: String,
        gender: String,
        mobileNumber: String,
        email: String,
      },
      address: {
        line1: String,
        line2: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
      },
      details: {
        businessName: String,
        businessCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        businessType: String,
        yearsOfExperience: Number,
        professionalBackground: String,
        whyJoinGloaro: String,
      },
      digitalPresence: {
        website: String,
        googleBusinessProfile: String,
        instagram: String,
        businessEmail: String,
      },
    },
    // Step 3: Business Verification
    step3: {
      credentials: {
        businessRegistrationNumber: String,
        gstNumber: String,
        panNumber: String,
        businessType: String,
      },
      documents: {
        registrationCertificate: fileSchema,
        gstCertificate: fileSchema,
        businessLogo: fileSchema,
        ownerIdProof: fileSchema,
        shopPhoto: fileSchema,
      },
      references: [
        {
          fullName: String,
          companyName: String,
          relationship: String,
          phoneNumber: String,
          emailAddress: String,
        },
      ],
      vendorPoliciesAccepted: { type: Boolean, default: false },
    },
    // Scoping Boundaries (copied from user.meta.adminProfile.organization)
    regionId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    stateId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord", index: true },

    // Review & Auditing
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedByRole: String,
    reviewedAt: Date,
    adminNotes: String,
    workflowHistory: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: String,
        action: String,
        remarks: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

vendorApplicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("VendorApplication", vendorApplicationSchema);
