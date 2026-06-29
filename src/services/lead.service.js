const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const Notification = require("../models/Notification");
const { AppError } = require("../middleware/errorHandler");
const { getPagination } = require("../utils/response");
const { sendTemplateEmail } = require("../utils/email");
const { getSocketIO } = require("../sockets");

class LeadService {
  async submitLead(data, submittedBy, ipAddress, userAgent) {
    const vendor = await Vendor.findById(data.vendor).populate("user", "email name");
    if (!vendor) throw new AppError("Vendor not found", 404);
    if (vendor.status !== "approved") throw new AppError("Vendor is not active", 400);

    const lead = await Lead.create({
      ...data,
      submittedBy: submittedBy || null,
      ipAddress,
      userAgent,
    });

    // Update vendor lead count
    await Vendor.findByIdAndUpdate(data.vendor, { $inc: { "stats.totalLeads": 1 } });

    // Notify vendor
    await Notification.create({
      recipient: vendor.user._id,
      type: "lead_new",
      title: "New Enquiry Received",
      message: `New enquiry from ${lead.name}`,
      link: `/vendor/leads/${lead._id}`,
    });

    // Real-time socket notification
    const io = getSocketIO();
    if (io) {
      io.to(`vendor:${vendor._id}`).emit("new_lead", {
        leadId: lead._id,
        name: lead.name,
        phone: lead.phone,
        subject: lead.subject,
      });
    }

    // Email notification to vendor
    try {
      await sendTemplateEmail(vendor.user.email, "newLead", vendor.businessName, lead.name, lead.phone);
    } catch (_) {}

    return lead;
  }

  async getLeads(query, userId, role, vendorId) {
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (role === "vendor") {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor) throw new AppError("Vendor profile not found", 404);
      filter.vendor = vendor._id;
    } else if (["customer", "user"].includes(role)) {
      filter.submittedBy = userId;
    } else if (vendorId) {
      filter.vendor = vendorId;
    }

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate("vendor", "businessName")
        .populate("submittedBy", "name email")
        .populate("assignedTo", "name email")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);

    return { leads, total, page, limit };
  }

  async getLeadById(leadId, userId, role) {
    const lead = await Lead.findById(leadId)
      .populate("vendor")
      .populate("submittedBy", "name email")
      .populate("assignedTo", "name email")
      .populate("notes.addedBy", "name");

    if (!lead) throw new AppError("Lead not found", 404);

    if (role === "vendor") {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor || lead.vendor._id.toString() !== vendor._id.toString()) {
        throw new AppError("Not authorized", 403);
      }
    } else if (["customer", "user"].includes(role)) {
      if (!lead.submittedBy || lead.submittedBy._id.toString() !== userId.toString()) {
        throw new AppError("Not authorized", 403);
      }
    }

    // Mark as read
    if (!lead.isRead) {
      lead.isRead = true;
      lead.readAt = new Date();
      await lead.save();
    }

    return lead;
  }

  async updateLeadStatus(leadId, status, userId, role) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new AppError("Lead not found", 404);

    if (role === "vendor") {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor || lead.vendor.toString() !== vendor._id.toString()) {
        throw new AppError("Not authorized", 403);
      }
    } else if (!["admin", "superadmin"].includes(role)) {
      throw new AppError("Not authorized", 403);
    }

    const oldStatus = lead.status;
    lead.status = status;

    if (status === "won") lead.wonAt = new Date();
    if (status === "lost") lead.lostAt = new Date();

    await lead.save();
    return lead;
  }

  async assertLeadManager(lead, userId, role) {
    if (role === "vendor") {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor || lead.vendor.toString() !== vendor._id.toString()) {
        throw new AppError("Not authorized", 403);
      }
      return;
    }

    if (!["admin", "superadmin"].includes(role)) {
      throw new AppError("Not authorized", 403);
    }
  }

  async addNote(leadId, content, userId, role, isInternal) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new AppError("Lead not found", 404);
    await this.assertLeadManager(lead, userId, role);

    lead.notes.push({ content, addedBy: userId, isInternal });
    await lead.save();
    return lead;
  }

  async scheduleFollowUp(leadId, followUpData, userId, role) {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new AppError("Lead not found", 404);
    await this.assertLeadManager(lead, userId, role);

    lead.followUps.push(followUpData);
    await lead.save();
    return lead;
  }

  async assignLead(leadId, assignedTo, role) {
    if (!["admin", "superadmin"].includes(role)) throw new AppError("Not authorized", 403);
    const lead = await Lead.findByIdAndUpdate(leadId, { assignedTo }, { new: true }).populate("assignedTo", "name email");
    if (!lead) throw new AppError("Lead not found", 404);
    return lead;
  }

  async getLeadAnalytics(vendorId) {
    const vendor = vendorId ? { vendor: vendorId } : {};
    const stats = await Lead.aggregate([
      { $match: vendor },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDealValue: { $sum: "$dealValue" },
        },
      },
    ]);

    const monthly = await Lead.aggregate([
      { $match: vendor },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    return { byStatus: stats, monthly };
  }
}

module.exports = new LeadService();
