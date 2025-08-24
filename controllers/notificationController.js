const asyncHandler = require("express-async-handler");
const factory = require("./factoryController");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Notification = require("../models/Notification");

// @desc Get notifications for current user
// @route GET /api/notifications
// @access Private
exports.getNotifications = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, type, isRead, priority } = req.query;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    type,
    isRead: isRead !== undefined ? isRead === "true" : null,
    priority,
  };

  const notifications = await Notification.getForUser(req.user.id, options);
  const totalNotifications = await Notification.countDocuments({
    user: req.user.id,
  });
  const unreadCount = await Notification.getUnreadCount(req.user.id);
  const totalPages = Math.ceil(totalNotifications / limit);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        results: notifications.length,
        totalResults: totalNotifications,
        totalPages,
        currentPage: parseInt(page),
        unreadCount,
        data: notifications,
      },
      "success.notifications_retrieved"
    )
  );
});

// @desc Get single notification
// @route GET /api/notifications/:id
// @access Private
exports.getNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new ApiError("notification.not_found", 404));
  }

  // Check if user can access this notification
  if (!notification.canUserSee(req.user.id)) {
    return next(new ApiError("notification.access_denied", 403));
  }

  res
    .status(200)
    .json(new ApiResponse(200, notification, "success.notification_retrieved"));
});

// @desc Mark notification as read
// @route PATCH /api/notifications/:id/read
// @access Private
exports.markAsRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new ApiError("notification.not_found", 404));
  }

  // Check if user can access this notification
  if (!notification.canUserSee(req.user.id)) {
    return next(new ApiError("notification.access_denied", 403));
  }

  if (!notification.isRead) {
    await notification.markAsRead();
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, notification, "success.notification_marked_read")
    );
});

// @desc Mark all notifications as read
// @route PATCH /api/notifications/read-all
// @access Private
exports.markAllAsRead = asyncHandler(async (req, res, next) => {
  const result = await Notification.markAllAsRead(req.user.id);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        modifiedCount: result.modifiedCount,
      },
      "success.all_notifications_marked_read"
    )
  );
});

// @desc Get unread notifications count
// @route GET /api/notifications/unread-count
// @access Private
exports.getUnreadCount = asyncHandler(async (req, res, next) => {
  const unreadCount = await Notification.getUnreadCount(req.user.id);

  res
    .status(200)
    .json(
      new ApiResponse(200, { unreadCount }, "success.unread_count_retrieved")
    );
});

// @desc Create notification (Admin only)
// @route POST /api/notifications
// @access Private/Admin
exports.createNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.createNotification(req.body);

  res
    .status(201)
    .json(new ApiResponse(201, notification, "success.notification_created"));
});

// @desc Create system notification for all users (Master only)
// @route POST /api/notifications/system
// @access Private/Master
exports.createSystemNotification = asyncHandler(async (req, res, next) => {
  const {
    title,
    message,
    priority = "medium",
    actionUrl,
    actionText,
  } = req.body;

  if (!title || !message) {
    return next(new ApiError("notification.title_message_required", 400));
  }

  const notifications = await Notification.createSystemNotificationForAll({
    title,
    message,
    priority,
    actionUrl,
    actionText,
  });

  res.status(201).json(
    new ApiResponse(
      201,
      {
        count: notifications.length,
        notifications: notifications.slice(0, 5), // Return first 5 as sample
      },
      "success.system_notification_created"
    )
  );
});

// @desc Delete notification
// @route DELETE /api/notifications/:id
// @access Private
exports.deleteNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new ApiError("notification.not_found", 404));
  }

  // Check if user can access this notification
  if (!notification.canUserSee(req.user.id)) {
    return next(new ApiError("notification.access_denied", 403));
  }

  await Notification.findByIdAndDelete(req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, null, "success.notification_deleted"));
});

// @desc Delete all read notifications for user
// @route DELETE /api/notifications/read
// @access Private
exports.deleteReadNotifications = asyncHandler(async (req, res, next) => {
  const result = await Notification.deleteMany({
    user: req.user.id,
    isRead: true,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        deletedCount: result.deletedCount,
      },
      "success.read_notifications_deleted"
    )
  );
});

// @desc Get notification statistics (Admin only)
// @route GET /api/notifications/stats
// @access Private/Admin
exports.getNotificationStats = asyncHandler(async (req, res, next) => {
  const stats = await Notification.aggregate([
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
      },
    },
  ]);

  const totalNotifications = await Notification.countDocuments();
  const totalUnread = await Notification.countDocuments({ isRead: false });

  // Get recent notifications
  const recentNotifications = await Notification.find()
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 })
    .limit(10);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalNotifications,
        totalUnread,
        byType: stats,
        recent: recentNotifications,
      },
      "success.notification_stats_retrieved"
    )
  );
});

// @desc Bulk notification operations (Admin only)
// @route POST /api/notifications/bulk
// @access Private/Admin
exports.bulkNotificationOperations = asyncHandler(async (req, res, next) => {
  const { operation, ids, data } = req.body;

  if (!operation || !ids || !Array.isArray(ids)) {
    return next(new ApiError("bulk.invalid_request", 400));
  }

  let result;

  switch (operation) {
    case "markRead":
      result = await Notification.updateMany(
        { _id: { $in: ids } },
        { isRead: true, readAt: new Date() }
      );
      break;
    case "markUnread":
      result = await Notification.updateMany(
        { _id: { $in: ids } },
        { isRead: false, readAt: null }
      );
      break;
    case "delete":
      result = await Notification.deleteMany({ _id: { $in: ids } });
      break;
    default:
      return next(new ApiError("bulk.operation_not_supported", 400));
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        operation,
        affectedNotifications: result.modifiedCount || result.deletedCount,
      },
      "success.bulk_operation_completed"
    )
  );
});

// @desc Clean up old notifications (Admin only)
// @route DELETE /api/notifications/cleanup
// @access Private/Admin
exports.cleanupOldNotifications = asyncHandler(async (req, res, next) => {
  const { daysOld = 30 } = req.query;

  const result = await Notification.deleteOldNotifications(parseInt(daysOld));

  res.status(200).json(
    new ApiResponse(
      200,
      {
        deletedCount: result.deletedCount,
        daysOld: parseInt(daysOld),
      },
      "success.old_notifications_cleaned"
    )
  );
});
