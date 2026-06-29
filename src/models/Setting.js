const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    group: { type: String, default: "general", trim: true },
    description: String,
    isPublic: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

settingSchema.index({ group: 1 });
settingSchema.index({ isPublic: 1 });

module.exports = mongoose.model("Setting", settingSchema);
