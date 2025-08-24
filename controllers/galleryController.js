const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Upload = require("../models/Upload");
const User = require("../models/User");

// @desc    Get all approved uploads for gallery
// @route   GET /api/gallery
// @access  Public
exports.getGallery = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const category = req.query.category;
  const fileType = req.query.fileType;
  const featured = req.query.featured;
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
  const minPrice = req.query.minPrice;
  const maxPrice = req.query.maxPrice;

  let query = { status: "approved" };

  if (category) query.category = category;
  if (fileType) query.fileType = fileType;
  if (featured === "true") query.featured = true;
  if (minPrice) query.price = { ...query.price, $gte: parseFloat(minPrice) };
  if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };

  let sortQuery = {};
  if (sortBy === "popularity") {
    // Sort by popularity score (views + downloads + likes)
    sortQuery = { views: -1, downloads: -1, likes: -1 };
  } else if (sortBy === "price") {
    sortQuery = { price: sortOrder };
  } else {
    sortQuery[sortBy] = sortOrder;
  }

  const uploads = await Upload.find(query)
    .populate("user", "firstName lastName avatar")
    .select("-originalFileUrl") // Don't expose original file URLs
    .sort(sortQuery)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Upload.countDocuments(query);

  // Get categories and file types for filters
  const categories = await Upload.distinct("category", { status: "approved" });
  const fileTypes = await Upload.distinct("fileType", { status: "approved" });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        uploads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        filters: {
          categories,
          fileTypes,
        },
      },
      "Gallery retrieved successfully"
    )
  );
});

// @desc    Get featured uploads
// @route   GET /api/gallery/featured
// @access  Public
exports.getFeaturedUploads = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 8;

  const uploads = await Upload.find({
    status: "approved",
    featured: true,
  })
    .populate("user", "firstName lastName avatar")
    .select("-originalFileUrl")
    .sort({ createdAt: -1 })
    .limit(limit);

  res
    .status(200)
    .json(
      new ApiResponse(200, uploads, "Featured uploads retrieved successfully")
    );
});

// @desc    Get popular uploads
// @route   GET /api/gallery/popular
// @access  Public
exports.getPopularUploads = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 10;
  const period = req.query.period || "all"; // all, week, month

  let dateFilter = {};
  if (period === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    dateFilter.createdAt = { $gte: weekAgo };
  } else if (period === "month") {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter.createdAt = { $gte: monthAgo };
  }

  const uploads = await Upload.find({
    status: "approved",
    ...dateFilter,
  })
    .populate("user", "firstName lastName avatar")
    .select("-originalFileUrl")
    .sort({ views: -1, downloads: -1, likes: -1 })
    .limit(limit);

  res
    .status(200)
    .json(
      new ApiResponse(200, uploads, "Popular uploads retrieved successfully")
    );
});

// @desc    Search uploads
// @route   GET /api/gallery/search
// @access  Public
exports.searchUploads = asyncHandler(async (req, res, next) => {
  const { q: query } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const category = req.query.category;
  const fileType = req.query.fileType;

  if (!query) {
    return next(
      new ApiError("Search query is required", 400, "search_query_required")
    );
  }

  let filters = {};
  if (category) filters.category = category;
  if (fileType) filters.fileType = fileType;

  const uploads = await Upload.searchUploads(query, filters)
    .populate("user", "firstName lastName avatar")
    .select("-originalFileUrl")
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = uploads.length; // Approximate count for text search

  res.status(200).json(
    new ApiResponse(
      200,
      {
        uploads,
        query,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Search results retrieved successfully"
    )
  );
});

// @desc    Get single upload details
// @route   GET /api/gallery/:id
// @access  Public
exports.getUploadDetails = asyncHandler(async (req, res, next) => {
  const upload = await Upload.findOne({
    _id: req.params.id,
    status: "approved",
  })
    .populate("user", "firstName lastName avatar bio")
    .select("-originalFileUrl"); // Don't expose original file URL

  if (!upload) {
    return next(new ApiError("Upload not found", 404, "upload_not_found"));
  }

  // Increment views
  await upload.incrementViews();

  // Get related uploads (same category, different upload)
  const relatedUploads = await Upload.find({
    _id: { $ne: upload._id },
    category: upload.category,
    status: "approved",
  })
    .populate("user", "firstName lastName avatar")
    .select("-originalFileUrl")
    .sort({ views: -1 })
    .limit(6);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        upload,
        relatedUploads,
      },
      "Upload details retrieved successfully"
    )
  );
});

// @desc    Get uploads by category
// @route   GET /api/gallery/category/:category
// @access  Public
exports.getUploadsByCategory = asyncHandler(async (req, res, next) => {
  const { category } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  let sortQuery = {};
  if (sortBy === "popularity") {
    sortQuery = { views: -1, downloads: -1, likes: -1 };
  } else if (sortBy === "price") {
    sortQuery = { price: sortOrder };
  } else {
    sortQuery[sortBy] = sortOrder;
  }

  const uploads = await Upload.findByCategory(category)
    .populate("user", "firstName lastName avatar")
    .select("-originalFileUrl")
    .sort(sortQuery)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Upload.countDocuments({
    category,
    status: "approved",
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        uploads,
        category,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      `Uploads in ${category} category retrieved successfully`
    )
  );
});

// @desc    Get uploads by user
// @route   GET /api/gallery/user/:userId
// @access  Public
exports.getUploadsByUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  // Check if user exists
  const user = await User.findById(userId).select(
    "firstName lastName avatar bio totalUploads"
  );

  if (!user) {
    return next(new ApiError("User not found", 404, "user_not_found"));
  }

  const uploads = await Upload.find({
    user: userId,
    status: "approved",
  })
    .select("-originalFileUrl")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Upload.countDocuments({
    user: userId,
    status: "approved",
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        uploads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "User uploads retrieved successfully"
    )
  );
});

// @desc    Like/Unlike upload
// @route   POST /api/gallery/:id/like
// @access  Private
exports.toggleLike = asyncHandler(async (req, res, next) => {
  const upload = await Upload.findOne({
    _id: req.params.id,
    status: "approved",
  });

  if (!upload) {
    return next(new ApiError("Upload not found", 404, "upload_not_found"));
  }

  // In a real implementation, you would track individual user likes
  // For now, we'll just increment/decrement the likes count
  const action = req.body.action; // 'like' or 'unlike'

  if (action === "like") {
    upload.likes += 1;
  } else if (action === "unlike") {
    upload.likes = Math.max(0, upload.likes - 1);
  }

  await upload.save({ validateBeforeSave: false });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        likes: upload.likes,
        action,
      },
      `Upload ${action}d successfully`
    )
  );
});

// @desc    Get gallery statistics
// @route   GET /api/gallery/stats
// @access  Public
exports.getGalleryStats = asyncHandler(async (req, res, next) => {
  const stats = await Upload.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: null,
        totalUploads: { $sum: 1 },
        totalViews: { $sum: "$views" },
        totalDownloads: { $sum: "$downloads" },
        totalLikes: { $sum: "$likes" },
        averagePrice: { $avg: "$price" },
        categoryCounts: {
          $push: "$category",
        },
        fileTypeCounts: {
          $push: "$fileType",
        },
      },
    },
  ]);

  const categoryStats = await Upload.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        totalViews: { $sum: "$views" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const fileTypeStats = await Upload.aggregate([
    { $match: { status: "approved" } },
    {
      $group: {
        _id: "$fileType",
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        overview: stats[0] || {},
        categories: categoryStats,
        fileTypes: fileTypeStats,
      },
      "Gallery statistics retrieved successfully"
    )
  );
});
