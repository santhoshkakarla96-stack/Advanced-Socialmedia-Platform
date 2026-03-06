const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';


  if (err.name === 'CastError') {
    message = 'Resource not found';
    statusCode = 404;
  }


  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    statusCode = 400;
  }


  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(val => val.message).join(', ');
    statusCode = 400;
  }


  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
    statusCode = 401;
  }


  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'File size exceeds the limit';
    statusCode = 400;
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      error: message,
      stack: err.stack,
      details: err,
    });
  }

  res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
module.exports.notFound = notFound;
