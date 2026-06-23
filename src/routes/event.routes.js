const express = require("express");
const router = express.Router();
const eventController = require("../controllers/event.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");

/**
 * @swagger
 * /events:
 *   get:
 *     summary: Get all events (Public)
 *     tags: [Events]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [online, offline, hybrid] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, cancelled, completed] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title or description
 *       - in: query
 *         name: isFeatured
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Events fetched successfully
 */
router.get("/", eventController.getEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event by ID (Public)
 *     tags: [Events]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event data
 *       404:
 *         description: Event not found
 */
router.get("/:id", eventController.getEventById);

router.use(protect);

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/EventInput'
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Event created successfully
 */
router.post("/", uploadSingle("coverImage", "events"), eventController.createEvent);

/**
 * @swagger
 * /events/{id}:
 *   patch:
 *     summary: Update an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/EventInput'
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Event updated successfully
 */
router.patch("/:id", uploadSingle("coverImage", "events"), eventController.updateEvent);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event deleted successfully
 */
router.delete("/:id", eventController.deleteEvent);

/**
 * @swagger
 * /events/{id}/register:
 *   post:
 *     summary: Register for an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Registration successful
 *       400:
 *         description: Registration failed (event full, already registered, etc.)
 */
router.post("/:id/register", eventController.registerForEvent);

/**
 * @swagger
 * /events/{id}/register:
 *   delete:
 *     summary: Cancel event registration
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Registration cancelled successfully
 */
router.delete("/:id/register", eventController.cancelRegistration);

module.exports = router;
