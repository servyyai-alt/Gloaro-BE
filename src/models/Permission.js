const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    module: { type: String, required: true },
    page: { type: String, required: true },
    action: { type: String, required: true },
    description: String,
    category: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
