const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Order = require("../models/Order");
const Upload = require("../models/Upload");
const User = require("../models/User");
const Revenue = require("../models/Revenue");
const Notification = require("../models/Notification");

// @desc    Create new order
// @route   POST /api/orders
// @access  Private/User
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { items, billingAddress, paymentMethod, notes } = req.body;

  // Validate uploads exist and are approved
  const uploadIds = items.map((item) => item.uploadId);
  const uploads = await Upload.find({
    _id: { $in: uploadIds },
    status: "approved",
  }).populate("user", "firstName lastName email");

  if (uploads.length !== uploadIds.length) {
    return next(
      new ApiError(
        "Some uploads are not available",
        400,
        "uploads_not_available"
      )
    );
  }

  // Create order items with current prices
  const orderItems = uploads.map((upload) => {
    const requestedItem = items.find(
      (item) => item.uploadId.toString() === upload._id.toString()
    );
    return {
      upload: upload._id,
      price: upload.price,
      downloadUrl: "", // Will be set after payment
      downloadExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  });

  // Calculate total amount
  const totalAmount = orderItems.reduce((sum, item) => sum + item.price, 0);

  // Create order
  const order = await Order.create({
    customer: req.user._id,
    items: orderItems,
    totalAmount,
    paymentMethod,
    billingAddress,
    notes,
  });

  // Populate order for response
  await order.populate([
    { path: "customer", select: "firstName lastName email" },
    { path: "items.upload", select: "title thumbnailUrl fileType user" },
  ]);

  res
    .status(201)
    .json(new ApiResponse(201, order, "Order created successfully"));
});

// @desc    Process payment (dummy implementation)
// @route   POST /api/orders/:id/payment
// @access  Private/User
exports.processPayment = asyncHandler(async (req, res, next) => {
  const { paymentData } = req.body;

  const order = await Order.findById(req.params.id)
    .populate("items.upload", "title user price")
    .populate("customer", "firstName lastName email");

  if (!order) {
    return next(new ApiError("Order not found", 404, "order_not_found"));
  }

  if (order.customer._id.toString() !== req.user._id.toString()) {
    return next(
      new ApiError("Not authorized to access this order", 403, "not_authorized")
    );
  }

  if (order.status !== "pending") {
    return next(
      new ApiError("Order cannot be paid", 400, "order_cannot_be_paid")
    );
  }

  try {
    // Simulate payment processing
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Mark order as paid
    await order.markAsPaid(paymentId, paymentData);

    // Create revenue records for sellers
    for (const item of order.items) {
      const upload = item.upload;
      const seller = await User.findById(upload.user);

      if (seller) {
        await Revenue.createUploadSaleRevenue(order, upload, seller);
        await upload.recordSale(item.price);
      }
    }

    // Send notifications to sellers
    for (const item of order.items) {
      const upload = item.upload;
      await Notification.createNotification({
        user: upload.user,
        title: "New Sale!",
        message: `Your upload "${upload.title}" has been sold for ${item.price} SAR`,
        type: "payment",
        priority: "medium",
        data: {
          orderId: order._id,
          uploadId: upload._id,
          amount: item.price,
        },
      });
    }

    // Send confirmation to customer
    await Notification.createNotification({
      user: order.customer._id,
      title: "Payment Successful",
      message: `Your order ${order.orderNumber} has been processed successfully`,
      type: "payment",
      priority: "medium",
      data: {
        orderId: order._id,
        amount: order.totalAmount,
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, order, "Payment processed successfully"));
  } catch (error) {
    return next(
      new ApiError("Payment processing failed", 500, "payment_failed")
    );
  }
});

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private/User
exports.getUserOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;

  const orders = await Order.findByCustomer(req.user._id, {
    page,
    limit,
    status,
  });
  const total = await Order.countDocuments({
    customer: req.user._id,
    ...(status && { status }),
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Orders retrieved successfully"
    )
  );
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private/User
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "firstName lastName email")
    .populate("items.upload", "title thumbnailUrl fileType user");

  if (!order) {
    return next(new ApiError("Order not found", 404, "order_not_found"));
  }

  // Check if user owns this order or is admin/master
  if (
    order.customer._id.toString() !== req.user._id.toString() &&
    !["admin", "master"].includes(req.user.role)
  ) {
    return next(
      new ApiError("Not authorized to access this order", 403, "not_authorized")
    );
  }

  res
    .status(200)
    .json(new ApiResponse(200, order, "Order retrieved successfully"));
});

// @desc    Download purchased item
// @route   GET /api/orders/:id/download/:itemId
// @access  Private/User
exports.downloadItem = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "items.upload",
    "originalFileUrl title"
  );

  if (!order) {
    return next(new ApiError("Order not found", 404, "order_not_found"));
  }

  if (order.customer.toString() !== req.user._id.toString()) {
    return next(
      new ApiError("Not authorized to access this order", 403, "not_authorized")
    );
  }

  if (order.status !== "paid" && order.status !== "completed") {
    return next(new ApiError("Order not paid", 400, "order_not_paid"));
  }

  const item = order.items.id(req.params.itemId);
  if (!item) {
    return next(new ApiError("Item not found in order", 404, "item_not_found"));
  }

  if (new Date() > item.downloadExpires) {
    return next(
      new ApiError("Download link has expired", 400, "download_expired")
    );
  }

  // Mark as downloaded
  if (!item.downloaded) {
    item.downloaded = true;
    item.downloadedAt = new Date();
    await order.save();
  }

  // In a real implementation, you would serve the file or redirect to a signed URL
  res.status(200).json(
    new ApiResponse(
      200,
      {
        downloadUrl: item.upload.originalFileUrl,
        filename: item.upload.title,
        expiresAt: item.downloadExpires,
      },
      "Download link retrieved successfully"
    )
  );
});

// @desc    Get all orders (Admin/Master only)
// @route   GET /api/orders/admin/all
// @access  Private/Admin/Master
exports.getAllOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const search = req.query.search;

  let query = {};

  if (status) {
    query.status = status;
  }

  if (search) {
    query.orderNumber = { $regex: search, $options: "i" };
  }

  const orders = await Order.find(query)
    .populate("customer", "firstName lastName email")
    .populate("items.upload", "title thumbnailUrl")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Order.countDocuments(query);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Orders retrieved successfully"
    )
  );
});

// @desc    Update order status (Admin/Master only)
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin/Master
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, notes } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError("Order not found", 404, "order_not_found"));
  }

  order.status = status;
  if (notes) order.notes = notes;

  await order.save();

  // Send notification to customer
  await Notification.createNotification({
    user: order.customer,
    title: "Order Status Updated",
    message: `Your order ${order.orderNumber} status has been updated to ${status}`,
    type: "system",
    priority: "medium",
    data: {
      orderId: order._id,
      newStatus: status,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, order, "Order status updated successfully"));
});
