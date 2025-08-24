const asyncHandler = require("express-async-handler");
const factory = require("./factoryController");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Upload = require("../models/Upload");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc Get all uploads
// @route GET /api/uploads
// @access Private/Admin
exports.getUploads = factory.getAll(Upload, {
  path: "user",
  select: "firstName lastName email",
});

// @desc Get uploads with filters
// @route GET /api/uploads/filter
// @access Public/Private
exports.getFilteredUploads = asyncHandler(async (req, res, next) => {
  let filter = { status: "approved" }; // Only show approved uploads to public

  // If user is admin/master, they can see all uploads
  if (req.user && ["admin", "master"].includes(req.user.role)) {
    filter = {}; // Remove status filter for admins
    if (req.query.status) {
      filter.status = req.query.status;
    }
  }

  // Add other filters
  if (req.query.category) filter.category = req.query.category;
  if (req.query.fileType) filter.fileType = req.query.fileType;
  if (req.query.featured) filter.featured = req.query.featured === "true";
  if (req.query.user) filter.user = req.query.user;

  // Price range filter
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Sorting
  let sort = { createdAt: -1 };
  if (req.query.sort) {
    const sortField = req.query.sort.startsWith("-")
      ? req.query.sort.substring(1)
      : req.query.sort;
    const sortOrder = req.query.sort.startsWith("-") ? -1 : 1;
    sort = { [sortField]: sortOrder };
  }

  const uploads = await Upload.find(filter)
    .populate("user", "firstName lastName")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const totalUploads = await Upload.countDocuments(filter);
  const totalPages = Math.ceil(totalUploads / limit);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        results: uploads.length,
        totalResults: totalUploads,
        totalPages,
        currentPage: page,
        data: uploads,
      },
      "success.uploads_retrieved"
    )
  );
});

// @desc Get single upload by ID
// @route GET /api/uploads/:id
// @access Public/Private
exports.getUploadById = asyncHandler(async (req, res, next) => {
  const upload = await Upload.findById(req.params.id)
    .populate("user", "firstName lastName email avatar")
    .populate("reviewedBy", "firstName lastName");

  if (!upload) {
    return next(new ApiError("upload.not_found", 404));
  }

  // Only show approved uploads to non-owners/non-admins
  if (
    upload.status !== "approved" &&
    (!req.user ||
      (req.user.id !== upload.user._id.toString() &&
        !["admin", "master"].includes(req.user.role)))
  ) {
    return next(new ApiError("upload.not_found", 404));
  }

  // Increment views if not the owner
  if (!req.user || req.user.id !== upload.user._id.toString()) {
    await upload.incrementViews();
  }

  res
    .status(200)
    .json(new ApiResponse(200, upload, "success.upload_retrieved"));
});

// @desc Create new upload
// @route POST /api/uploads
// @access Private/User
exports.createUpload = asyncHandler(async (req, res, next) => {
  // Add user ID to upload data
  req.body.user = req.user.id;

  const upload = await Upload.create(req.body);

  // Update user's total uploads count
  await User.findByIdAndUpdate(req.user.id, {
    $inc: { totalUploads: 1 },
  });

  // Create notification for admins about new upload
  const admins = await User.find({
    role: { $in: ["admin", "master"] },
    status: "active",
  });
  const notifications = admins.map((admin) => ({
    user: admin._id,
    title: "New Upload Pending Review",
    message: `${req.user.firstName} ${req.user.lastName} uploaded "${upload.title}" for review`,
    type: "upload",
    priority: "medium",
    data: { uploadId: upload._id },
    actionUrl: `/admin/uploads/${upload._id}`,
    actionText: "Review Upload",
  }));

  await Notification.createBulkNotifications(notifications);

  res.status(201).json(new ApiResponse(201, upload, "success.upload_created"));
});

// @desc Update upload
// @route PUT /api/uploads/:id
// @access Private/Owner or Admin
exports.updateUpload = asyncHandler(async (req, res, next) => {
  const upload = await Upload.findById(req.params.id);

  if (!upload) {
    return next(new ApiError("upload.not_found", 404));
  }

  // Check ownership or admin privileges
  if (
    upload.user.toString() !== req.user.id &&
    !["admin", "master"].includes(req.user.role)
  ) {
    return next(new ApiError("upload.access_denied", 403));
  }

  // Users can only edit pending uploads
  if (
    upload.user.toString() === req.user.id &&
    upload.status !== "pending" &&
    !["admin", "master"].includes(req.user.role)
  ) {
    return next(new ApiError("upload.cannot_edit_reviewed", 400));
  }

  const updatedUpload = await Upload.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate("user", "firstName lastName email");

  res
    .status(200)
    .json(new ApiResponse(200, updatedUpload, "success.upload_updated"));
});

// @desc Delete upload
// @route DELETE /api/uploads/:id
// @access Private/Owner or Admin
exports.deleteUpload = asyncHandler(async (req, res, next) => {
  const upload = await Upload.findById(req.params.id);

  if (!upload) {
    return next(new ApiError("upload.not_found", 404));
  }

  // Check ownership or admin privileges
  if (
    upload.user.toString() !== req.user.id &&
    !["admin", "master"].includes(req.user.role)
  ) {
    return next(new ApiError("upload.access_denied", 403));
  }

  await Upload.findByIdAndDelete(req.params.id);

  // Update user's total uploads count
  await User.findByIdAndUpdate(upload.user, {
    $inc: { totalUploads: -1 },
  });

  res.status(200).json(new ApiResponse(200, null, "success.upload_deleted"));
});

