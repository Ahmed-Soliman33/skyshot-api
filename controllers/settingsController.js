const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const Settings = require("../models/Settings");

// @desc    Get all public settings
// @route   GET /api/settings/public
// @access  Public
exports.getPublicSettings = asyncHandler(async (req, res, next) => {
  const settings = await Settings.getPublicSettings();

  // Convert to key-value object for easier frontend consumption
  const settingsObject = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        settingsObject,
        "Public settings retrieved successfully"
      )
    );
});

// @desc    Get settings by category
// @route   GET /api/settings/category/:category
// @access  Private/Admin/Master
exports.getSettingsByCategory = asyncHandler(async (req, res, next) => {
  const { category } = req.params;
  const includePrivate = req.user.role === "master";

  const settings = await Settings.getByCategory(category, includePrivate);

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        settings,
        `Settings for ${category} category retrieved successfully`
      )
    );
});

// @desc    Get all settings (Master only)
// @route   GET /api/settings
// @access  Private/Master
exports.getAllSettings = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const category = req.query.category;
  const search = req.query.search;

  let query = {};

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { key: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const settings = await Settings.find(query)
    .populate("lastModifiedBy", "firstName lastName email")
    .sort({ category: 1, key: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Settings.countDocuments(query);

  // Get available categories
  const categories = await Settings.distinct("category");

  res.status(200).json(
    new ApiResponse(
      200,
      {
        settings,
        categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Settings retrieved successfully"
    )
  );
});

// @desc    Get single setting
// @route   GET /api/settings/:key
// @access  Private/Admin/Master
exports.getSetting = asyncHandler(async (req, res, next) => {
  const setting = await Settings.findOne({ key: req.params.key }).populate(
    "lastModifiedBy",
    "firstName lastName email"
  );

  if (!setting) {
    return next(new ApiError("Setting not found", 404, "setting_not_found"));
  }

  // Check if user can access this setting
  if (!setting.isPublic && req.user.role !== "master") {
    return next(
      new ApiError(
        "Not authorized to access this setting",
        403,
        "not_authorized"
      )
    );
  }

  res
    .status(200)
    .json(new ApiResponse(200, setting, "Setting retrieved successfully"));
});

// @desc    Create new setting
// @route   POST /api/settings
// @access  Private/Master
exports.createSetting = asyncHandler(async (req, res, next) => {
  const settingData = {
    ...req.body,
    lastModifiedBy: req.user._id,
  };

  const setting = await Settings.create(settingData);

  await setting.populate("lastModifiedBy", "firstName lastName email");

  res
    .status(201)
    .json(new ApiResponse(201, setting, "Setting created successfully"));
});

// @desc    Update setting
// @route   PUT /api/settings/:key
// @access  Private/Admin/Master
exports.updateSetting = asyncHandler(async (req, res, next) => {
  const { value } = req.body;

  const setting = await Settings.findOne({ key: req.params.key });

  if (!setting) {
    return next(new ApiError("Setting not found", 404, "setting_not_found"));
  }

  if (!setting.isEditable) {
    return next(
      new ApiError(
        "This setting cannot be modified",
        400,
        "setting_not_editable"
      )
    );
  }

  // Check permissions
  if (req.user.role !== "master" && setting.category === "security") {
    return next(
      new ApiError(
        "Only masters can modify security settings",
        403,
        "not_authorized"
      )
    );
  }

  try {
    await setting.updateValue(value, req.user._id);
    await setting.populate("lastModifiedBy", "firstName lastName email");

    res
      .status(200)
      .json(new ApiResponse(200, setting, "Setting updated successfully"));
  } catch (error) {
    return next(new ApiError(error.message, 400, "validation_failed"));
  }
});

// @desc    Update multiple settings
// @route   PUT /api/settings/bulk
// @access  Private/Master
exports.updateMultipleSettings = asyncHandler(async (req, res, next) => {
  const { settings } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return next(
      new ApiError("Settings array is required", 400, "settings_array_required")
    );
  }

  const updatedSettings = [];
  const errors = [];

  for (const settingUpdate of settings) {
    try {
      const { key, value } = settingUpdate;

      const setting = await Settings.findOne({ key });

      if (!setting) {
        errors.push({ key, error: "Setting not found" });
        continue;
      }

      if (!setting.isEditable) {
        errors.push({ key, error: "Setting is not editable" });
        continue;
      }

      await setting.updateValue(value, req.user._id);
      updatedSettings.push(setting);
    } catch (error) {
      errors.push({ key: settingUpdate.key, error: error.message });
    }
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        updated: updatedSettings,
        errors,
        totalUpdated: updatedSettings.length,
        totalErrors: errors.length,
      },
      "Bulk settings update completed"
    )
  );
});

