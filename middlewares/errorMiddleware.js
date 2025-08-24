const ApiError = require("../utils/ApiError");

// send error response based on environment
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack, // stack trace for debugging purposes
  });
};

// send error response for production
const sendErrorProd = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (err.name === "JsonWebTokenError")
    err = new ApiError("Invalid token, please log in again", 401);
  if (err.name === "TokenExpiredError")
    err = new ApiError("Token expired, please log in again", 401);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(err, res);
  }
};

module.exports = globalErrorHandler;
