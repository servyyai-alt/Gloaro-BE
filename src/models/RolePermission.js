const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, unique: true },
    permissions: [{ type: String }], // Array of permission codes e.g. ["members.view", "members.create"]
  },
  { timestamps: true }
);

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
