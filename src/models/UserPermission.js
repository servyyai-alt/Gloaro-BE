const mongoose = require("mongoose");

const userPermissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    permissions: [{ type: String }], // Custom overrides array of permission codes
    inherited: { type: Boolean, default: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserPermission", userPermissionSchema);
