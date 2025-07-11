const express = require('express');
const router = express.Router();
const letterheadController = require('../controllers/letterheadController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// All routes require authentication and admin permissions
router.use(authMiddleware);

// Middleware to check admin permissions
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin' && !req.user.permissions?.manageUsers) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

// Upload new letterhead
router.post('/upload', adminOnly, letterheadController.uploadLetterhead);

// Get active letterhead
router.get('/active', letterheadController.getActiveLetterhead);

// Get all letterheads
router.get('/', adminOnly, letterheadController.getAllLetterheads);

// Set active letterhead
router.put('/:id/activate', adminOnly, letterheadController.setActiveLetterhead);

// Delete letterhead
router.delete('/:id', adminOnly, letterheadController.deleteLetterhead);

// Download letterhead
router.get('/download/:id', letterheadController.downloadLetterhead);

module.exports = router;