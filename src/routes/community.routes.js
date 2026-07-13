const express = require("express");
const router = express.Router();
const communityController = require("../controllers/community.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

// 1. Business Wall Routes
router.route("/posts")
  .get(communityController.getPosts)
  .post(communityController.createPost);

router.get("/posts/analytics", communityController.getPostAnalytics);
router.post("/posts/:id/like", communityController.likePost);
router.post("/posts/:id/comment", communityController.commentPost);

// 2. Referrals Routes
router.route("/referrals")
  .get(communityController.getReferrals)
  .post(communityController.createReferral);

router.patch("/referrals/:id", communityController.updateReferralStatus);

// 3. One-to-Ones Routes
router.route("/one-to-ones")
  .get(communityController.getOneToOnes)
  .post(communityController.createOneToOne);

router.patch("/one-to-ones/:id", communityController.updateOneToOne);

// 4. Visitors Routes
router.route("/visitors")
  .get(communityController.getVisitors)
  .post(communityController.inviteVisitor);

// 5. Member Dashboard BI Stats
router.get("/member-stats", communityController.getMemberStats);

// 6. Business Directory
router.get("/directory", communityController.getDirectory);

// 7. Leaderboards
router.get("/leaderboards", communityController.getLeaderboards);

// 8. Chapter Performance Dashboard
router.get("/chapter-stats", communityController.getChapterStats);
router.get("/chapters/:id", communityController.getChapterById);

// 9. Unified Calendar
router.get("/calendar", communityController.getCalendar);

// 10. Task Management
router.route("/tasks")
  .get(communityController.getTasks)
  .post(communityController.createTask);

router.patch("/tasks/:id", communityController.updateTask);

// 11. Help Desk (Tickets)
router.route("/tickets")
  .get(communityController.getTickets)
  .post(communityController.createTicket);

// 12. AI Insights
router.get("/ai-insights", communityController.getAIInsights);

// 13. QR Attendance scan mark
router.post("/meetings/qr-attendance", communityController.markQRAttendance);

// 14. Chat System Messages
router.route("/chat/messages")
  .get(communityController.getMessages)
  .post(communityController.sendMessage);

module.exports = router;
