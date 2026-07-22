const express = require("express");
const router = express.Router();
const secretaryController = require("../controllers/secretary.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("secretary"));

router.get("/dashboard", secretaryController.getDashboard);
router.get("/members", secretaryController.getMembers);
router.get("/minutes", secretaryController.getMinutes);
router.get("/attendance", secretaryController.getAttendance);
router.get("/categories", secretaryController.getCategories);
router.post("/categories", secretaryController.createCategory);
router.put("/categories/:id", secretaryController.updateCategory);
router.delete("/categories/:id", secretaryController.deleteCategory);
router.get("/directory", secretaryController.getMembersDirectory);
router.post("/members", secretaryController.createMember);
router.get("/members/:id", secretaryController.getMember);
router.put("/members/:id", secretaryController.updateMember);
router.delete("/members/:id", secretaryController.deleteMember);
router.get("/tasks", secretaryController.getTasks);
router.post("/tasks", secretaryController.createTask);
router.put("/tasks/:id", secretaryController.updateTask);
router.delete("/tasks/:id", secretaryController.deleteTask);
router.get("/attendance-records", secretaryController.getAttendanceRecords);
router.post("/attendance-records", secretaryController.createAttendance);
router.get("/events", secretaryController.getEvents);
router.post("/events", secretaryController.createEvent);
router.post("/events/:id/members", secretaryController.assignEventMember);
router.patch("/events/:id/attendees/:attendeeId/attendance", secretaryController.markEventAttendance);

module.exports = router;
