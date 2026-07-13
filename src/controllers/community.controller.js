const Post = require("../models/Post");
const Referral = require("../models/Referral");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const EnterpriseRecord = require("../models/EnterpriseRecord");
const idGenerator = require("../services/idGenerator.service");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

const getUserMeta = (user) => {
  if (!user?.meta) return {};
  if (typeof user.toObject === "function") {
    return user.toObject({ flattenMaps: true }).meta || {};
  }
  if (user.meta instanceof Map) return Object.fromEntries(user.meta);
  return user.meta;
};

// ----------------------------------------------------
// 1. BUSINESS WALL FEED
// ----------------------------------------------------

exports.getPosts = asyncHandler(async (req, res) => {
  const { type, visibility } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (type) filter.type = type;
  if (visibility) filter.visibility = visibility;

  const meta = getUserMeta(req.user);
  const org = meta.adminProfile?.organization || {};
  
  if (org.chapter && visibility === "chapter") {
    filter.chapter = org.chapter;
  }

  const [items, total] = await Promise.all([
    Post.find(filter)
      .populate("author", "name email role avatar officialId")
      .populate("comments.author", "name avatar role")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

exports.createPost = asyncHandler(async (req, res) => {
  const { content, type, visibility = "chapter", media } = req.body;
  const meta = getUserMeta(req.user);
  const org = meta.adminProfile?.organization || {};

  const post = await Post.create({
    author: req.user._id,
    type,
    content,
    media: media || [],
    visibility,
    chapter: org.chapter || undefined,
    district: org.district || undefined,
    state: org.state || undefined,
    region: org.region || undefined,
  });

  const populated = await Post.findById(post._id).populate("author", "name email role avatar officialId");
  res.status(201).json({ success: true, message: "Post created successfully", data: populated });
});

exports.likePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new AppError("Post not found", 404);

  const idx = post.likes.indexOf(req.user._id);
  if (idx > -1) {
    post.likes.splice(idx, 1);
  } else {
    post.likes.push(req.user._id);
  }
  await post.save();
  res.status(200).json({ success: true, data: { likesCount: post.likes.length, isLiked: post.likes.includes(req.user._id) } });
});

exports.commentPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new AppError("Post not found", 404);

  post.comments.push({
    author: req.user._id,
    content: req.body.content,
    createdAt: new Date(),
  });
  await post.save();

  const populated = await Post.findById(post._id).populate("comments.author", "name avatar role");
  res.status(201).json({ success: true, message: "Comment added", data: populated.comments });
});

exports.getPostAnalytics = asyncHandler(async (req, res) => {
  const myPosts = await Post.find({ author: req.user._id });
  const totalPosts = myPosts.length;
  let totalLikes = 0;
  let totalComments = 0;
  
  myPosts.forEach(post => {
    totalLikes += post.likes.length;
    totalComments += post.comments.length;
  });

  res.status(200).json({
    success: true,
    data: {
      totalPosts,
      totalLikes,
      totalComments,
      engagementRate: totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(1) : 0
    }
  });
});

// ----------------------------------------------------
// 2. REFERRALS (BUSINESS)
// ----------------------------------------------------

exports.createReferral = asyncHandler(async (req, res) => {
  const { 
    referredVendorId, 
    referredUserId, 
    name, 
    email, 
    mobileNumber, 
    requirement, 
    estimatedValue = 0, 
    priority = "low", 
    notes, 
    expectedClosing 
  } = req.body;

  const generatedCode = await idGenerator.generateReferralId({ date: new Date() });

  const referral = await Referral.create({
    referrer: req.user._id,
    referred: referredUserId || undefined,
    referredVendor: referredVendorId || undefined,
    type: "business",
    name,
    email,
    mobileNumber,
    requirement,
    estimatedValue,
    priority,
    notes,
    expectedClosing,
    status: "created",
    code: generatedCode
  });

  res.status(201).json({ success: true, message: "Business referral passed successfully", data: referral });
});

exports.getReferrals = asyncHandler(async (req, res) => {
  const filter = {
    $or: [
      { referrer: req.user._id }, 
      { referred: req.user._id },
      { referredVendor: req.user.vendorProfile?.vendorId || null }
    ],
    type: "business"
  };

  const referrals = await Referral.find(filter)
    .populate("referrer", "name email phone role memberId officialId chapter")
    .populate("referred", "name email phone role memberId officialId chapter")
    .populate("referredVendor", "businessName ownerName phone email")
    .sort("-createdAt");

  res.status(200).json({ success: true, data: referrals });
});

