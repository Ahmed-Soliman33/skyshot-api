const { body, param, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.createUploadValidator = [
  body("title")
    .notEmpty()
    .withMessage("upload.title_required")
    .isLength({ min: 3, max: 100 })
    .withMessage("upload.title_length"),

  body("description")
    .notEmpty()
    .withMessage("upload.description_required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("upload.description_length"),

  body("category")
    .notEmpty()
    .withMessage("upload.category_required")
    .isIn(["photography", "video", "graphics", "illustration", "other"])
    .withMessage("upload.category_invalid"),

  body("fileType")
    .notEmpty()
    .withMessage("upload.file_type_required")
    .isIn(["image", "video"])
    .withMessage("upload.file_type_invalid"),

  body("price")
    .notEmpty()
    .withMessage("upload.price_required")
    .isFloat({ min: 0 })
    .withMessage("upload.price_invalid"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("upload.tags_must_be_array")
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error("upload.too_many_tags");
      }
      return true;
    }),

  body("tags.*")
    .optional()
    .isLength({ min: 2, max: 30 })
    .withMessage("upload.tag_length"),

  validatorMiddleware,
];

exports.updateUploadValidator = [
  param("id").isMongoId().withMessage("upload.invalid_id"),

  body("title")
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage("upload.title_length"),

  body("description")
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage("upload.description_length"),

  body("category")
    .optional()
    .isIn(["photography", "video", "graphics", "illustration", "other"])
    .withMessage("upload.category_invalid"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("upload.price_invalid"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("upload.tags_must_be_array")
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error("upload.too_many_tags");
      }
      return true;
    }),

  body("tags.*")
    .optional()
    .isLength({ min: 2, max: 30 })
    .withMessage("upload.tag_length"),

  validatorMiddleware,
];

exports.getUploadValidator = [
  param("id").isMongoId().withMessage("upload.invalid_id"),

  validatorMiddleware,
];

exports.deleteUploadValidator = [
  param("id").isMongoId().withMessage("upload.invalid_id"),

  validatorMiddleware,
];

exports.approveUploadValidator = [
  param("id").isMongoId().withMessage("upload.invalid_id"),

  validatorMiddleware,
];

exports.rejectUploadValidator = [
  param("id").isMongoId().withMessage("upload.invalid_id"),

  body("reason")
    .notEmpty()
    .withMessage("upload.rejection_reason_required")
    .isLength({ min: 10, max: 500 })
    .withMessage("upload.rejection_reason_length"),

  validatorMiddleware,
];

exports.getUploadsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("pagination.invalid_page"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pagination.invalid_limit"),

  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected", "suspended"])
    .withMessage("upload.status_invalid"),

  query("category")
    .optional()
    .isIn(["photography", "video", "graphics", "illustration", "other"])
    .withMessage("upload.category_invalid"),

  query("fileType")
    .optional()
    .isIn(["image", "video"])
    .withMessage("upload.file_type_invalid"),

  query("featured")
    .optional()
    .isBoolean()
    .withMessage("upload.featured_invalid"),

  query("sort")
    .optional()
    .isIn([
      "createdAt",
      "-createdAt",
      "title",
      "-title",
      "price",
      "-price",
      "views",
      "-views",
      "downloads",
      "-downloads",
      "likes",
      "-likes",
    ])
    .withMessage("sorting.invalid_field"),

  validatorMiddleware,
];

exports.searchUploadsValidator = [
  query("q")
    .notEmpty()
    .withMessage("search.query_required")
    .isLength({ min: 2 })
    .withMessage("search.query_too_short"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("pagination.invalid_page"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pagination.invalid_limit"),

  query("category")
    .optional()
    .isIn(["photography", "video", "graphics", "illustration", "other"])
    .withMessage("upload.category_invalid"),

  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("upload.min_price_invalid"),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("upload.max_price_invalid"),

  validatorMiddleware,
];

exports.bulkUploadValidator = [
  body("operation")
    .notEmpty()
    .withMessage("bulk.operation_required")
    .isIn(["approve", "reject", "delete", "feature", "unfeature"])
    .withMessage("bulk.operation_invalid"),

  body("ids")
    .notEmpty()
    .withMessage("bulk.ids_required")
    .isArray({ min: 1 })
    .withMessage("bulk.ids_must_be_array"),

  body("ids.*").isMongoId().withMessage("upload.invalid_id"),

  body("reason")
    .if(body("operation").equals("reject"))
    .notEmpty()
    .withMessage("upload.rejection_reason_required")
    .isLength({ min: 10, max: 500 })
    .withMessage("upload.rejection_reason_length"),

  validatorMiddleware,
];
