const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { protect, authorize } = require("../middleware/auth");
const { uploadSingle } = require("../config/cloudinary");

// All routes require authentication
router.use(protect);

// Profile routes (any authenticated user)
router.get("/profile", userController.updateProfile);
router.patch("/profile", uploadSingle("avatar", "avatars"), userController.updateProfile);

// Activity logs for self
router.get("/activity", async (req, res, next) => {
  req.params.id = req.user._id.toString();
  userController.getUserActivityLogs(req, res, next);
});

// Admin-only routes
router.use(authorize("admin", "superadmin"));

router.get("/", userController.getUsers);
router.get("/:id", userController.getUserById);
router.patch("/:id", uploadSingle("avatar", "avatars"), userController.updateUser);
router.delete("/:id", userController.deleteUser);

// User status management
router.patch("/:id/suspend", userController.suspendUser);
router.patch("/:id/unsuspend", userController.unsuspendUser);
router.patch("/:id/block", userController.blockUser);
router.patch("/:id/unblock", userController.unblockUser);
router.get("/:id/activity", userController.getUserActivityLogs);

module.exports = router;
