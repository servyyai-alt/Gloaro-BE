const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    sequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Counter", counterSchema);
