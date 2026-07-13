const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { 
      type: String, 
      enum: ["requirement", "opportunity", "offer", "achievement", "success_story", "launch", "promotion", "other", "business_opportunity", "business_requirement", "referral_request", "announcement", "event"],
      default: "announcement"
    },
    content: { type: String, required: true },
    media: [{ url: String, mediaType: { type: String, enum: ["image", "video", "document"] } }],
    visibility: { type: String, enum: ["chapter", "district", "state", "region", "global"], default: "chapter" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
    district: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
    state: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
    region: { type: mongoose.Schema.Types.ObjectId, ref: "EnterpriseRecord" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
