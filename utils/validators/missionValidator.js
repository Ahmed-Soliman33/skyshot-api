const { body, param, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.createMissionValidator = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters"),
  
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 20, max: 2000 })
    .withMessage("Description must be between 20 and 2000 characters"),
  
  body("type")
    .isIn(["photography", "videography", "drone", "event", "product", "portrait", "landscape"])
    .withMessage("Valid mission type is required"),
  
  body("location.address")
    .notEmpty()
    .withMessage("Location address is required"),
  
  body("location.city")
    .notEmpty()
    .withMessage("Location city is required"),
  
  body("location.coordinates.latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Valid latitude is required"),
  
  body("location.coordinates.longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Valid longitude is required"),
  
  body("scheduledDate")
    .isISO8601()
    .withMessage("Valid scheduled date is required")
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      if (scheduledDate <= now) {
        throw new Error("Scheduled date must be in the future");
      }
      return true;
    }),
  
  body("duration")
    .isFloat({ min: 0.5, max: 24 })
    .withMessage("Duration must be between 0.5 and 24 hours"),
  
  body("budget.min")
    .isFloat({ min: 0 })
    .withMessage("Minimum budget must be a positive number"),
  
  body("budget.max")
    .isFloat({ min: 0 })
    .withMessage("Maximum budget must be a positive number")
    .custom((value, { req }) => {
      if (value < req.body.budget.min) {
        throw new Error("Maximum budget must be greater than minimum budget");
      }
      return true;
    }),
  
  body("requirements")
    .optional()
    .isArray()
    .withMessage("Requirements must be an array"),
  
  body("equipment")
    .optional()
    .isArray()
    .withMessage("Equipment must be an array"),
  
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Valid priority is required"),
  
  validatorMiddleware,
];

exports.applyForMissionValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid mission ID is required"),
  
  body("proposedBudget")
    .isFloat({ min: 0 })
    .withMessage("Proposed budget must be a positive number"),
  
  body("message")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Message cannot exceed 500 characters"),
  
  body("portfolio")
    .optional()
    .isArray()
    .withMessage("Portfolio must be an array of URLs"),
  
  validatorMiddleware,
];

exports.acceptApplicationValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid mission ID is required"),
  
  param("partnerId")
    .isMongoId()
    .withMessage("Valid partner ID is required"),
  
  validatorMiddleware,
];

exports.completeMissionValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid mission ID is required"),
  
  body("deliverables")
    .optional()
    .isArray()
    .withMessage("Deliverables must be an array of upload IDs"),
  
  body("deliverables.*")
    .optional()
    .isMongoId()
    .withMessage("Each deliverable must be a valid upload ID"),
  
  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),
  
  validatorMiddleware,
];

exports.getMissionValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid mission ID is required"),
  
  validatorMiddleware,
];
