const express = require("express");
const {
  createOrder,
  processPayment,
  getUserOrders,
  getOrder,
  downloadItem,
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/orderController");
const {
  createOrderValidator,
  processPaymentValidator,
  getOrderValidator,
  downloadItemValidator,
  updateOrderStatusValidator,
} = require("../utils/validators/orderValidator");
const { protect, allowedTo } = require("../controllers/authController");

const router = express.Router();

// All routes require authentication
router.use(protect);

// User routes
router.route("/")
  .post(createOrderValidator, createOrder)
  .get(getUserOrders);

router.route("/:id")
  .get(getOrderValidator, getOrder);

router.route("/:id/payment")
  .post(processPaymentValidator, processPayment);

router.route("/:id/download/:itemId")
  .get(downloadItemValidator, downloadItem);

// Admin/Master routes
router.use(allowedTo("admin", "master"));

router.route("/admin/all")
  .get(getAllOrders);

router.route("/:id/status")
  .patch(updateOrderStatusValidator, updateOrderStatus);

module.exports = router;
