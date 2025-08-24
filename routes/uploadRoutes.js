const express = require("express");
const {
  getUploads,
  getFilteredUploads,
  getUploadById,
  createUpload,
  updateUpload,
  deleteUpload,
  approveUpload,
  rejectUpload,
  getPendingUploads,
  searchUploads,
  getUploadStats,
  toggleFeatured,
  bulkUploadOperations,
} = require("../controllers/uploadController");

const {
  createUploadValidator,
  updateUploadValidator,
  getUploadValidator,
  deleteUploadValidator,
  approveUploadValidator,
  rejectUploadValidator,
  getUploadsValidator,
  searchUploadsValidator,
  bulkUploadValidator,
} = require("../utils/validators/uploadValidator");

const { protect, allowedTo } = require("../controllers/authController");

const router = express.Router();

// Public routes
router.get("/search", searchUploadsValidator, searchUploads);
router.get("/filter", getUploadsValidator, getFilteredUploads);
router.get("/:id", getUploadValidator, getUploadById);

// Protected routes - require authentication
router.use(protect);

// User routes
router.post("/", createUploadValidator, createUpload);

// Routes that require ownership verification or admin privileges
router.put("/:id", updateUploadValidator, updateUpload);

router.delete("/:id", deleteUploadValidator, deleteUpload);

// Admin and Master only routes
router.use(allowedTo("admin", "master"));

router.get("/", getUploadsValidator, getUploads);
router.get("/pending/review", getPendingUploads);
router.get("/stats/overview", getUploadStats);

router.patch("/:id/approve", approveUploadValidator, approveUpload);
router.patch("/:id/reject", rejectUploadValidator, rejectUpload);
router.patch("/:id/featured", getUploadValidator, toggleFeatured);

router.post("/bulk", bulkUploadValidator, bulkUploadOperations);

module.exports = router;
