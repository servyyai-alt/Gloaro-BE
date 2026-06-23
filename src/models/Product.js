const mongoose = require("mongoose");
const slugify = require("slugify");

const productSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, maxlength: 3000 },
    shortDescription: { type: String, maxlength: 300 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    sku: { type: String, trim: true },
    barcode: String,
    images: [{ url: String, publicId: String, isMain: Boolean }],
    pricing: {
      mrp: { type: Number, required: true, min: 0 },
      sellingPrice: { type: Number, required: true, min: 0 },
      costPrice: Number,
      currency: { type: String, default: "INR" },
      taxPercent: { type: Number, default: 0 },
      hsnCode: String,
    },
    inventory: {
      quantity: { type: Number, default: 0, min: 0 },
      unit: { type: String, default: "piece" },
      lowStockAlert: { type: Number, default: 10 },
      isUnlimited: { type: Boolean, default: false },
    },
    attributes: [{ name: String, value: String }],
    variants: [
      {
        name: String,
        options: [String],
        price: Number,
        stock: Number,
        sku: String,
      },
    ],
    tags: [String],
    status: { type: String, enum: ["pending", "approved", "rejected", "draft"], default: "pending" },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedReason: String,
    stats: {
      views: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    shippingInfo: {
      weight: Number,
      dimensions: { length: Number, width: Number, height: Number },
      isFreeShipping: { type: Boolean, default: false },
      shippingCharge: Number,
    },
    warranty: String,
    returnPolicy: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.index({ vendor: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ title: "text", description: "text", tags: "text" });

productSchema.pre("save", async function (next) {
  if (this.isModified("title")) {
    let slug = slugify(this.title, { lower: true, strict: true });
    const existing = await mongoose.model("Product").findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${slug}-${Date.now()}`;
    this.slug = slug;
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
