import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
    statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(e => e.message).join(', ');
    statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }

  if (err.name === 'CastError') { statusCode = 400; message = 'Invalid resource ID'; }
  if (err.type === 'entity.parse.failed') { statusCode = 400; message = 'Invalid JSON request body'; }
  if (err.type === 'entity.too.large') { statusCode = 413; message = 'Request body is too large'; }
  if (process.env.NODE_ENV === 'production' && statusCode >= 500 && !err.statusCode) message = 'Internal Server Error';
  logger.error(`${statusCode} - ${message} - ${req.path}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
