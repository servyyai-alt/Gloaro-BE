const mongoose = require("mongoose");
const slugify = require("slugify");

const vendorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    businessName: { type: String, required: [true, "Business name is required"], trim: true },
    slug: { type: String, unique: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: String,
    logo: { url: String, publicId: String },
    coverImage: { url: String, publicId: String },
    gallery: [{ url: String, publicId: String }],
    description: { type: String, maxlength: 2000 },
    shortDescription: { type: String, maxlength: 300 },
    businessCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    tags: [String],
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, default: "India" },
      pincode: { type: String, required: true },
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    website: String,
    socialLinks: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String,
      youtube: String,
    },
    // Status & Workflow
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedReason: String,
    suspendedReason: String,
    // Membership
    membership: {
      plan: { type: String, enum: ["free", "silver", "gold", "platinum"], default: "free" },
      startDate: Date,
      endDate: Date,
      isActive: { type: Boolean, default: false },
    },
    // Documents
    documents: [
      {
        name: String,
        url: String,
        publicId: String,
        type: { type: String, enum: ["gst", "pan", "license", "other"] },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // Analytics
    stats: {
      totalLeads: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0, min: 0, max: 5 },
      totalProducts: { type: Number, default: 0 },
      totalServices: { type: Number, default: 0 },
    },
    // Subscription
    featuredUntil: Date,
    listingExpiry: Date,
    operatingHours: {
      monday: { open: String, close: String, isOpen: Boolean },
      tuesday: { open: String, close: String, isOpen: Boolean },
      wednesday: { open: String, close: String, isOpen: Boolean },
      thursday: { open: String, close: String, isOpen: Boolean },
      friday: { open: String, close: String, isOpen: Boolean },
      saturday: { open: String, close: String, isOpen: Boolean },
      sunday: { open: String, close: String, isOpen: Boolean },
    },
    estYear: Number,
    employeeCount: { type: String, enum: ["1-10", "11-50", "51-200", "201-500", "500+"] },
    annualRevenue: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
vendorSchema.index({ location: "2dsphere" });
vendorSchema.index({ slug: 1 });
vendorSchema.index({ businessCategory: 1 });
vendorSchema.index({ status: 1 });
vendorSchema.index({ isFeatured: 1 });
vendorSchema.index({ "address.city": 1, "address.state": 1 });
vendorSchema.index({ createdAt: -1 });
vendorSchema.index({ businessName: "text", description: "text", tags: "text" });

// Pre-save: generate slug
vendorSchema.pre("save", async function (next) {
  if (this.isModified("businessName")) {
    let slug = slugify(this.businessName, { lower: true, strict: true });
    const existing = await mongoose.model("Vendor").findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${slug}-${Date.now()}`;
    this.slug = slug;
  }
  next();
});

module.exports = mongoose.model("Vendor", vendorSchema);
