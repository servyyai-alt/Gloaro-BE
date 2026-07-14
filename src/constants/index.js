// =============================================
// APP CONSTANTS
// =============================================

const ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN: "admin",
  CUSTOM_ADMIN: "custom_admin",
  VENDOR: "vendor",
  USER: "user",
};

const VENDOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
};

const MEMBERSHIP_PLANS = {
  FREE: "free",
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
};

const MEMBERSHIP_PLAN_WEIGHTS = {
  free: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
};

const LEAD_STATUS = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  PROPOSAL_SENT: "proposal_sent",
  WON: "won",
  LOST: "lost",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
};

const PAYMENT_GATEWAYS = {
  RAZORPAY: "razorpay",
  STRIPE: "stripe",
  FREE: "free",
};

const NOTIFICATION_TYPES = {
  LEAD_NEW: "lead_new",
  LEAD_UPDATE: "lead_update",
  REVIEW_NEW: "review_new",
  REVIEW_REPLY: "review_reply",
  MEMBERSHIP_EXPIRY: "membership_expiry",
  MEMBERSHIP_ACTIVATED: "membership_activated",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILED: "payment_failed",
  VENDOR_APPROVED: "vendor_approved",
  VENDOR_REJECTED: "vendor_rejected",
  EVENT_REMINDER: "event_reminder",
  EVENT_REGISTRATION: "event_registration",
  REFERRAL_REWARD: "referral_reward",
  PRODUCT_APPROVED: "product_approved",
  SERVICE_APPROVED: "service_approved",
  SUPPORT_REPLY: "support_reply",
  SYSTEM: "system",
  ANNOUNCEMENT: "announcement",
};

const SUPPORT_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_FOR_USER: "waiting_for_user",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

const SUPPORT_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

const CATEGORY_TYPES = {
  BUSINESS: "business",
  PRODUCT: "product",
  SERVICE: "service",
};

const SERVICE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DRAFT: "draft",
};

const PRODUCT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DRAFT: "draft",
};

const EVENT_TYPE = {
  ONLINE: "online",
  OFFLINE: "offline",
  HYBRID: "hybrid",
};

const EVENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

const REFERRAL_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REWARDED: "rewarded",
  EXPIRED: "expired",
};

// File upload limits
const UPLOAD_LIMITS = {
  IMAGE_SIZE_MB: 5,
  MAX_PRODUCT_IMAGES: 10,
  MAX_SERVICE_GALLERY: 10,
  MAX_REVIEW_IMAGES: 3,
  MAX_SUPPORT_ATTACHMENTS: 5,
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

const MAX_MEMBERS_PER_CHAPTER = 70;

module.exports = {
  ROLES,
  VENDOR_STATUS,
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLAN_WEIGHTS,
  LEAD_STATUS,
  PAYMENT_STATUS,
  PAYMENT_GATEWAYS,
  NOTIFICATION_TYPES,
  SUPPORT_STATUS,
  SUPPORT_PRIORITY,
  CATEGORY_TYPES,
  SERVICE_STATUS,
  PRODUCT_STATUS,
  EVENT_TYPE,
  EVENT_STATUS,
  REFERRAL_STATUS,
  UPLOAD_LIMITS,
  PAGINATION,
  MAX_MEMBERS_PER_CHAPTER,
};
