const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: String,
    image: { url: String, publicId: String },
    mobileImage: { url: String, publicId: String },
    link: String,
    placement: { type: String, enum: ["home", "directory", "marketplace", "events", "dashboard"], default: "home" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bannerSchema.index({ placement: 1, isActive: 1, order: 1 });

module.exports = mongoose.model("Banner", bannerSchema);