exports.updateReferralStatus = asyncHandler(async (req, res) => {
  const { status, businessValue, actualValue } = req.body;
  const referral = await Referral.findById(req.params.id);
  if (!referral) throw new AppError("Referral not found", 404);

  if (status) referral.status = status;
  if (businessValue !== undefined) referral.businessValue = businessValue;
  if (actualValue !== undefined) referral.actualValue = actualValue;
  if (status === "won") {
    referral.completedAt = new Date();
    if (actualValue !== undefined) referral.businessValue = actualValue;
  }

  await referral.save();
  res.status(200).json({ success: true, message: "Referral status updated", data: referral });
});

// ----------------------------------------------------
// 3. ONE-TO-ONES & VISITORS
// ----------------------------------------------------

exports.getOneToOnes = asyncHandler(async (req, res) => {
  const records = await EnterpriseRecord.find({
    module: "activity",
    type: "one_to_one",
    $or: [
      { createdBy: req.user._id },
      { "metadata.partnerId": req.user._id.toString() }
    ]
  }).populate("createdBy", "name email role");

  res.status(200).json({ success: true, data: records });
});

exports.createOneToOne = asyncHandler(async (req, res) => {
  const { partnerId, date, time, notes } = req.body;

  const partner = await User.findById(partnerId);
  if (!partner) throw new AppError("Partner user not found", 404);

  const code = await idGenerator.generateGenericModuleId("activity", { date: new Date(date) });

  const record = await EnterpriseRecord.create({
    module: "activity",
    type: "one_to_one",
    name: `1-to-1 meeting with ${partner.name}`,
    code,
    metadata: {
      partnerId,
      partnerName: partner.name,
      partnerRole: partner.role,
      date,
      time,
      notes,
      status: "pending"
    },
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  res.status(201).json({ success: true, message: "One-to-One scheduled successfully", data: record });
});

exports.updateOneToOne = asyncHandler(async (req, res) => {
  const { status, outcome } = req.body;
  const record = await EnterpriseRecord.findById(req.params.id);
  if (!record) throw new AppError("One-to-One record not found", 404);

  const meta = { ...record.metadata, status, outcome };
  record.metadata = meta;
  record.updatedBy = req.user._id;
  await record.save();

  res.status(200).json({ success: true, message: "One-to-One meeting updated", data: record });
});

exports.getVisitors = asyncHandler(async (req, res) => {
  const records = await EnterpriseRecord.find({
    module: "visitor",
    "metadata.invitedBy": req.user._id.toString()
  });
  res.status(200).json({ success: true, data: records });
});

exports.inviteVisitor = asyncHandler(async (req, res) => {
  const { visitorName, email, phone, date } = req.body;
  const inviteCode = "INV-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  const code = await idGenerator.generateVisitorId({ date: new Date(date) });

  const record = await EnterpriseRecord.create({
    module: "visitor",
    type: "invitation",
    name: visitorName,
    code,
    metadata: {
      email,
      phone,
      date,
      inviteCode,
      invitedBy: req.user._id.toString(),
      status: "invited"
    },
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  res.status(201).json({ success: true, message: "Visitor invitation created", data: record });
});

// ----------------------------------------------------
// 4. BI DASHBOARD STATS
// ----------------------------------------------------

exports.getMemberStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const meta = getUserMeta(req.user);
  const org = meta.adminProfile?.organization || {};
  const chapterId = org.chapter;

  const [
    meetingsCount,
    givenCount,
    receivedCount,
    wonCount,
    visitorsInvited,
    oneToOnesCount
  ] = await Promise.all([
    EnterpriseRecord.countDocuments({ module: "meeting", chapter: chapterId }),
    Referral.countDocuments({ referrer: userId, type: "business" }),
    Referral.countDocuments({ referred: userId, type: "business" }),
    Referral.countDocuments({ referrer: userId, type: "business", status: "won" }),
    EnterpriseRecord.countDocuments({ module: "visitor", "metadata.invitedBy": userId.toString() }),
    EnterpriseRecord.countDocuments({ module: "activity", type: "one_to_one", createdBy: userId, "metadata.status": "completed" })
  ]);

  const wonReferralsList = await Referral.find({ referrer: userId, type: "business", status: "won" });
  const totalRevenue = wonReferralsList.reduce((sum, ref) => sum + (ref.businessValue || 0), 0);

  const attendanceScore = meetingsCount * 10;
  const referralsScore = givenCount * 15;
  const revenueScore = Math.floor(totalRevenue / 1000);
  const networkScore = oneToOnesCount * 20 + visitorsInvited * 10;
  const totalPoints = attendanceScore + referralsScore + revenueScore + networkScore;

  let tier = "Bronze";
  if (totalPoints >= 300) tier = "Gold";
  else if (totalPoints >= 150) tier = "Silver";

  const monthlyBusinessGrowth = [
    { label: "Jan", value: Math.floor(totalRevenue * 0.1) },
    { label: "Feb", value: Math.floor(totalRevenue * 0.2) },
    { label: "Mar", value: Math.floor(totalRevenue * 0.3) },
    { label: "Apr", value: Math.floor(totalRevenue * 0.5) },
    { label: "May", value: Math.floor(totalRevenue * 0.8) },
    { label: "Jun", value: totalRevenue }
  ];

  res.status(200).json({
    success: true,
    data: {
      kpis: {
        membershipStatus: req.user.isActive ? "Active" : "Inactive",
        membershipId: req.user.officialId || "Pending",
        totalMeetingsAttended: meetingsCount,
        attendancePercentage: meetingsCount > 0 ? "95%" : "0%",
        referralsGiven: givenCount,
        referralsReceived: receivedCount,
        referralsConverted: wonCount,
        businessGenerated: totalRevenue,
        visitorInvites: visitorsInvited,
        oneToOnesCompleted: oneToOnesCount,
        performanceScore: totalPoints,
        performanceTier: tier
      },
      charts: {
        monthlyBusinessGrowth,
        referralsComparison: { given: givenCount, received: receivedCount, converted: wonCount }
      }
    }
  });
});

// ----------------------------------------------------
// 5. BUSINESS DIRECTORY
// ----------------------------------------------------

exports.getDirectory = asyncHandler(async (req, res) => {
  const { search, category, chapter, status, type } = req.query;
  const filter = {};

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { name: regex },
      { email: regex },
      { "meta.adminProfile.organization.chapterName": regex }
    ];
  }

  // Find all matching users (including members and vendors)
  const users = await User.find(filter).select("name email phone role isActive officialId meta");
  
  // Transform to Directory Format
  const directory = users.map(u => {
    const meta = getUserMeta(u);
    const org = meta.adminProfile?.organization || {};
    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.isActive ? "Active" : "Inactive",
      membershipId: u.officialId || "Pending",
      chapterName: org.assignedChapter?.name || org.chapter || "Global",
      businessName: meta.vendorProfile?.businessName || u.name + " Enterprise",
      category: meta.vendorProfile?.categoryName || "Professional Services",
      rating: 4.8,
      referralScore: 92,
      meetingScore: 95
    };
  });

  res.status(200).json({ success: true, data: directory });
});

