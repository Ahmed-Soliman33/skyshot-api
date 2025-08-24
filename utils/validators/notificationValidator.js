const { body, param, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.createNotificationValidator = [
  body("user")
    .notEmpty()
    .withMessage("notification.user_required")
    .isMongoId()
    .withMessage("notification.invalid_user_id"),

  body("title")
    .notEmpty()
    .withMessage("notification.title_required")
    .isLength({ min: 3, max: 100 })
    .withMessage("notification.title_length"),

  body("message")
    .notEmpty()
    .withMessage("notification.message_required")
    .isLength({ min: 10, max: 500 })
    .withMessage("notification.message_length"),

  body("type")
    .notEmpty()
    .withMessage("notification.type_required")
    .isIn(["system", "upload", "payment", "account", "promotion"])
    .withMessage("notification.type_invalid"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("notification.priority_invalid"),

  body("actionUrl")
    .optional()
    .isURL()
    .withMessage("notification.action_url_invalid"),

  body("actionText")
    .optional()
    .isLength({ max: 50 })
    .withMessage("notification.action_text_too_long"),

  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("notification.expires_at_invalid"),

  validatorMiddleware,
];

exports.createSystemNotificationValidator = [
  body("title")
    .notEmpty()
    .withMessage("notification.title_required")
    .isLength({ min: 3, max: 100 })
    .withMessage("notification.title_length"),

  body("message")
    .notEmpty()
    .withMessage("notification.message_required")
    .isLength({ min: 10, max: 500 })
    .withMessage("notification.message_length"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("notification.priority_invalid"),

  body("actionUrl")
    .optional()
    .isURL()
    .withMessage("notification.action_url_invalid"),

  body("actionText")
    .optional()
    .isLength({ max: 50 })
    .withMessage("notification.action_text_too_long"),

  validatorMiddleware,
];

exports.getNotificationValidator = [
  param("id").isMongoId().withMessage("notification.invalid_id"),

  validatorMiddleware,
];

exports.getNotificationsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("pagination.invalid_page"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pagination.invalid_limit"),

  query("type")
    .optional()
    .isIn(["system", "upload", "payment", "account", "promotion"])
    .withMessage("notification.type_invalid"),

  query("isRead")
    .optional()
    .isBoolean()
    .withMessage("notification.is_read_invalid"),

  query("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("notification.priority_invalid"),

  validatorMiddleware,
];

exports.bulkNotificationValidator = [
  body("operation")
    .notEmpty()
    .withMessage("bulk.operation_required")
    .isIn(["markRead", "markUnread", "delete"])
    .withMessage("bulk.operation_invalid"),

  body("ids")
    .notEmpty()
    .withMessage("bulk.ids_required")
    .isArray({ min: 1 })
    .withMessage("bulk.ids_must_be_array"),

  body("ids.*").isMongoId().withMessage("notification.invalid_id"),

  validatorMiddleware,
];
