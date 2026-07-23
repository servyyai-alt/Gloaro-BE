const { ROLES } = require("../constants/roleConfig");
const Permission = require("../models/Permission");
const RolePermission = require("../models/RolePermission");
const UserPermission = require("../models/UserPermission");
const AuditLog = require("../models/AuditLog");

const ALL_MODULES = [
  "dashboard", "members", "meetings", "attendance", "visitors", "business_wall",
  "referrals", "training", "events", "announcements", "reports", "marketplace",
  ROLES.VENDOR, "products", "services", "payments", "orders", "coupons", "subscriptions",
  "support", "organization", "users", "roles", "permissions", "audit_logs",
  "settings", "notifications", "community", "ai_insights", "calendar",
  "leaderboard", "business_directory", "chat", "tasks", "help_desk",
  "qr_attendance", "digital_membership_card"
];

const ALL_ACTIONS = [
  "view", "create", "edit", "delete", "approve", "reject", "assign", "export",
  "print", "download", "upload", "manage"
];

class PermissionService {
  async seedPermissions() {
    try {
      const count = await Permission.countDocuments();
      let allPermCodes = [];

      if (count === 0) {
        const permDocs = [];
        for (const mod of ALL_MODULES) {
          for (const act of ALL_ACTIONS) {
            permDocs.push({
              name: `${mod}.${act}`,
              code: `${mod}.${act}`,
              module: mod,
              page: `${mod}_page`,
              action: act,
              description: `Permission to perform ${act} on ${mod}`,
              category: mod
            });
          }
        }
        await Permission.insertMany(permDocs);
        console.log(`Seeded ${permDocs.length} system permissions.`);
        allPermCodes = permDocs.map(p => p.code);
      } else {
        const existing = await Permission.find().select("code");
        allPermCodes = existing.map(p => p.code);
      }

      // Seed/Upsert default RolePermissions
      const rolePermissionsData = [
        {
          role: ROLES.SUPERADMIN,
          permissions: allPermCodes
        },
        {
          role: ROLES.ADMIN,
          permissions: allPermCodes.filter(c => !c.includes("login-as"))
        },
        {
          role: ROLES.CHAPTER_PRESIDENT,
          permissions: allPermCodes.filter(c => 
            c.startsWith("dashboard") || c.startsWith("members") || c.startsWith("meetings") || 
            c.startsWith("attendance") || c.startsWith("visitors") || c.startsWith("reports") ||
            c.startsWith("business_wall") || c.startsWith("referrals") || c.startsWith("community")
          )
        },
        {
          role: ROLES.VICE_PRESIDENT,
          permissions: allPermCodes.filter(c => 
            c.startsWith("dashboard") || c.startsWith("members") || c.startsWith("meetings") || 
            c.startsWith("attendance") || c.startsWith("visitors") || c.startsWith("reports") ||
            c.startsWith("business_wall") || c.startsWith("referrals") || c.startsWith("community") ||
            c.startsWith("announcements")
          )
        },
        {
          role: ROLES.SECRETARY,
          permissions: allPermCodes.filter(c => 
            c.startsWith("dashboard") || c.startsWith("members.view") || c.startsWith("meetings") || 
            c.startsWith("attendance") || c.startsWith("visitors") || c.startsWith("reports")
          )
        },
        {
          role: ROLES.CUSTOMER,
          permissions: allPermCodes.filter(c => 
            c.endsWith(".view") || c.startsWith("dashboard") || c.startsWith("business_wall") || 
            c.startsWith("referrals") || c.startsWith("one_to_one") || c.startsWith("visitors") ||
            c.startsWith("calendar") || c.startsWith("chat") || c.startsWith("digital_membership_card")
          )
        },
        ...[ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR, ROLES.DISTRICT_DIRECTOR, ROLES.EXECUTIVE_DIRECTOR, ROLES.LAUNCH_DIRECTOR, ROLES.DIRECT_CONSULTANT].map(r => ({
          role: r,
          permissions: allPermCodes.filter(c => 
            c.startsWith("dashboard") || c.startsWith("members") || c.startsWith("meetings") || 
            c.startsWith("attendance") || c.startsWith("visitors") || c.startsWith("reports") ||
            c.startsWith("business_wall") || c.startsWith("referrals") || c.startsWith("community") ||
            c.startsWith("announcements") || c.startsWith(ROLES.VENDOR) || c.startsWith("products") ||
            c.startsWith("services") || c.startsWith("payments") || c.startsWith("orders") ||
            c.startsWith("subscriptions") || c.startsWith("marketplace") || c.startsWith("leads")
          )
        }))
      ];

      for (const rpData of rolePermissionsData) {
        await RolePermission.findOneAndUpdate(
          { role: rpData.role },
          { permissions: rpData.permissions },
          { upsert: true, new: true }
        );
      }

      console.log("Seeded/Upserted default role permission maps successfully.");
    } catch (err) {
      console.error("Error seeding permissions:", err.message);
    }
  }

