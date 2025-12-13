// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authenticate user using JWT token
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access token required', code: 'TOKEN_MISSING' });

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) return res.status(401).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    if (!user.is_active) return res.status(403).json({ message: 'Account is deactivated', code: 'ACCOUNT_DEACTIVATED' });

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED', expiredAt: error.expiredAt });

    console.error('❌ Authentication error:', error);
    return res.status(500).json({ message: 'Authentication failed', code: 'AUTH_ERROR' });
  }
};

/**
 * Role-based access
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required', code: 'NOT_AUTHENTICATED' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' or ')}`, code: 'INSUFFICIENT_PERMISSIONS', userRole: req.user.role, requiredRoles: roles });
  next();
};

/**
 * Optional auth
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (user && user.is_active) req.user = user;

    next();
  } catch {
    next();
  }
};

/**
 * Require verified email
 */
export const requireVerified = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required', code: 'NOT_AUTHENTICATED' });
  if (!req.user.is_verified) return res.status(403).json({ message: 'Email verification required', code: 'EMAIL_NOT_VERIFIED', email: req.user.email });
  next();
};

/**
 * Require ownership
 */
export const requireOwnership = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required', code: 'NOT_AUTHENTICATED' });
  const resourceUserId = req.params.userId || req.body.userId;
  if (!resourceUserId) return res.status(400).json({ message: 'User ID not provided', code: 'USERID_MISSING' });
  if (req.user._id.toString() !== resourceUserId.toString()) return res.status(403).json({ message: 'Access denied. You can only access your own resources', code: 'NOT_OWNER' });
  next();
};

/**
 * Attach userId for rate limiting
 */
export const attachUserIdForRateLimit = (req, res, next) => {
  req.userId = req.user ? req.user._id.toString() : req.ip;
  next();
};

/**
 * Token helpers
 */
export const generateAccessToken = (user) => jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRY || '30m' });

export const generateRefreshToken = (user) => jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' });

export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);
