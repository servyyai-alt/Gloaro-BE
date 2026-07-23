const { ROLES } = require("../constants/roleConfig");
const express = require("express");
const router = express.Router();
const locationController = require("../controllers/location.controller");
const { protect, authorize } = require("../middleware/auth");

// Public/Common endpoints (Need protect to extract req.user context)
router.get("/regions", protect, locationController.getRegions);
router.get("/states", protect, locationController.getStates);
router.get("/districts", protect, locationController.getDistricts);
router.get("/chapters", protect, locationController.getChapters);

// Restricted to Admins & Super Admins and local Directors
router.get("/locations", protect, authorize(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR, ROLES.DISTRICT_DIRECTOR), locationController.getLocations);
router.post("/location", protect, authorize(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR, ROLES.DISTRICT_DIRECTOR), locationController.createLocation);
router.put("/location/:id", protect, authorize(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR, ROLES.DISTRICT_DIRECTOR), locationController.updateLocation);
router.delete("/location/:id", protect, authorize(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.REGION_DIRECTOR, ROLES.STATE_DIRECTOR, ROLES.DISTRICT_DIRECTOR), locationController.deleteLocation);

module.exports = router;
