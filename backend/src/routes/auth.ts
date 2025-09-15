import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  adminOnlyRegistration,
  checkAccountLockout,
  registrationRateLimit,
  requireAdmin
} from '../middleware/security';
const { body } = require('express-validator');
import { logger } from '../utils/logger';

const router = express.Router();

// Register new user
router.post('/register',
  registrationRateLimit,
  adminOnlyRegistration,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user
      const user = new User({
        email,
        passwordHash: password, // Will be hashed by pre-save middleware
        subscriptionStatus: 'free'
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus,
            createdAt: user.createdAt
          },
          token,
          refreshToken
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      return res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  }
);

// Login user
router.post('/login',
  checkAccountLockout,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').exists().withMessage('Password is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check password
      const isValidPassword = await user!.comparePassword(password);
      if (!isValidPassword) {
        // Increment login attempts
        await user!.incrementLoginAttempts();

        const attemptsLeft = Math.max(0, 5 - user!.loginAttempts);
        res.status(401).json({
          success: false,
          message: `Invalid email or password. ${attemptsLeft} attempts remaining.`,
          attemptsLeft
        });
      }

      // Reset login attempts and update last login
      await user!.resetLoginAttempts();
      user!.lastLoginAt = new Date();
      await user!.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user!._id, email: user!.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: user!._id },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' }
      );

      logger.info('User logged in successfully', {
        userId: user!._id,
        email: user!.email,
        role: user!.role
      });

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user!._id,
            email: user!.email,
            role: user!.role,
            subscriptionStatus: user!.subscriptionStatus,
            createdAt: user!.createdAt,
            lastLoginAt: user!.lastLoginAt
          },
          token,
          refreshToken
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }
);

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user!._id,
          email: user!.email,
          subscriptionStatus: user!.subscriptionStatus,
          createdAt: user!.createdAt,
          updatedAt: user!.updatedAt
        }
      }
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Refresh access token
router.post('/refresh',
  [
    body('refreshToken').exists().withMessage('Refresh token is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

      // Find user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new access token
      const newToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: {
          token: newToken
        }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  }
);

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;