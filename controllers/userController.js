const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const factory = require("./factoryController");
const ApiError = require("../utils/ApiError");

// Private For Admin (CRUD operations on User)

// @desc Get all Users
// @route GET /api/users
// @access Private/Protected
exports.getUsers = factory.getAll(User);

// @desc Get User by ID
// @route GET /api/users/:id
// @access Private/Protected
exports.getUserById = factory.getOne(User);

// @desc Get User by ID
// @route GET /api/users/getUserByEmail
// @access Private/Protected
exports.getUserByEmail = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(
        `User with email: ${req.body.email} not found`,
        404,
        "user_not_found"
      )
    );
  }

  res.status(200).json({ data: user });
});

// @desc Promote/Demote specific User
// @route PATCH /api/users/:id/promote
// @access Private/Protected
exports.promoteOrDemoteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (req.user.role !== "master") {
    return next(new ApiError("You are not authorized to promote users", 403));
  }

  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(`User with id: ${id} not found`, 404));
  }

  if (user.role === "master") {
    return next(new ApiError("You can't promote a master user", 403));
  }

  if (user.role === req.body.role) {
    return next(new ApiError("User is already in this role", 403));
  }

  if (req.body.role === "master") {
    return next(new ApiError("You can't promote a user to master", 403));
  }

  const roles = ["user", "partner", "admin", "master"];

  if (!roles.includes(req.body.role)) {
    return next(new ApiError("Invalid user role provided", 403));
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      role: req.body.role,
    },
    {
      new: true,
    }
  );
  if (!updatedUser) {
    return next(new ApiError(`User with id: ${id} not found`, 404));
  }

  res.status(200).json({ data: updatedUser });
});

// @desc Delete specific User
// @route DELETE /api/users/:id
// @access Private/Protected
exports.deleteUser = factory.deleteOne(User);

// @desc    Deactivate User
// @route   DELETE /api/users/:id/deactivate
// @access  Private/Protected
exports.deactivateAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  await User.findByIdAndUpdate(id, {
    active: false,
  });
  res.status(204).json({ status: "success" });
});

// @desc    Activate User
// @route   POST /api/users/:id/activate
// @access  Private/Protected
exports.activateAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await User.findByIdAndUpdate(id, {
    active: true,
  });
  res.status(204).json({ status: "success" });
});

// @desc Get user statistics
// @route GET /api/users/:id/stats
// @access Private/Owner or Admin
exports.getUserStats = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    return next(new ApiError("user.not_found", 404));
  }

  // Get upload statistics
  const uploadStats = await Upload.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalEarnings: { $sum: { $multiply: ["$downloads", "$price"] } },
        totalViews: { $sum: "$views" },
        totalDownloads: { $sum: "$downloads" },
      },
    },
  ]);

  // Get recent uploads
  const recentUploads = await Upload.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title status createdAt views downloads");

  const stats = {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      joinDate: user.createdAt,
      lastLogin: user.lastLogin,
    },
    uploads: uploadStats,
    recentUploads,
    summary: {
      totalUploads: user.totalUploads,
      totalEarnings: user.totalEarnings,
    },
  };

  res.status(200).json(new ApiResponse(200, stats, "success.stats_retrieved"));
});

// @desc Search users
// @route GET /api/users/search
// @access Private/Admin
exports.searchUsers = factory.searchDocuments(
  User,
  ["firstName", "lastName", "email"],
  "uploadsCount"
);

// @desc Get users by role
// @route GET /api/users/role/:role
// @access Private/Admin
exports.getUsersByRole = asyncHandler(async (req, res, next) => {
  const { role } = req.params;

  const users = await User.findByRole(role);

  res.status(200).json(new ApiResponse(200, users, "success.users_retrieved"));
});

// @desc Bulk user operations
// @route POST /api/users/bulk
// @access Private/Master
exports.bulkUserOperations = asyncHandler(async (req, res, next) => {
  const { operation, userIds, data } = req.body;

  if (!operation || !userIds || !Array.isArray(userIds)) {
    return next(new ApiError("bulk.invalid_request", 400));
  }

  let result;

  switch (operation) {
    case "activate":
      result = await User.updateMany(
        { _id: { $in: userIds } },
        { status: "active" }
      );
      break;
    case "deactivate":
      result = await User.updateMany(
        { _id: { $in: userIds } },
        { status: "deactivated" }
      );
      break;
    case "delete":
      result = await User.deleteMany({ _id: { $in: userIds } });
      break;
    default:
      return next(new ApiError("bulk.operation_not_supported", 400));
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        operation,
        affectedUsers: result.modifiedCount || result.deletedCount,
      },
      "success.bulk_operation_completed"
    )
  );
});
