const { ADMIN_ROLE_VALUES } = require("./adminRoles");

const roles = ADMIN_ROLE_VALUES;

const modules = [
  "dashboard",
  "members",
  "meetings",
  "vendors",
  "marketplace",
  "reports",
  "training",
  "events",
  "visitors",
  "attendance",
  "referrals",
  "business",
  "notifications",
  "settings",
  "business_wall",
  "tasks",
  "calendar",
  "workflow",
];

const accessFor = (enabled = true) => ({
  enabled,
  canView: enabled,
  canCreate: enabled,
  canEdit: enabled,
  canDelete: enabled && false,
  canApprove: enabled,
  canExport: enabled,
  canPrint: enabled,
  showSidebar: enabled,
  showDashboardCard: enabled,
  enableNotifications: enabled,
  apiAccess: enabled,
  readOnly: false,
});

const featureMatrix = roles.reduce((result, role) => {
  result[role] = modules.reduce((moduleConfig, moduleName) => {
    const enabled = role === "superadmin" || role === "admin" || role === "custom_admin" || !["vendors", "marketplace", "settings"].includes(moduleName);
    moduleConfig[moduleName] = accessFor(enabled);
    return moduleConfig;
  }, {});
  return result;
}, {});

const dashboardWidgets = {
  superadmin: [
    { id: "membershipGrowth", title: "Membership Growth", enabled: true, order: 1, size: "large" },
    { id: "businessGrowth", title: "Business Growth", enabled: true, order: 2, size: "large" },
    { id: "meetings", title: "Meetings", enabled: true, order: 3, size: "small" },
    { id: "vendors", title: "Vendors", enabled: true, order: 4, size: "small" },
    { id: "visitors", title: "Visitors", enabled: true, order: 5, size: "small" },
    { id: "attendance", title: "Attendance", enabled: true, order: 6, size: "small" },
    { id: "events", title: "Events", enabled: true, order: 7, size: "small" },
    { id: "marketplace", title: "Marketplace", enabled: true, order: 8, size: "small" },
  ],
};

const sidebar = roles.reduce((result, role) => {
  result[role] = modules.map((moduleName, index) => ({
    id: moduleName,
    label: moduleName.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    enabled: featureMatrix[role][moduleName].showSidebar,
    order: index + 1,
  }));
  return result;
}, {});

const workflows = {
  membership: [
    { id: "launch_director", label: "Launch Director", order: 1, requiredRole: "launch_director" },
    { id: "executive_director", label: "Executive Director", order: 2, requiredRole: "executive_director" },
    { id: "verification", label: "Membership Verification Team", order: 3, requiredRole: "admin" },
    { id: "approved", label: "Approved", order: 4, requiredRole: "superadmin" },
  ],
  vendor: [
    { id: "executive_director", label: "Executive Director", order: 1, requiredRole: "executive_director" },
    { id: "marketplace_admin", label: "Marketplace Admin", order: 2, requiredRole: "admin" },
    { id: "approved", label: "Approved", order: 3, requiredRole: "superadmin" },
  ],
};

const organizationTree = [
  {
    id: "india",
    name: "India",
    type: "country",
    status: "active",
    director: "Super Admin",
    children: [],
  },
];

const platformSettings = {
  general: { platformName: "Gloaro Network", timezone: "Asia/Kolkata", maintenanceMode: false },
  branding: { primaryColor: "#0d4697", accentColor: "#ffbf1a" },
  email: { enabled: true },
  sms: { enabled: false },
  whatsapp: { enabled: false },
  notification: { reminders: true, approvals: true, followUps: true },
  security: { passwordPolicy: "strong", sessionTimeoutMinutes: 60, twoFactorRequired: false },
  backup: { automated: true, frequency: "daily" },
};

const superAdminDefaults = {
  roles,
  modules,
  featureMatrix,
  dashboardWidgets,
  sidebar,
  workflows,
  organizationTree,
  platformSettings,
};

module.exports = { superAdminDefaults };
