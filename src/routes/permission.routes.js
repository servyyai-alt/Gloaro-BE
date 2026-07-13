const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permission.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", permissionController.getAllPermissions);
router.get("/my", permissionController.getMyPermissions);

router.route("/user/:id")
  .get(permissionController.getUserPermissions)
  .post(permissionController.assignUserPermissions);

module.exports = router;
