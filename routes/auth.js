import express from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';

import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------
// Helper: Generate access & refresh tokens
// ---------------------------
const generateTokens = (user) => {
  // ✅ FIX: Changed "id" to "userId" to match middleware
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '30m' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  return { accessToken, refreshToken };
};

// ---------------------------
// Helper: Save refresh token
// ---------------------------
const saveRefreshToken = async (userId, token, ip) => {
  try {
    console.log('🔍 saveRefreshToken called with:', {
      userId,
      userIdType: typeof userId,
      isObjectId: userId instanceof mongoose.Types.ObjectId
    });

    if (!userId) {
      throw new Error('userId is required');
    }

    let userObjectId;
    
    if (userId instanceof mongoose.Types.ObjectId) {
      userObjectId = userId;
    } else if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } else {
      throw new Error(`Invalid userId format: ${userId} (type: ${typeof userId})`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenDoc = await RefreshToken.create({
      user_id: userObjectId,
      token,
      expires_at: expiresAt,
      created_by_ip: ip || 'unknown'
    });

    console.log('✅ Refresh token saved successfully');
    return refreshTokenDoc;
  } catch (error) {
    console.error('❌ Error in saveRefreshToken:', error);
    throw error;
  }
};

// ---------------------------
// REGISTER
// ---------------------------
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty(),
    body('role').isIn(['student', 'teacher']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const user = await User.create({ email, password, name, role });

      const { accessToken, refreshToken } = generateTokens(user);
      
      await saveRefreshToken(user._id, refreshToken, req.ip);

      res.status(201).json({
        message: 'Registration successful',
        user: { 
          _id: user._id.toString(),
          name: user.name, 
          email: user.email, 
          role: user.role 
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({ 
        message: 'Registration failed', 
        error: error.message 
      });
    }
  }
);

// ---------------------------
// LOGIN
// ---------------------------
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      user.last_login = new Date();
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user);
      await saveRefreshToken(user._id, refreshToken, req.ip);

      res.json({
        message: 'Login successful',
        user: { 
          _id: user._id, 
          name: user.name, 
          email: user.email, 
          role: user.role 
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      next(error);
    }
  }
);

// ---------------------------
// REFRESH TOKEN
// ---------------------------
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // ✅ FIX: Changed "id" to "userId"
    const userObjectId = typeof decoded.userId === 'string'
      ? new mongoose.Types.ObjectId(decoded.userId)
      : decoded.userId;

    const tokenDoc = await RefreshToken.findOne({
      token: refreshToken,
      user_id: userObjectId
    });

    if (!tokenDoc) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    // ✅ FIX: Changed "id" to "userId"
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '30m' }
    );

    res.json({ accessToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ message: 'Refresh token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }
    next(error);
  }
});

// ---------------------------
// LOGOUT
// ---------------------------
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
});

// ---------------------------
// OAUTH (Google & GitHub)
// ---------------------------
const createOAuthTokens = async (user, ip) => {
  const { accessToken, refreshToken } = generateTokens(user);
  await saveRefreshToken(user._id, refreshToken, ip);
  return { accessToken, refreshToken };
};

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = await createOAuthTokens(req.user, req.ip);
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
      );
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      next(error);
    }
  }
);

router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = await createOAuthTokens(req.user, req.ip);
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
      );
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      next(error);
    }
  }
);

// ---------------------------
// GET CURRENT USER
// ---------------------------
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    // req.user is already populated by authenticateToken middleware
    res.json(req.user);
  } catch (error) {
    console.error('Get current user error:', error);
    next(error);
  }
});

// ---------------------------
// FORGOT PASSWORD
// ---------------------------
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.json({ message: 'If that email exists, a password reset link has been sent.' });
      }

      // TODO: Implement password reset token generation and email sending
      res.json({ message: 'If that email exists, a password reset link has been sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      next(error);
    }
  }
);

// ---------------------------
// CHANGE PASSWORD
// ---------------------------
router.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      
      // ✅ FIX: req.user is now the full user object from middleware
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      user.password = newPassword;
      await user.save();

      await RefreshToken.deleteMany({ user_id: user._id });

      res.json({ message: 'Password changed successfully. Please login again.' });
    } catch (error) {
      console.error('Change password error:', error);
      next(error);
    }
  }
);

export default router;