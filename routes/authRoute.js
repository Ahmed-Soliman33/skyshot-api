const express = require("express");
const {
  login,
  signup,
  refreshAccessToken,
  logout,
  getMe,
  protect,
  checkAccountActive,
  forgotPassword,
  verifyPassResetCode,
  resetPassword,
  editMe,
  deactivateMyAccount,
  googleAuth,
  googleCallback,
  verifyEmail,
  sendEmailVerification,
  uploadAvatar,
} = require("../controllers/authController");

const {
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyPassResetCodeValidator,
  resetPasswordValidator,
  verifyEmailValidator,
  getMeValidator,
} = require("../utils/validators/authValidator");

const {
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
  validatePasswordStrength,
} = require("../middlewares/securityMiddleware");

const router = express.Router();

const multer = require("multer");
const path = require("path");
const { handleMulterError } = require("../middlewares/uploadMiddleware");

// Configure multer for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatars/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `avatar-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        "Invalid file type. Only JPEG, PNG, and WebP are allowed",
        400,
        "invalid_file_type"
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Add the upload route

router.route("/login").post(loginLimiter, loginValidator, login);
router
  .route("/signup")
  .post(signupLimiter, validatePasswordStrength, signupValidator, signup);

// Google OAuth routes
router.route("/google").get(googleAuth);
router.route("/google/callback").get(googleCallback);

router.route("/refresh-token").get(refreshAccessToken);

// Reset Password Routes
router
  .route("/forgotPassword")
  .post(passwordResetLimiter, forgotPasswordValidator, forgotPassword);
router
  .route("/verifyResetCode")
  .post(
    passwordResetLimiter,
    verifyPassResetCodeValidator,
    verifyPassResetCode
  );
router
  .route("/resetPassword")
  .put(passwordResetLimiter, resetPasswordValidator, resetPassword);

// Email verification routes
router.route("/send-verification").post(protect, sendEmailVerification);
router.route("/verify-email").post(verifyEmailValidator, verifyEmail);

// Protected Routes for authenticated users
router.use(protect);

router.route("/logout").delete(logout);
router.route("/me").get(getMe);
router.route("/editMe").put(getMeValidator, editMe);
router.post(
  "/upload-avatar",
  upload.single("avatar"),
  handleMulterError,
  uploadAvatar
);

router
  .route("/deactivateMyAccount")
  .delete(checkAccountActive, deactivateMyAccount);

module.exports = router;
