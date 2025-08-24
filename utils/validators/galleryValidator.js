const { body, param, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.getUploadDetailsValidator = [
  param("id").isMongoId().withMessage("Valid upload ID is required"),

  validatorMiddleware,
];

exports.getCategoryValidator = [
  param("category")
    .isIn(["photography", "video", "graphics", "illustration", "other"])
    .withMessage("Valid category is required"),

  validatorMiddleware,
];

exports.getUserUploadsValidator = [
  param("userId").isMongoId().withMessage("Valid user ID is required"),

  validatorMiddleware,
];

exports.toggleLikeValidator = [
  param("id").isMongoId().withMessage("Valid upload ID is required"),

  body("action")
    .isIn(["like", "unlike"])
    .withMessage("Action must be either 'like' or 'unlike'"),

  validatorMiddleware,
];
