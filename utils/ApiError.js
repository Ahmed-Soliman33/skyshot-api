class ApiError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errorCode = errorCode;
  }
}

module.exports = ApiError;
