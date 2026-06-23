const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 200 },
    comment: { type: String, required: true, maxlength: 1000 },
    images: [{ url: String, publicId: String }],
    status: { type: String, enum: ["pending", "approved", "rejected", "spam"], default: "pending" },
    isVerifiedPurchase: { type: Boolean, default: false },
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reportedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reply: {
      content: String,
      repliedAt: Date,
      repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
    rejectedReason: String,
  },
  { timestamps: true }
);

reviewSchema.index({ vendor: 1, user: 1 });
reviewSchema.index({ vendor: 1, status: 1 });
reviewSchema.index({ rating: 1 });

// Update vendor avg rating after review save
reviewSchema.post("save", async function () {
  await updateVendorRating(this.vendor);
});

reviewSchema.post("remove", async function () {
  await updateVendorRating(this.vendor);
});

async function updateVendorRating(vendorId) {
  const Vendor = mongoose.model("Vendor");
  const result = await mongoose.model("Review").aggregate([
    { $match: { vendor: vendorId, status: "approved" } },
    { $group: { _id: "$vendor", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
  ]);
  if (result.length > 0) {
    await Vendor.findByIdAndUpdate(vendorId, {
      "stats.avgRating": Math.round(result[0].avgRating * 10) / 10,
      "stats.totalReviews": result[0].totalReviews,
    });
  }
}

module.exports = mongoose.model("Review", reviewSchema);
