const express = require("express");
const router = express.Router();
const nearbyController = require("../controllers/nearby.controller");

router.get("/businesses", nearbyController.getNearbyBusinesses);
router.get("/services", nearbyController.getNearbyServices);
router.get("/products", nearbyController.getNearbyProducts);

module.exports = router;
