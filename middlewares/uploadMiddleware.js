const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Handle multer errors
exports.handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(
        new ApiError(
          "File size too large. Maximum 5MB allowed",
          400,
          "file_too_large"
        )
      );
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new ApiError("Unexpected file field", 400, "unexpected_file")
      );
    }
  }
  next(error);
};
