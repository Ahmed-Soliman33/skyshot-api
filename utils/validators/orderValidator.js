const { body, param, query } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.createOrderValidator = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required")
    .custom((items) => {
      for (const item of items) {
        if (!item.uploadId) {
          throw new Error("Upload ID is required for each item");
        }
      }
      return true;
    }),
  
  body("items.*.uploadId")
    .isMongoId()
    .withMessage("Valid upload ID is required"),
  
  body("paymentMethod")
    .isIn(["credit_card", "paypal", "bank_transfer", "wallet"])
    .withMessage("Valid payment method is required"),
  
  body("billingAddress.firstName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  
  body("billingAddress.lastName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  
  body("billingAddress.email")
    .optional()
    .isEmail()
    .withMessage("Valid email is required"),
  
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
  
  validatorMiddleware,
];

exports.processPaymentValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid order ID is required"),
  
  body("paymentData")
    .optional()
    .isObject()
    .withMessage("Payment data must be an object"),
  
  validatorMiddleware,
];

exports.getOrderValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid order ID is required"),
  
  validatorMiddleware,
];

exports.downloadItemValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid order ID is required"),
  
  param("itemId")
    .isMongoId()
    .withMessage("Valid item ID is required"),
  
  validatorMiddleware,
];

exports.updateOrderStatusValidator = [
  param("id")
    .isMongoId()
    .withMessage("Valid order ID is required"),
  
  body("status")
    .isIn(["pending", "paid", "completed", "cancelled", "refunded"])
    .withMessage("Valid status is required"),
  
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
  
  validatorMiddleware,
];
