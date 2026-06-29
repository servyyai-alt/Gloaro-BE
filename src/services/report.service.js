const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Payment = require("../models/Payment");
const Lead = require("../models/Lead");
const Product = require("../models/Product");
const Service = require("../models/Service");
const Event = require("../models/Event");
const Category = require("../models/Category");
const { Membership } = require("../models/Membership");
const moment = require("moment");

class ReportService {
  async getUserReport(query = {}) {
    const { from, to } = this._getDateRange(query);
    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    const [total, byRole, newThisMonth, verified] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.countDocuments(dateFilter),
      User.countDocuments({ isEmailVerified: true }),
    ]);

    const monthly = await User.aggregate([
      { $match: dateFilter },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return { total, byRole, newThisMonth, verified, unverified: total - verified, monthly };
  }

  async getVendorReport(query = {}) {
    const { from, to } = this._getDateRange(query);
    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    const [total, byStatus, byPlan, featured, verified, newVendors] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Vendor.aggregate([{ $group: { _id: "$membership.plan", count: { $sum: 1 } } }]),
      Vendor.countDocuments({ isFeatured: true }),
      Vendor.countDocuments({ isVerified: true }),
      Vendor.countDocuments(dateFilter),
    ]);

    const topByLeads = await Vendor.find().sort("-stats.totalLeads").limit(10).select("businessName stats.totalLeads");

    return { total, byStatus, byPlan, featured, verified, newVendors, topByLeads };
  }

  async getRevenueReport(query = {}) {
    const { from, to } = this._getDateRange(query);

    const [totalRevenue, byGateway, byType, monthly] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "completed", createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$gateway", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "completed", createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    return {
      totalRevenue: totalRevenue[0]?.total || 0,
      totalTransactions: totalRevenue[0]?.count || 0,
      byGateway,
      byType,
      monthly,
    };
  }

  async getMembershipReport() {
    const [byPlan, active, expiringSoon] = await Promise.all([
      Membership.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 }, revenue: { $sum: "$price" } } }]),
      Membership.countDocuments({ status: "active" }),
      Membership.countDocuments({
        status: "active",
        endDate: { $lte: moment().add(7, "days").toDate(), $gte: new Date() },
      }),
    ]);

    return { byPlan, active, expiringSoon };
  }

  async getLeadReport(query = {}) {
    const { from, to } = this._getDateRange(query);
    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    const [byStatus, bySource, total, won, lost] = await Promise.all([
      Lead.aggregate([{ $match: dateFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: dateFilter }, { $group: { _id: "$source", count: { $sum: 1 } } }]),
      Lead.countDocuments(dateFilter),
      Lead.countDocuments({ ...dateFilter, status: "won" }),
      Lead.countDocuments({ ...dateFilter, status: "lost" }),
    ]);

    const conversionRate = total > 0 ? ((won / total) * 100).toFixed(2) : 0;

    return { byStatus, bySource, total, won, lost, conversionRate };
  }

  async getProductReport() {
    const [total, byStatus, topViewed, lowStock] = await Promise.all([
      Product.countDocuments(),
      Product.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Product.find({ status: "approved" }).sort("-stats.views").limit(10).select("title stats.views"),
      Product.find({ "inventory.quantity": { $lte: 10 }, "inventory.isUnlimited": false }).select("title inventory.quantity"),
    ]);

    return { total, byStatus, topViewed, lowStock };
  }

  async getServiceReport() {
    const [total, byStatus, topViewed] = await Promise.all([
      Service.countDocuments(),
      Service.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Service.find({ status: "approved" }).sort("-stats.views").limit(10).select("title stats.views"),
    ]);

    return { total, byStatus, topViewed };
  }

  async getEventReport() {
    const [total, byStatus, upcoming] = await Promise.all([
      Event.countDocuments(),
      Event.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Event.countDocuments({ startDate: { $gte: new Date() }, status: "published" }),
    ]);

    return { total, byStatus, upcoming };
  }

  async getAnalyticsSummary(query = {}) {
    const { from, to } = this._getDateRange(query);
    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    const [
      monthlyRevenue,
      monthlyUsers,
      monthlyVendors,
      membershipSales,
      topVendors,
      topCategories,
      popularProducts,
      popularServices,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "completed", ...dateFilter } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$amount" },
            transactions: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      User.aggregate([
        { $match: dateFilter },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, users: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Vendor.aggregate([
        { $match: dateFilter },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, vendors: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Membership.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$plan", sales: { $sum: 1 }, revenue: { $sum: "$price" } } },
        { $sort: { revenue: -1 } },
      ]),
      Vendor.find({ status: "approved" })
        .sort("-stats.totalLeads -stats.totalViews -stats.avgRating")
        .limit(10)
        .select("businessName slug logo stats membership.plan"),
      Category.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: "vendors",
            localField: "_id",
            foreignField: "businessCategory",
            as: "vendors",
          },
        },
        {
          $project: {
            name: 1,
            slug: 1,
            vendorCount: { $size: "$vendors" },
          },
        },
        { $sort: { vendorCount: -1 } },
        { $limit: 10 },
      ]),
      Product.find({ status: "approved", isActive: true })
        .sort("-stats.views -stats.orders -stats.avgRating")
        .limit(10)
        .select("title slug images pricing stats"),
      Service.find({ status: "approved", isActive: true })
        .sort("-stats.views -stats.inquiries -stats.avgRating")
        .limit(10)
        .select("title slug gallery pricing stats"),
    ]);

    return {
      monthlyRevenue,
      monthlyUsers,
      monthlyVendors,
      membershipSales,
      topVendors,
      topCategories,
      popularProducts,
      popularServices,
    };
  }

  _getDateRange(query) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : moment(to).subtract(30, "days").toDate();
    return { from, to };
  }
}

module.exports = new ReportService();
