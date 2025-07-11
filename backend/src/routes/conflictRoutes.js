const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const conflictController = require('../controllers/conflictController');
const { authMiddleware } = require('../middlewares/authMiddleware');

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

// Run conflict check for a specific case
router.post('/check/:caseId', conflictController.runConflictCheck);

// Search for conflicts with custom parameters
router.post('/search', [
  body('clientName').optional().isString(),
  body('clientInn').optional().isString(),
  body('opponentName').optional().isString(),
  body('opponentInn').optional().isString(),
  validate
], conflictController.searchConflicts);

// Generate PDF report for conflict check
router.get('/report/:reportId', conflictController.generateConflictReport);

// Get conflict history for a case
router.get('/history/:caseId', conflictController.getConflictHistory);

// Get all high-level conflicts
router.get('/high-risk', conflictController.getHighRiskConflicts);

// Get conflict statistics
router.get('/stats', conflictController.getConflictStats);

module.exports = router;