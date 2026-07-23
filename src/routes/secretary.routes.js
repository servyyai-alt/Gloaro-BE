const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const secretaryController = require("../controllers/secretary.controller");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize(ROLES.SECRETARY));

router.get("/dashboard", secretaryController.getDashboard);
router.get("/members", secretaryController.getMembers);
router.get("/minutes", secretaryController.getMinutes);
router.get("/attendance", secretaryController.getAttendance);

module.exports = router;
