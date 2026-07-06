const express = require("express");
const router = express.Router();
const directoryController = require("../controllers/directory.controller");

/**
 * @swagger
 * /directory/search:
 *   get:
 *     summary: Search directory listings (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *         description: Comma-separated tags
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Search results
 */
router.get("/search", directoryController.searchDirectory);

/**
 * @swagger
 * /directory/featured:
 *   get:
 *     summary: Get featured listings (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Featured listings
 */
router.get("/featured", directoryController.getFeaturedListings);

/**
 * @swagger
 * /directory/nearby:
 *   get:
 *     summary: Get nearby listings (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: distance
 *         schema: { type: number, default: 10 }
 *         description: Distance in km
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Nearby listings
 */
router.get("/nearby", directoryController.getNearbyVendors);

/**
 * @swagger
 * /directory/filters:
 *   get:
 *     summary: Get directory filter options (Public)
 *     tags: [Directory]
 *     security: []
 *     responses:
 *       200:
 *         description: Filter options (categories, cities, states)
 */
router.get("/filters", directoryController.getDirectoryFilters);

/**
 * @swagger
 * /directory/global-search:
 *   get:
 *     summary: Global search across vendors, products, services, events (Public)
 *     tags: [Directory]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [vendors, products, services, events, all] }
 *         default: all
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Global search results
 */
const { protect } = require("../middleware/auth");

router.get("/global-search", directoryController.globalSearch);
router.get("/organization-hierarchy", directoryController.getOrganizationHierarchy);

// Dynamic cascading locations
router.get("/regions", protect, directoryController.getRegions);
router.get("/states", protect, directoryController.getStates);
router.get("/districts", protect, directoryController.getDistricts);
router.get("/areas", protect, directoryController.getAreas);
router.get("/chapters", protect, directoryController.getChapters);

module.exports = router;
