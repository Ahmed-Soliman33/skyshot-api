const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");

exports.createOne = (Model) =>
  asyncHandler(async (req, res) => {
    const newDocument = await Model.create(req.body);

    res.status(201).json({ data: newDocument });
  });

exports.getAll = (Model) =>
  asyncHandler(async (req, res) => {
    let filterObj = {};
    if (req.filterObj) {
      filterObj = req.filterObj;
    }

    const countDocuments = await Model.countDocuments();

    console.log("Count Documents:", countDocuments);

    // Build query
    const apiFeature = new ApiFeatures(Model.find(filterObj), req.query)
      .search(Model.modelName)
      .limitFields()
      .filter()
      .sort()
      .paginate(countDocuments);

    const { mongooseQuery, paginationResults } = apiFeature;

    // Execute query
    const documents = await mongooseQuery;

    res
      .status(200)
      .json({ results: documents.length, paginationResults, data: documents });
  });

exports.getOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const document = await Model.findById(id);
    if (!document) {
      return next(new ApiError(`Document with id: ${id} not found`, 404));
    }

    res.status(200).json({ data: document });
  });

exports.deleteOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const document = await Model.findByIdAndDelete(id);
    if (!document) {
      return next(new ApiError(`Document with id: ${id} not found`, 404));
    }
    res.status(200).send();
  });

exports.updateOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const document = await Model.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!document) {
      return next(new ApiError(`Document with id: ${id} not found`, 404));
    }

    res.status(200).json({ data: document });
  });

// Add after existing searchDocuments method
exports.getStats = (Model) =>
  asyncHandler(async (req, res, next) => {
    const stats = await Model.aggregate([
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          // Add model-specific stats based on common fields
          ...(Model.modelName === "Upload" && {
            totalViews: { $sum: "$views" },
            totalDownloads: { $sum: "$downloads" },
            totalLikes: { $sum: "$likes" },
            averagePrice: { $avg: "$price" },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
            },
            featuredCount: {
              $sum: { $cond: ["$featured", 1, 0] },
            },
          }),
        },
      },
    ]);

    // Get category breakdown if applicable
    let categoryStats = [];
    if (Model.schema.paths.category) {
      categoryStats = await Model.aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            ...(Model.modelName === "Upload" && {
              totalViews: { $sum: "$views" },
              averagePrice: { $avg: "$price" },
            }),
          },
        },
        { $sort: { count: -1 } },
      ]);
    }

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentStats = await Model.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = {
      overview: stats[0] || { totalDocuments: 0 },
      categories: categoryStats,
      recentActivity: recentStats,
      generatedAt: new Date().toISOString(),
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          `${Model.modelName} statistics retrieved successfully`
        )
      );
  });

exports.toggleField = (Model, allowedFields = []) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const fieldName = allowedFields[0]; // Default to first allowed field

    // Find the document
    const document = await Model.findById(id);
    if (!document) {
      return next(
        new ApiError(`${Model.modelName} with id: ${id} not found`, 404)
      );
    }

    // Toggle the field
    document[fieldName] = !document[fieldName];
    await document.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          document,
          `${Model.modelName} ${fieldName} status toggled successfully`
        )
      );
  });

// Enhanced searchDocuments with populate support
exports.searchDocuments = (Model, searchFields = [], populateOptions = null) =>
  asyncHandler(async (req, res, next) => {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim() === "") {
      return next(new ApiError("Search query is required", 400));
    }

    // Build search conditions
    const searchConditions = searchFields.map((field) => ({
      [field]: { $regex: q, $options: "i" },
    }));

    // Add status filter for models that have it
    const baseFilter = {};
    if (Model.schema.paths.status) {
      baseFilter.status = { $in: ["approved", "active", "published"] };
    }

    // Build query with pagination
    const skip = (page - 1) * limit;
    let query = Model.find({
      $and: [{ $or: searchConditions }, baseFilter],
    })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Apply populate if provided
    if (populateOptions) {
      query = query.populate(populateOptions);
    }

    // Execute query and get total count
    const [results, totalResults] = await Promise.all([
      query,
      Model.countDocuments({
        $and: [{ $or: searchConditions }, baseFilter],
      }),
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalResults,
      pages: Math.ceil(totalResults / limit),
    };

    res.status(200).json(
      ApiResponse.paginated(
        results,
        pagination,
        `${Model.modelName} search completed successfully`
      ).addMeta("search", {
        query: q,
        searchFields,
        totalResults,
      })
    );
  });
