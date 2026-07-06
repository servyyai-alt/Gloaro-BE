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
router.get("/locations", protect, authorize("superadmin", "admin", "region_director", "state_director", "district_director"), locationController.getLocations);
router.post("/location", protect, authorize("superadmin", "admin", "region_director", "state_director", "district_director"), locationController.createLocation);
router.put("/location/:id", protect, authorize("superadmin", "admin", "region_director", "state_director", "district_director"), locationController.updateLocation);
router.delete("/location/:id", protect, authorize("superadmin", "admin", "region_director", "state_director", "district_director"), locationController.deleteLocation);

module.exports = router;