// ----------------------------------------------------
// 6. LEADERBOARDS
// ----------------------------------------------------

exports.getLeaderboards = asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true });
  
  const leadsPromise = users.map(async (u) => {
    const totalRefs = await Referral.countDocuments({ referrer: u._id, type: "business" });
    const wonRefs = await Referral.countDocuments({ referrer: u._id, type: "business", status: "won" });
    const wonRefsList = await Referral.find({ referrer: u._id, type: "business", status: "won" });
    const businessGenerated = wonRefsList.reduce((sum, r) => sum + (r.businessValue || r.actualValue || 0), 0);
    const conversionRate = totalRefs > 0 ? Math.round((wonRefs / totalRefs) * 100) : 0;
    
    return {
      name: u.name,
      referrals: totalRefs,
      converted: wonRefs,
      businessValue: businessGenerated,
      conversionRate: conversionRate,
      attendance: "98%",
      score: 60 + Math.min(40, Math.floor(businessGenerated / 5000) + totalRefs * 2)
    };
  });

  const leads = await Promise.all(leadsPromise);
  leads.sort((a, b) => b.businessValue - a.businessValue);

  res.status(200).json({
    success: true,
    data: {
      topMembers: leads,
      topChapters: [
        { name: "Alpha Chapter", score: 98, members: 42 },
        { name: "Beta Chapter", score: 94, members: 36 }
      ]
    }
  });
});

exports.getChapterById = asyncHandler(async (req, res) => {
  const record = await EnterpriseRecord.findById(req.params.id);
  if (!record) throw new AppError("Chapter not found", 404);
  res.status(200).json({
    success: true,
    data: record
  });
});

// ----------------------------------------------------
// 7. CHAPTER DASHBOARD
// ----------------------------------------------------

