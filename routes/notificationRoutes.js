const express = require("express");
const {
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
  createSystemNotification,
  deleteNotification,
  deleteReadNotifications,
  getNotificationStats,
  bulkNotificationOperations,
  cleanupOldNotifications,
} = require("../controllers/notificationController");

const { protect, allowedTo } = require("../controllers/authController");

const router = express.Router();

// All routes require authentication
router.use(protect);

// User routes
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.delete("/read", deleteReadNotifications);

router.route("/:id").get(getNotification).delete(deleteNotification);

router.patch("/:id/read", markAsRead);

// Admin routes
router.use(allowedTo("admin", "master"));

router.post("/", createNotification);
router.get("/stats/overview", getNotificationStats);
router.post("/bulk", bulkNotificationOperations);
router.delete("/cleanup/old", cleanupOldNotifications);

// Master only routes
router.use(allowedTo("master"));

router.post("/system", createSystemNotification);

module.exports = router;
