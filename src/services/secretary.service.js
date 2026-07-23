const { ROLES } = require("../constants/roleConfig");
const User = require("../models/User");
const Event = require("../models/Event");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

class SecretaryService {
  // TODO:
  // When the Chapter Management module is implemented,
  // scope dashboard queries using req.user.chapterId so Secretaries
  // only access data belonging to their assigned chapter.
  async getDashboardData(user) {
    const meta = getUserMeta(user);
    const profile = meta.adminProfile || {};
    const org = profile.organization || {};
    const chapterId = org.chapter;

    const filter = { role: { $in: [ROLES.CUSTOMER, "user"] }, status: { $nin: ["pending_approval", "rejected"] } };
    const activeFilter = { role: { $in: [ROLES.CUSTOMER, "user"] }, isActive: true, status: { $nin: ["pending_approval", "rejected"] } };

    if (chapterId) {
      filter["meta.adminProfile.organization.chapter"] = chapterId.toString();
      activeFilter["meta.adminProfile.organization.chapter"] = chapterId.toString();
    }

    const EnterpriseRecord = require("../models/EnterpriseRecord");
    const [totalMembers, activeMembers, attendance, meetings, documents] = await Promise.all([
      User.countDocuments(filter),
      User.countDocuments(activeFilter),
      EnterpriseRecord.countDocuments({ module: "attendance", chapter: chapterId }),
      EnterpriseRecord.countDocuments({ module: "meeting", chapter: chapterId }),
      EnterpriseRecord.countDocuments({ module: "document", chapter: chapterId })
    ]);

    const upcomingMeetings = await Event.find({
      startDate: { $gte: new Date() },
      isActive: true
    })
    .select("title startDate venue type")
    .sort("startDate")
    .limit(5);

    return {
      summary: {
        totalMembers,
        activeMembers,
        attendance,
        meetings,
        documents,
      },
      recentActivities: [],
      upcomingMeetings,
      quickActions: [
        { label: "View Members", to: "/secretary/members" },
        { label: "Record Minutes", to: "/secretary/minutes" },
        { label: "Attendance", to: "/secretary/attendance" },
        { label: "Upload Document", to: "/secretary/documents" },
        { label: "Generate Report", to: "/secretary/reports" }
      ],
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    };
  }

  // Scope all member queries and summary statistics using caller's chapter assignment
  // so each Secretary only accesses members, meetings, attendance, documents,
  // and reports belonging to their assigned chapter.
  async getMembersData(user, { page, limit, skip, search, status }) {
    const meta = getUserMeta(user);
    const profile = meta.adminProfile || {};
    const org = profile.organization || {};
    const chapterId = org.chapter;

    const filter = { role: { $in: [ROLES.CUSTOMER, "user"] } };

    if (chapterId) {
      filter["meta.adminProfile.organization.chapter"] = chapterId.toString();
    }

    const keyword = search?.trim();
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    const baseFilter = { role: { $in: [ROLES.CUSTOMER, "user"] } };
    if (chapterId) {
      baseFilter["meta.adminProfile.organization.chapter"] = chapterId.toString();
    }

    const [items, total, totalMembers, activeMembers, inactiveMembers] = await Promise.all([
      User.find(filter)
        .select("name email phone isActive createdAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
      User.countDocuments(baseFilter),
      User.countDocuments({ ...baseFilter, isActive: true }),
      User.countDocuments({ ...baseFilter, isActive: false })
    ]);

    return {
      items,
      total,
      summary: {
        totalMembers,
        activeMembers,
        inactiveMembers
      }
    };
  }

  // TODO:
  // When the Chapter module and MeetingMinutes model are implemented,
  // scope queries using req.user.chapterId and retrieve
  // chapter-specific meeting minutes.
  async getMinutesData(user, { page, limit, skip, search, status }) {
    const items = [];
    const total = 0;
    return { items, total };
  }

  // TODO:
  // When the Chapter module and Attendance model are implemented,
  // scope queries and summary statistics using req.user.chapterId
  // so every Secretary only accesses data belonging to their own chapter.
  async getAttendanceData(user, { page, limit, skip, search, status }) {
    const items = [];
    const total = 0;
    return { items, total };
  }
}

module.exports = new SecretaryService();
