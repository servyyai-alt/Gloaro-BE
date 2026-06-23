const express = require("express");
const router = express.Router();
const directoryController = require("../controllers/directory.controller");

// All public
router.get("/search", directoryController.searchDirectory);
router.get("/featured", directoryController.getFeaturedListings);
router.get("/nearby", directoryController.getNearbyVendors);
router.get("/filters", directoryController.getDirectoryFilters);
router.get("/global-search", directoryController.globalSearch);

module.exports = router;
