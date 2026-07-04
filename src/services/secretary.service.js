const User = require("../models/User");
const Event = require("../models/Event");

class SecretaryService {
  // TODO:
  // When the Chapter Management module is implemented,
  // scope dashboard queries using req.user.chapterId so Secretaries
  // only access data belonging to their assigned chapter.
  async getDashboardData(user) {
    const [totalMembers, activeMembers] = await Promise.all([
      User.countDocuments({ role: { $in: ["customer", "user"] } }),
      User.countDocuments({ role: { $in: ["customer", "user"] }, isActive: true })
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
        pendingMinutes: 0,
        attendanceRate: 0,
        documentsUploaded: 0,
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

  // TODO:
  // When the Chapter Management module is implemented,
  // scope all member queries and summary statistics using req.user.chapterId
  // so each Secretary only accesses members, meetings, attendance, documents,
  // and reports belonging to their assigned chapter.
  async getMembersData(user, { page, limit, skip, search, status }) {
    const filter = { role: { $in: ["customer", "user"] } };

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

    const [items, total, totalMembers, activeMembers, inactiveMembers] = await Promise.all([
      User.find(filter)
        .select("name email phone isActive createdAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
      User.countDocuments({ role: { $in: ["customer", "user"] } }),
      User.countDocuments({ role: { $in: ["customer", "user"] }, isActive: true }),
      User.countDocuments({ role: { $in: ["customer", "user"] }, isActive: false })
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
