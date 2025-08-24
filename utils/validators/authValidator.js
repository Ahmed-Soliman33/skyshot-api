const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const User = require("../../models/User");

exports.signupValidator = [
  check("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 3 })
    .withMessage("Too short User name"),

  check("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 3 })
    .withMessage("Too short User name"),

  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address")
    .custom((val) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error("Email already exists"));
        }
      })
    ),
  check("role")
    .optional()
    .isIn(["user", "partner", "admin", "master"])
    .withMessage("Invalid user role"),

  check("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .custom((password, { req }) => {
      if (password !== req.body.passwordConfirm) {
        throw new Error("Password Confirmation incorrect");
      }
      return true;
    }),

  check("passwordConfirm")
    .notEmpty()
    .withMessage("Password confirmation is required"),

  check("phone")
    .optional()
    .isMobilePhone(undefined, { strictMode: true })
    .withMessage("Invalid phone number"),

  check("country")
    .optional()
    .isString()
    .withMessage("Country must be a valid string")
    .isLength({ min: 2 })
    .withMessage("Country name is too short"),

  check("birthDate")
    .optional()
    .isISO8601()
    .withMessage("Birth date must be a valid ISO8601 date (e.g. YYYY-MM-DD)")
    .toDate(),

  validatorMiddleware,
];

exports.loginValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),

  check("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  validatorMiddleware,
];

exports.getMeValidator = [
  check("firstName")
    .optional()
    .isLength({ min: 3 })
    .withMessage("Too short User name"),

  check("lastName")
    .optional()
    .isLength({ min: 3 })
    .withMessage("Too short User name"),

  check("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address")
    .custom((val) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error("Email already exists"));
        }
      })
    ),

  check("phone")
    .optional()
    .isMobilePhone(undefined, { strictMode: true })
    .withMessage("Invalid phone number"),

  check("country")
    .optional()
    .isString()
    .withMessage("Country must be a valid string")
    .isLength({ min: 2 })
    .withMessage("Country name is too short"),

  check("birthDate")
    .optional()
    .isISO8601()
    .withMessage("Birth date must be a valid ISO8601 date (e.g. YYYY-MM-DD)")
    .toDate(),

  validatorMiddleware,
];

exports.forgotPasswordValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),

  validatorMiddleware,
];

exports.verifyPassResetCodeValidator = [
  check("resetCode")
    .notEmpty()
    .withMessage("Reset code is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("Reset code must be 6 characters long"),

  validatorMiddleware,
];

exports.resetPasswordValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address"),

  check("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  validatorMiddleware,
];

exports.verifyEmailValidator = [
  check("token")
    .notEmpty()
    .withMessage("Verification token is required")
    .isLength({ min: 32, max: 64 })
    .withMessage("Invalid token format"),

  check("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  validatorMiddleware,
];
