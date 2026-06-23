const express = require("express");
const router = express.Router();
const supportController = require("../controllers/support.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadMultiple } = require("../config/cloudinary");

router.use(protect);

router.post("/", uploadMultiple("attachments", "support", 5), supportController.createTicket);
router.get("/my", supportController.getMyTickets);
router.get("/:id", supportController.getTicketById);
router.post("/:id/reply", uploadMultiple("attachments", "support", 3), supportController.replyToTicket);
router.patch("/:id/close", supportController.closeTicket);

// Admin
router.get("/", authorize("admin", "superadmin"), supportController.getAllTickets);
router.patch("/:id/assign", authorize("admin", "superadmin"), supportController.assignTicket);

module.exports = router;