// @desc Approve upload
// @route PATCH /api/uploads/:id/approve
// @access Private/Admin
exports.approveUpload = asyncHandler(async (req, res, next) => {
  const upload = await Upload.findById(req.params.id).populate(
    "user",
    "firstName lastName email"
  );

  if (!upload) {
    return next(new ApiError("upload.not_found", 404));
  }

  if (upload.status !== "pending") {
    return next(new ApiError("upload.already_reviewed", 400));
  }

  await upload.approve(req.user.id);

  // Create notification for user
  await Notification.createNotification({
    user: upload.user._id,
    title: "Upload Approved",
    message: `Your upload "${upload.title}" has been approved and is now live in the marketplace`,
    type: "upload",
    priority: "high",
    data: { uploadId: upload._id },
    actionUrl: `/uploads/${upload._id}`,
    actionText: "View Upload",
  });

  res.status(200).json(new ApiResponse(200, upload, "success.upload_approved"));
});

// @desc Reject upload
// @route PATCH /api/uploads/:id/reject
// @access Private/Admin
exports.rejectUpload = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const upload = await Upload.findById(req.params.id).populate(
    "user",
    "firstName lastName email"
  );

  if (!upload) {
    return next(new ApiError("upload.not_found", 404));
  }

  if (upload.status !== "pending") {
    return next(new ApiError("upload.already_reviewed", 400));
  }

  await upload.reject(req.user.id, reason);

  // Create notification for user
  await Notification.createNotification({
    user: upload.user._id,
    title: "Upload Rejected",
    message: `Your upload "${upload.title}" has been rejected. Reason: ${reason}`,
    type: "upload",
    priority: "high",
    data: { uploadId: upload._id, reason },
    actionUrl: `/uploads/${upload._id}`,
    actionText: "View Details",
  });

  res.status(200).json(new ApiResponse(200, upload, "success.upload_rejected"));
});

// @desc Get pending uploads for review
// @route GET /api/uploads/pending
// @access Private/Admin
exports.getPendingUploads = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const uploads = await Upload.find({ status: "pending" })
    .populate("user", "firstName lastName email")
    .sort({ createdAt: 1 }) // Oldest first
    .skip(skip)
    .limit(limit);

  const totalPending = await Upload.countDocuments({ status: "pending" });
  const totalPages = Math.ceil(totalPending / limit);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        results: uploads.length,
        totalResults: totalPending,
        totalPages,
        currentPage: page,
        data: uploads,
      },
      "success.pending_uploads_retrieved"
    )
  );
});

// @desc Search uploads
// @route GET /api/uploads/search
// @access Public
exports.searchUploads = factory.searchDocuments(
  Upload,
  ["title", "description", "tags"],
  { path: "user", select: "firstName lastName" }
);

// @desc Get upload statistics
// @route GET /api/uploads/stats
// @access Private/Admin
exports.getUploadStats = factory.getStats(Upload);

// @desc Toggle featured status
// @route PATCH /api/uploads/:id/featured
// @access Private/Admin
exports.toggleFeatured = factory.toggleField(Upload, ["featured"]);

// @desc Bulk upload operations
// @route POST /api/uploads/bulk
// @access Private/Admin
exports.bulkUploadOperations = asyncHandler(async (req, res, next) => {
  const { operation, ids, reason } = req.body;

  if (!operation || !ids || !Array.isArray(ids)) {
    return next(new ApiError("bulk.invalid_request", 400));
  }

  let result;
  const uploads = await Upload.find({ _id: { $in: ids } }).populate(
    "user",
    "firstName lastName"
  );

  switch (operation) {
    case "approve":
      result = await Upload.updateMany(
        { _id: { $in: ids }, status: "pending" },
        {
          status: "approved",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        }
      );

      // Create notifications for users
      const approveNotifications = uploads.map((upload) => ({
        user: upload.user._id,
        title: "Upload Approved",
        message: `Your upload "${upload.title}" has been approved`,
        type: "upload",
        priority: "high",
      }));
      await Notification.createBulkNotifications(approveNotifications);
      break;

    case "reject":
      if (!reason) {
        return next(new ApiError("upload.rejection_reason_required", 400));
      }

      result = await Upload.updateMany(
        { _id: { $in: ids }, status: "pending" },
        {
          status: "rejected",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          rejectionReason: reason,
        }
      );

      // Create notifications for users
      const rejectNotifications = uploads.map((upload) => ({
        user: upload.user._id,
        title: "Upload Rejected",
        message: `Your upload "${upload.title}" has been rejected. Reason: ${reason}`,
        type: "upload",
        priority: "high",
      }));
      await Notification.createBulkNotifications(rejectNotifications);
      break;

    case "feature":
      result = await Upload.updateMany(
        { _id: { $in: ids }, status: "approved" },
        { featured: true }
      );
      break;

    case "unfeature":
      result = await Upload.updateMany(
        { _id: { $in: ids } },
        { featured: false }
      );
      break;

    case "delete":
      result = await Upload.deleteMany({ _id: { $in: ids } });
      break;

    default:
      return next(new ApiError("bulk.operation_not_supported", 400));
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        operation,
        affectedUploads: result.modifiedCount || result.deletedCount,
      },
      "success.bulk_operation_completed"
    )
  );
});
