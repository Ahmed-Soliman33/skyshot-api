const express = require("express");
const {
  getPublicSettings,
  getSettingsByCategory,
  getAllSettings,
  getSetting,
  createSetting,
  updateSetting,
  updateMultipleSettings,
  deleteSetting,
  initializeDefaultSettings,
  exportSettings,
  importSettings,
  resetToDefaults,
} = require("../controllers/settingsController");
const {
  getSettingValidator,
  createSettingValidator,
  updateSettingValidator,
  updateMultipleSettingsValidator,
  importSettingsValidator,
  resetSettingsValidator,
} = require("../utils/validators/settingsValidator");
const { protect, allowedTo } = require("../controllers/authController");

const router = express.Router();

// Public routes
router.route("/public")
  .get(getPublicSettings);

// Protected routes
router.use(protect);

// Admin/Master routes
router.use(allowedTo("admin", "master"));

router.route("/category/:category")
  .get(getSettingsByCategory);

// Master only routes
router.use(allowedTo("master"));

router.route("/")
  .get(getAllSettings)
  .post(createSettingValidator, createSetting);

router.route("/bulk")
  .put(updateMultipleSettingsValidator, updateMultipleSettings);

router.route("/initialize")
  .post(initializeDefaultSettings);

router.route("/export")
  .get(exportSettings);

router.route("/import")
  .post(importSettingsValidator, importSettings);

router.route("/reset")
  .post(resetSettingsValidator, resetToDefaults);

router.route("/:key")
  .get(getSettingValidator, getSetting)
  .put(updateSettingValidator, updateSetting)
  .delete(deleteSetting);

module.exports = router;
