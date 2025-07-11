const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const userController = require('../controllers/userController');
const { authMiddleware, isAdmin, canManageUsers } = require('../middlewares/authMiddleware');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// All routes require authentication
router.use(authMiddleware);

// Get all users (users with manage permission)
router.get('/', canManageUsers, userController.getAllUsers);

// Update current user's profile (admin only)
router.put('/profile', [
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  validate
], userController.updateProfile);

// Create new user (users with manage permission)
router.post('/', canManageUsers, [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'user', 'viewer']).withMessage('Invalid role'),
  validate
], userController.createUser);

// Update user (users with manage permission)
router.put('/:id', canManageUsers, [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'user', 'viewer']).withMessage('Invalid role'),
  validate
], userController.updateUser);

// Delete user (users with manage permission)
router.delete('/:id', canManageUsers, userController.deleteUser);

// Reset user password (users with manage permission)
router.post('/:id/reset-password', canManageUsers, [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
], userController.resetPassword);

// Get user activity (available to all authenticated users)
router.get('/:id/activity', userController.getUserActivity);

module.exports = router;