// @desc    Delete setting
// @route   DELETE /api/settings/:key
// @access  Private/Master
exports.deleteSetting = asyncHandler(async (req, res, next) => {
  const setting = await Settings.findOne({ key: req.params.key });

  if (!setting) {
    return next(new ApiError("Setting not found", 404, "setting_not_found"));
  }

  if (!setting.isEditable) {
    return next(
      new ApiError(
        "This setting cannot be deleted",
        400,
        "setting_not_deletable"
      )
    );
  }

  await Settings.findByIdAndDelete(setting._id);

  res
    .status(200)
    .json(new ApiResponse(200, null, "Setting deleted successfully"));
});

// @desc    Initialize default settings
// @route   POST /api/settings/initialize
// @access  Private/Master
exports.initializeDefaultSettings = asyncHandler(async (req, res, next) => {
  try {
    await Settings.initializeDefaults();

    res
      .status(200)
      .json(
        new ApiResponse(200, null, "Default settings initialized successfully")
      );
  } catch (error) {
    return next(
      new ApiError(
        "Failed to initialize default settings",
        500,
        "initialization_failed"
      )
    );
  }
});

// @desc    Export settings
// @route   GET /api/settings/export
// @access  Private/Master
exports.exportSettings = asyncHandler(async (req, res, next) => {
  const category = req.query.category;
  const includePrivate = req.query.includePrivate === "true";

  let query = {};
  if (category) query.category = category;
  if (!includePrivate) query.isPublic = true;

  const settings = await Settings.find(query)
    .select(
      "key value type category description isPublic isEditable validation"
    )
    .sort({ category: 1, key: 1 });

  res
    .status(200)
    .json(new ApiResponse(200, settings, "Settings exported successfully"));
});

// @desc    Import settings
// @route   POST /api/settings/import
// @access  Private/Master
exports.importSettings = asyncHandler(async (req, res, next) => {
  const { settings, overwrite = false } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return next(
      new ApiError("Settings array is required", 400, "settings_array_required")
    );
  }

  const imported = [];
  const skipped = [];
  const errors = [];

  for (const settingData of settings) {
    try {
      const { key } = settingData;

      const existingSetting = await Settings.findOne({ key });

      if (existingSetting && !overwrite) {
        skipped.push({ key, reason: "Setting already exists" });
        continue;
      }

      if (existingSetting && overwrite) {
        await Settings.findOneAndUpdate(
          { key },
          { ...settingData, lastModifiedBy: req.user._id },
          { runValidators: true }
        );
      } else {
        await Settings.create({
          ...settingData,
          lastModifiedBy: req.user._id,
        });
      }

      imported.push(key);
    } catch (error) {
      errors.push({ key: settingData.key, error: error.message });
    }
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        imported,
        skipped,
        errors,
        totalImported: imported.length,
        totalSkipped: skipped.length,
        totalErrors: errors.length,
      },
      "Settings import completed"
    )
  );
});

// @desc    Reset settings to defaults
// @route   POST /api/settings/reset
// @access  Private/Master
exports.resetToDefaults = asyncHandler(async (req, res, next) => {
  const { category, confirm } = req.body;

  if (!confirm) {
    return next(
      new ApiError(
        "Confirmation required for reset operation",
        400,
        "confirmation_required"
      )
    );
  }

  let query = {};
  if (category) query.category = category;

  // Delete existing settings
  await Settings.deleteMany(query);

  // Reinitialize defaults
  await Settings.initializeDefaults();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        `Settings ${category ? `for ${category} category` : ""} reset to defaults successfully`
      )
    );
});