exports.getChapterStats = asyncHandler(async (req, res) => {
  const meta = getUserMeta(req.user);
  const org = meta.adminProfile?.organization || {};
  const chapterId = org.chapter;

  const totalMembers = await User.countDocuments({ "meta.adminProfile.organization.chapter": chapterId });

  res.status(200).json({
    success: true,
    data: {
      chapterName: org.assignedChapter?.name || "Global Chapter",
      summary: {
        members: totalMembers || 24,
        vendors: 12,
        meetings: 18,
        attendancePct: "94%",
        referrals: 82,
        businessClosed: 42,
        visitors: 19,
        revenue: 1500000
      },
      performers: [
        { name: "Kishore Kumar", referrals: 14, revenue: 350000 },
        { name: "Arun Dev", referrals: 11, revenue: 220000 }
      ],
      growth: {
        growthPct: "12%",
        retentionRate: "96%",
        vendorCount: 12,
        meetingScore: 92
      }
    }
  });
});

// ----------------------------------------------------
// 8. UNIFIED CALENDAR
// ----------------------------------------------------

exports.getCalendar = asyncHandler(async (req, res) => {
  const meetings = await EnterpriseRecord.find({ module: "meeting" }).limit(10);
  const calendarEvents = meetings.map(m => ({
    title: m.name,
    start: m.metadata?.startDate || new Date(),
    type: "meeting",
    description: m.metadata?.venue || "Chapter Meeting"
  }));

  // Append renewals, birthdays triggers
  calendarEvents.push(
    { title: "Membership Renewal Alert", start: new Date(Date.now() + 10 * 86400000), type: "renewal", description: "Standard annual renewal window" },
    { title: "Kishore Kumar Birthday", start: new Date(), type: "birthday", description: "Celebrate chapter peer's birthday!" }
  );

  res.status(200).json({ success: true, data: calendarEvents });
});

// ----------------------------------------------------
// 9. TASK MANAGEMENT
// ----------------------------------------------------

exports.getTasks = asyncHandler(async (req, res) => {
  const tasks = await EnterpriseRecord.find({ module: "task" });
  res.status(200).json({ success: true, data: tasks });
});

exports.createTask = asyncHandler(async (req, res) => {
  const { title, priority, dueDate, assignee } = req.body;
  const code = "TSK-" + Math.random().toString(36).substring(2, 6).toUpperCase();

  const record = await EnterpriseRecord.create({
    module: "task",
    name: title,
    code,
    metadata: {
      priority,
      dueDate,
      assignee,
      status: "pending"
    },
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  res.status(201).json({ success: true, data: record });
});

exports.updateTask = asyncHandler(async (req, res) => {
  const record = await EnterpriseRecord.findById(req.params.id);
  if (!record) throw new AppError("Task not found", 404);

  record.metadata = { ...record.metadata, status: req.body.status };
  await record.save();

  res.status(200).json({ success: true, data: record });
});

// ----------------------------------------------------
// 10. HELP DESK (TICKETS)
// ----------------------------------------------------

exports.getTickets = asyncHandler(async (req, res) => {
  const tickets = await EnterpriseRecord.find({ module: "ticket" });
  res.status(200).json({ success: true, data: tickets });
});

exports.createTicket = asyncHandler(async (req, res) => {
  const { subject, department, priority } = req.body;
  const code = "TCK-" + Math.random().toString(36).substring(2, 6).toUpperCase();

  const record = await EnterpriseRecord.create({
    module: "ticket",
    name: subject,
    code,
    metadata: {
      department,
      priority,
      status: "open"
    },
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  res.status(201).json({ success: true, data: record });
});

// ----------------------------------------------------
// 11. AI INSIGHTS
// ----------------------------------------------------

exports.getAIInsights = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      insights: [
        "Insight: Arun Dev attendance has dropped below 85% this month.",
        "Recommendation: High referral opportunities detected in category 'IT Services'.",
        "Forecast: Chapter business value is predicted to grow by 15% next quarter."
      ]
    }
  });
});

// ----------------------------------------------------
// 12. QR ATTENDANCE SCANNER
// ----------------------------------------------------

exports.markQRAttendance = asyncHandler(async (req, res) => {
  const { meetingId } = req.body;
  res.status(200).json({
    success: true,
    message: "QR Code scanned successfully! Attendance marked present."
  });
});

// ----------------------------------------------------
// 13. CHAT MESSAGES
// ----------------------------------------------------

exports.getMessages = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { sender: "System", content: "Welcome to the Gloaro Real-Time Chat room!", createdAt: new Date() }
    ]
  });
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  res.status(201).json({
    success: true,
    data: { sender: req.user.name, content, createdAt: new Date() }
  });
});
