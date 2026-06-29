const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: "general", trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

faqSchema.index({ category: 1, isActive: 1, order: 1 });
faqSchema.index({ question: "text", answer: "text" });

module.exports = mongoose.model("FAQ", faqSchema);
