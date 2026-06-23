const express = require("express");
const router = express.Router();
const eventController = require("../controllers/event.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");

// Public routes
router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);

router.use(protect);

// Authenticated users
router.post("/", uploadSingle("coverImage", "events"), eventController.createEvent);
router.patch("/:id", uploadSingle("coverImage", "events"), eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);
router.post("/:id/register", eventController.registerForEvent);
router.delete("/:id/register", eventController.cancelRegistration);

module.exports = router;
