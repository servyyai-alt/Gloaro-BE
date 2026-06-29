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
    applicationNumber: { type: String, unique: true, sparse: true },
    step: { type: Number, default: 3 },
    status: { type: String, enum: ["submitted", "under_review", "approved", "rejected"], default: "submitted" },
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
  },
  { timestamps: true }
);

membershipApplicationSchema.index({ status: 1, createdAt: -1 });
membershipApplicationSchema.index({ "personal.emailAddress": 1 });
membershipApplicationSchema.index({ "professional.companyName": "text", "personal.fullName": "text", "personal.emailAddress": "text" });

module.exports = mongoose.model("MembershipApplication", membershipApplicationSchema);
