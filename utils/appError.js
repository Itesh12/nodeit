class AppError extends Error {
  statusCode;
  status;
  isOperational;

  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // This flag indicates that the error can be handled operationally

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
