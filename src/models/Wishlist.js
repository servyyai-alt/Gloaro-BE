const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    itemType: { type: String, enum: ["vendor", "product", "service"], required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    notes: String,
  },
  { timestamps: true }
);

wishlistSchema.index({ user: 1, itemType: 1 });
wishlistSchema.index({ user: 1, vendor: 1 }, { unique: true, sparse: true });
wishlistSchema.index({ user: 1, product: 1 }, { unique: true, sparse: true });
wishlistSchema.index({ user: 1, service: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Wishlist", wishlistSchema);
