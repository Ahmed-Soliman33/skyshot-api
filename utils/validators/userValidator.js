const { body, param, query, check } = require("express-validator");
const User = require("../../models/User");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.createUserValidator = [
  body("firstName")
    .notEmpty()
    .withMessage("user.first_name_required")
    .isLength({ min: 2, max: 50 })
    .withMessage("user.first_name_length"),

  body("lastName")
    .notEmpty()
    .withMessage("user.last_name_required")
    .isLength({ min: 2, max: 50 })
    .withMessage("user.last_name_length"),

  body("email")
    .notEmpty()
    .withMessage("user.email_required")
    .isEmail()
    .withMessage("user.email_invalid")
    .normalizeEmail()
    .custom(async (value) => {
      const user = await User.findByEmail(value);
      if (user) {
        throw new Error("user.email_already_exists");
      }
      return true;
    }),

  body("password")
    .notEmpty()
    .withMessage("user.password_required")
    .isLength({ min: 6 })
    .withMessage("user.password_too_short")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("user.password_weak"),

  body("role")
    .optional()
    .isIn(["user", "admin", "master"])
    .withMessage("user.role_invalid"),

  body("phone").optional().isMobilePhone().withMessage("user.phone_invalid"),

  validatorMiddleware,
];

exports.updateUserValidator = [
  param("id").isMongoId().withMessage("user.invalid_id"),

  body("firstName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("user.first_name_length"),

  body("lastName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("user.last_name_length"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("user.email_invalid")
    .normalizeEmail()
    .custom(async (value, { req }) => {
      const user = await User.findByEmail(value);
      if (user && user._id.toString() !== req.params.id) {
        throw new Error("user.email_already_exists");
      }
      return true;
    }),

  body("role")
    .optional()
    .isIn(["user", "admin", "master"])
    .withMessage("user.role_invalid"),

  body("status")
    .optional()
    .isIn(["active", "deactivated", "suspended"])
    .withMessage("user.status_invalid"),

  body("phone").optional().isMobilePhone().withMessage("user.phone_invalid"),

  body("bio")
    .optional()
    .isLength({ max: 500 })
    .withMessage("user.bio_too_long"),

  validatorMiddleware,
];

exports.getUserValidator = [
  param("id").isMongoId().withMessage("invalid user id"),

  validatorMiddleware,
];

exports.getUserByEmailValidator = [
  body("email")
    .notEmpty()
    .withMessage("user email is required")
    .isEmail()
    .withMessage("user email is invalid"),

  validatorMiddleware,
];

exports.deleteUserValidator = [
  param("id").isMongoId().withMessage("invalid user id"),

  validatorMiddleware,
];

exports.promoteUserValidator = [
  param("id").isMongoId().withMessage("invalid user id"),

  body("role")
    .notEmpty()
    .withMessage("user role is required")
    .isIn(["user", "admin", "master"])
    .withMessage("invalid user role"),

  validatorMiddleware,
];

exports.changePasswordValidator = [
  param("id").isMongoId().withMessage("invalid user id"),

  body("currentPassword")
    .notEmpty()
    .withMessage("current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("new password is required")
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("password does not meet security requirements"),

  body("confirmPassword")
    .notEmpty()
    .withMessage("confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("passwords do not match");
      }
      return true;
    }),

  validatorMiddleware,
];

exports.getUsersValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("invalid page number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("invalid limit number"),

  query("role")
    .optional()
    .isIn(["user", "admin", "master"])
    .withMessage("invalid user role"),

  query("status")
    .optional()
    .isIn(["active", "deactivated", "suspended"])
    .withMessage("invalid user status"),

  query("sort")
    .optional()
    .isIn([
      "createdAt",
      "-createdAt",
      "firstName",
      "-firstName",
      "email",
      "-email",
    ])
    .withMessage("invalid sorting field"),

  validatorMiddleware,
];

exports.searchUsersValidator = [
  query("q")
    .notEmpty()
    .withMessage("search query is required")
    .isLength({ min: 2 })
    .withMessage("search query must be at least 2 characters"),

  query("page").optional().isInt({ min: 1 }).withMessage("invalid page number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("invalid limit number"),

  validatorMiddleware,
];

exports.activateAccountOrDeactivateValidator = [
  check("id").isMongoId().withMessage("Invalid User id format"),
  validatorMiddleware,
];
