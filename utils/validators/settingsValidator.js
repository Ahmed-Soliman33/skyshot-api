const { body, param, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.getSettingValidator = [
  param("key")
    .notEmpty()
    .withMessage("Setting key is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Setting key must be between 1 and 100 characters"),
  
  validatorMiddleware,
];

exports.createSettingValidator = [
  body("key")
    .notEmpty()
    .withMessage("Setting key is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Setting key must be between 1 and 100 characters")
    .matches(/^[a-z0-9_]+$/)
    .withMessage("Setting key can only contain lowercase letters, numbers, and underscores"),
  
  body("value")
    .notEmpty()
    .withMessage("Setting value is required"),
  
  body("type")
    .isIn(["string", "number", "boolean", "object", "array"])
    .withMessage("Valid setting type is required"),
  
  body("category")
    .isIn(["general", "ui", "payment", "upload", "notification", "security"])
    .withMessage("Valid category is required"),
  
  body("description")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Description cannot exceed 200 characters"),
  
  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic must be a boolean"),
  
  body("isEditable")
    .optional()
    .isBoolean()
    .withMessage("isEditable must be a boolean"),
  
  validatorMiddleware,
];

exports.updateSettingValidator = [
  param("key")
    .notEmpty()
    .withMessage("Setting key is required"),
  
  body("value")
    .notEmpty()
    .withMessage("Setting value is required"),
  
  validatorMiddleware,
];

exports.updateMultipleSettingsValidator = [
  body("settings")
    .isArray({ min: 1 })
    .withMessage("Settings array is required with at least one setting"),
  
  body("settings.*.key")
    .notEmpty()
    .withMessage("Setting key is required for each setting"),
  
  body("settings.*.value")
    .notEmpty()
    .withMessage("Setting value is required for each setting"),
  
  validatorMiddleware,
];

exports.importSettingsValidator = [
  body("settings")
    .isArray({ min: 1 })
    .withMessage("Settings array is required with at least one setting"),
  
  body("overwrite")
    .optional()
    .isBoolean()
    .withMessage("Overwrite must be a boolean"),
  
  validatorMiddleware,
];

exports.resetSettingsValidator = [
  body("confirm")
    .equals("true")
    .withMessage("Confirmation is required for reset operation"),
  
  body("category")
    .optional()
    .isIn(["general", "ui", "payment", "upload", "notification", "security"])
    .withMessage("Valid category is required"),
  
  validatorMiddleware,
];
