// backend/middleware/errorHandler.js

/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

/**
 * Custom Application Error Class
 */
class AppError extends Error {
  constructor(message, statusCode, code = null, metadata = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.metadata = metadata;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error - For request validation failures
 */
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
  }
}

/**
 * Authentication Error
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Conflict Error
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * Handle Mongoose Validation Errors
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(error => ({
    field: error.path,
    message: error.message,
    value: error.value
  }));

  return new ValidationError('Validation failed', errors);
};

/**
 * Handle Mongoose Duplicate Key Errors
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  
  return new ConflictError(`${field} '${value}' already exists`);
};

/**
 * Handle Mongoose Cast Errors
 */
const handleCastError = (err) => {
  return new ValidationError(`Invalid ${err.path}: ${err.value}`);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => {
  return new AuthenticationError('Invalid token');
};

const handleJWTExpiredError = () => {
  return new AuthenticationError('Token expired');
};

// ============================================
// MAIN ERROR HANDLER MIDDLEWARE
// ============================================

/**
 * Global error handler middleware
 * Must be placed after all routes
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('❌ Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const code = error.code || 'SERVER_ERROR';

  // Build response
  const response = {
    success: false,
    code: code,
    message: error.message || 'Internal server error',
  };

  // Add metadata if available
  if (error.metadata && Object.keys(error.metadata).length > 0) {
    response.details = error.metadata;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// ============================================
// 404 NOT FOUND HANDLER
// ============================================

/**
 * Handle 404 Not Found errors
 * Must be placed before errorHandler middleware
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError('Route');
  error.metadata = {
    path: req.originalUrl,
    method: req.method
  };
  next(error);
};

// ============================================
// ASYNC ERROR WRAPPER
// ============================================

/**
 * Wrap async route handlers to catch errors
 * Eliminates need for try-catch in every route
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================
// EXPORTS
// ============================================

export {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  
  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler
};