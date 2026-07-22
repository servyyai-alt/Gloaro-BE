const User = require("../models/User");
const EnterpriseRecord = require("../models/EnterpriseRecord");
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
  async getSecretaryEvents(user, { page, limit, skip, search }) { const filter = { organizer: user._id }; if (search) filter.title = new RegExp(search, "i"); const [items, total] = await Promise.all([Event.find(filter).populate("attendees.user", "name email phone avatar").sort("-startDate").skip(skip).limit(limit).lean(), Event.countDocuments(filter)]); return { items, total }; }
  async createSecretaryEvent(user, body) { return Event.create({ title: body.name || body.title, description: body.description || "", shortDescription: body.description || "", startDate: body.date, endDate: body.endDate || body.date, status: "published", organizer: user._id, type: body.type || "offline" }); }
  async updateEventMembers(user, id, body) { const event = await Event.findOne({ _id: id, organizer: user._id }); if (!event) return null; const member = { user: body.user || undefined, name: body.name, role: body.role, task: body.task, phone: body.phone, assignedDate: body.assignedDate || event.startDate, status: body.status || "registered", attendanceDate: body.attendanceDate, attendanceNote: body.attendanceNote }; const index = body.user ? event.attendees.findIndex((item) => String(item.user) === String(body.user)) : -1; if (index >= 0) event.attendees[index] = { ...event.attendees[index].toObject(), ...member }; else event.attendees.push(member); event.stats.totalRegistrations = event.attendees.length; await event.save(); return Event.findById(id).populate("attendees.user", "name email phone avatar"); }
  async updateEventAttendance(user, id, attendeeId, body) { const event = await Event.findOne({ _id: id, organizer: user._id }); if (!event) return null; const attendee = event.attendees.id(attendeeId); if (!attendee) return null; attendee.status = body.status; attendee.attendanceDate = body.attendanceDate || new Date(); attendee.attendanceNote = body.attendanceNote || ""; await event.save(); return attendee; }
  chapterFilter(user) { const chapter = getUserMeta(user).adminProfile?.organization?.chapter; return chapter ? { chapter } : {}; }
  memberFilter(user) { const filter = { role: { $in: ["customer", "user"] }, status: { $nin: ["pending_approval", "rejected"] } }; const chapter = getUserMeta(user).adminProfile?.organization?.chapter; if (chapter) filter["meta.adminProfile.organization.chapter"] = chapter.toString(); return filter; }

  async getCategories(user, { page, limit, skip, search, status }) { const filter = { module: "secretary_category", ...this.chapterFilter(user) }; if (search) filter.$or = [{ name: new RegExp(search, "i") }, { "metadata.description": new RegExp(search, "i") }]; if (status) filter.status = status; const [items, total] = await Promise.all([EnterpriseRecord.find(filter).sort("-createdAt").skip(skip).limit(limit).lean(), EnterpriseRecord.countDocuments(filter)]); const counts = await User.aggregate([{ $match: this.memberFilter(user) }, { $group: { _id: "$meta.secretaryCategory", count: { $sum: 1 } } }]); const countMap = Object.fromEntries(counts.map((item) => [String(item._id), item.count])); return { items: items.map((item) => ({ ...item, description: item.metadata?.description || "", membersCount: countMap[String(item._id)] || 0 })), total }; }
  async saveCategory(user, id, body) { if (id) return EnterpriseRecord.findOneAndUpdate({ _id: id, module: "secretary_category", ...this.chapterFilter(user) }, { $set: { name: body.name, status: body.status, "metadata.description": body.description || "" } }, { new: true }); return EnterpriseRecord.create({ module: "secretary_category", name: body.name, status: body.status || "active", metadata: { description: body.description || "" }, ...this.chapterFilter(user), createdBy: user._id }); }
  async deleteCategory(user, id) { return EnterpriseRecord.findOneAndDelete({ _id: id, module: "secretary_category", ...this.chapterFilter(user) }); }
  async getMembers(user, { page, limit, skip, search, status, category, role }) { const filter = this.memberFilter(user); if (search) filter.$or = [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }, { phone: new RegExp(search, "i") }]; if (status === "active") filter.isActive = true; if (status === "inactive") filter.isActive = false; if (category) filter["meta.secretaryCategory"] = category; if (role) filter["meta.secretaryRole"] = role; const [items, total] = await Promise.all([User.find(filter).select("name email phone address avatar isActive createdAt memberId meta").sort("-createdAt").skip(skip).limit(limit).lean(), User.countDocuments(filter)]); const ids = items.map((item) => item._id); const [tasks, attendance] = await Promise.all([EnterpriseRecord.aggregate([{ $match: { module: "task", assignedTo: { $in: ids }, ...this.chapterFilter(user) } }, { $group: { _id: "$assignedTo", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, pending: { $sum: { $cond: [{ $in: ["$status", ["draft", "pending", "under_review"]] }, 1, 0] } } } }]), EnterpriseRecord.find({ module: "attendance", assignedTo: { $in: ids }, ...this.chapterFilter(user) }).sort("-createdAt").lean()]); const taskMap = Object.fromEntries(tasks.map((item) => [String(item._id), item])); const today = new Date(); today.setHours(0, 0, 0, 0); const attendanceMap = {}; attendance.filter((item) => new Date(item.createdAt) >= today).forEach((item) => { attendanceMap[String(item.assignedTo)] = item.metadata?.attendanceStatus || "" }); return { items: items.map((item) => ({ ...item, secretaryRole: item.meta?.secretaryRole || "Member", category: item.meta?.secretaryCategory || "", todayAttendance: attendanceMap[String(item._id)] || "Not marked", taskStats: taskMap[String(item._id)] || { total: 0, completed: 0, pending: 0 } })), total }; }
  async createMember(user, body) { const member = await User.create({ name: body.name, email: body.email, phone: body.phone, password: body.password || `Gloaro@${Math.random().toString(36).slice(2, 10)}`, role: "customer", status: "approved", isActive: body.status !== "inactive", address: body.address, meta: { secretaryRole: body.role || "Member", secretaryCategory: body.category } }); return User.findById(member._id).select("-password").lean(); }
  async getMember(user, id) { const member = await User.findOne({ ...this.memberFilter(user), _id: id }).select("-password").lean(); if (!member) return null; const [tasks, attendance] = await Promise.all([EnterpriseRecord.find({ module: "task", assignedTo: id, ...this.chapterFilter(user) }).sort("-createdAt").lean(), EnterpriseRecord.find({ module: "attendance", assignedTo: id, ...this.chapterFilter(user) }).sort("-createdAt").lean()]); return { ...member, secretaryRole: member.meta?.secretaryRole || "Member", category: member.meta?.secretaryCategory || "", tasks, attendance }; }
  async updateMember(user, id, body) { return User.findOneAndUpdate({ ...this.memberFilter(user), _id: id }, { $set: { name: body.name, phone: body.phone, address: body.address, isActive: body.status !== "inactive", "meta.secretaryRole": body.role || body.secretaryRole, "meta.secretaryCategory": body.category } }, { new: true }).select("-password").lean(); }
  async deleteMember(user, id) { return User.findOneAndDelete({ ...this.memberFilter(user), _id: id }); }
  async getRecords(user, module, { page, limit, skip, search, status, member }) { const filter = { module, ...this.chapterFilter(user) }; if (status) filter.status = status; if (member) filter.assignedTo = member; if (search) filter.name = new RegExp(search, "i"); const [items, total] = await Promise.all([EnterpriseRecord.find(filter).populate("assignedTo", "name email").sort("-createdAt").skip(skip).limit(limit).lean(), EnterpriseRecord.countDocuments(filter)]); return { items, total }; }
  async saveRecord(user, module, id, body) { const data = { name: body.title || body.name || `${module} record`, status: body.status || "pending", assignedTo: body.member || body.assignedTo, updatedBy: user._id, metadata: { ...body, attendanceStatus: body.attendanceStatus } }; if (id) return EnterpriseRecord.findOneAndUpdate({ _id: id, module, ...this.chapterFilter(user) }, { $set: data }, { new: true }); return EnterpriseRecord.create({ module, ...this.chapterFilter(user), ...data, createdBy: user._id }); }
  async deleteRecord(user, module, id) { return EnterpriseRecord.findOneAndDelete({ _id: id, module, ...this.chapterFilter(user) }); }
  // TODO:
  // When the Chapter Management module is implemented,
  // scope dashboard queries using req.user.chapterId so Secretaries
  // only access data belonging to their assigned chapter.
  async getDashboardData(user) {
    const meta = getUserMeta(user);
    const profile = meta.adminProfile || {};
    const org = profile.organization || {};
    const chapterId = org.chapter;

    const filter = { role: { $in: ["customer", "user"] }, status: { $nin: ["pending_approval", "rejected"] } };
    const activeFilter = { role: { $in: ["customer", "user"] }, isActive: true, status: { $nin: ["pending_approval", "rejected"] } };

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

    const filter = { role: { $in: ["customer", "user"] } };

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

    const baseFilter = { role: { $in: ["customer", "user"] } };
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