  async hasPermission(userId, role, permissionCode) {
    if (role === ROLES.SUPERADMIN) return true;

    let checkRole = role;
    if (role === ROLES.VENDOR) {
      const vendorPrefixes = [ROLES.VENDOR, "products", "services", "payments", "orders", "subscriptions", "marketplace", "leads"];
      if (vendorPrefixes.some(pref => permissionCode.startsWith(pref))) {
        return true;
      }
      checkRole = ROLES.CUSTOMER;
    }

    // 1. Check custom user overrides
    const userPerm = await UserPermission.findOne({ userId });
    if (userPerm && !userPerm.inherited) {
      return userPerm.permissions.includes(permissionCode);
    }

    // 2. Check role default mappings
    const rolePerm = await RolePermission.findOne({ role: checkRole });
    if (rolePerm) {
      return rolePerm.permissions.includes(permissionCode);
    }

    return false;
  }

  async getUserPermissionsList(userId, role) {
    if (role === ROLES.SUPERADMIN) {
      const all = await Permission.find().select("code");
      return all.map(p => p.code);
    }

    let checkRole = role;
    let extraPerms = [];
    if (role === ROLES.VENDOR) {
      checkRole = ROLES.CUSTOMER;
      const allVendorPerms = await Permission.find({
        module: { $in: [ROLES.VENDOR, "products", "services", "payments", "orders", "subscriptions", "marketplace", "leads"] }
      }).select("code");
      extraPerms = allVendorPerms.map(p => p.code);
    }

    const userPerm = await UserPermission.findOne({ userId });
    if (userPerm && !userPerm.inherited) {
      return [...new Set([...userPerm.permissions, ...extraPerms])];
    }

    const rolePerm = await RolePermission.findOne({ role: checkRole });
    if (rolePerm) {
      return [...new Set([...rolePerm.permissions, ...extraPerms])];
    }

    return extraPerms;
  }

  async assignUserPermissions(callerId, targetUserId, permissionsArray, ipAddress, userAgent) {
    // Immediate supervisor check: Caller cannot assign permissions they themselves do not possess
    const caller = await require("../models/User").findById(callerId);
    if (!caller) throw new Error("Caller user not found");

    if (caller.role !== ROLES.SUPERADMIN) {
      const callerPerms = await this.getUserPermissionsList(caller._id, caller.role);
      for (const p of permissionsArray) {
        if (!callerPerms.includes(p)) {
          throw new Error(`Unauthorized: You cannot assign the permission '${p}' as you do not possess it yourself.`);
        }
      }
    }

    let userPerm = await UserPermission.findOne({ userId: targetUserId });
    const oldVal = userPerm ? userPerm.permissions : [];
    
    if (!userPerm) {
      userPerm = new UserPermission({
        userId: targetUserId,
        permissions: permissionsArray,
        inherited: false,
        assignedBy: callerId
      });
    } else {
      userPerm.permissions = permissionsArray;
      userPerm.inherited = false;
      userPerm.assignedBy = callerId;
      userPerm.assignedDate = new Date();
    }
    await userPerm.save();

    // Log permission change to AuditLog
    await AuditLog.create({
      user: callerId,
      action: "permission_change",
      resource: "UserPermission",
      resourceId: userPerm._id,
      details: {
        assignedTo: targetUserId,
        oldValue: oldVal,
        newValue: permissionsArray
      },
      ipAddress,
      userAgent
    });

    return userPerm;
  }
}

module.exports = new PermissionService();
