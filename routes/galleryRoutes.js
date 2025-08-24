const express = require("express");
const {
  getGallery,
  getFeaturedUploads,
  getPopularUploads,
  searchUploads,
  getUploadDetails,
  getUploadsByCategory,
  getUploadsByUser,
  toggleLike,
  getGalleryStats,
} = require("../controllers/galleryController");
const {
  getUploadDetailsValidator,
  getCategoryValidator,
  getUserUploadsValidator,
  toggleLikeValidator,
} = require("../utils/validators/galleryValidator");
const { protect, optionalAuth } = require("../controllers/authController");

const router = express.Router();

// Public routes (no authentication required)
router.route("/")
  .get(getGallery);

router.route("/featured")
  .get(getFeaturedUploads);

router.route("/popular")
  .get(getPopularUploads);

router.route("/search")
  .get(searchUploads);

router.route("/stats")
  .get(getGalleryStats);

router.route("/category/:category")
  .get(getCategoryValidator, getUploadsByCategory);

router.route("/user/:userId")
  .get(getUserUploadsValidator, getUploadsByUser);

router.route("/:id")
  .get(getUploadDetailsValidator, getUploadDetails);

// Protected routes (authentication required)
router.route("/:id/like")
  .post(protect, toggleLikeValidator, toggleLike);

module.exports = router;
