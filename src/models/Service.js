const mongoose = require("mongoose");
const slugify = require("slugify");

const serviceSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    title: { type: String, required: [true, "Service title is required"], trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true, maxlength: 3000 },
    shortDescription: { type: String, maxlength: 300 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    gallery: [{ url: String, publicId: String }],
    pricing: {
      type: { type: String, enum: ["fixed", "hourly", "custom", "range"], default: "fixed" },
      minPrice: { type: Number, min: 0 },
      maxPrice: { type: Number, min: 0 },
      currency: { type: String, default: "INR" },
      unit: String,
    },
    availability: {
      days: [{ type: String, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }],
      startTime: String,
      endTime: String,
      isAvailable: { type: Boolean, default: true },
    },
    tags: [String],
    features: [String],
    status: { type: String, enum: ["pending", "approved", "rejected", "draft"], default: "pending" },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedReason: String,
    stats: {
      views: { type: Number, default: 0 },
      inquiries: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    deliveryTime: String,
    serviceArea: [String],
    faqs: [{ question: String, answer: String }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

serviceSchema.index({ vendor: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ isFeatured: 1 });
serviceSchema.index({ title: "text", description: "text", tags: "text" });

serviceSchema.pre("save", async function (next) {
  if (this.isModified("title")) {
    let slug = slugify(this.title, { lower: true, strict: true });
    const existing = await mongoose.model("Service").findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${slug}-${Date.now()}`;
    this.slug = slug;
  }
  next();
});

module.exports = mongoose.model("Service", serviceSchema);
