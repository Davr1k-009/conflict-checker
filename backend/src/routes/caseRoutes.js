const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const caseController = require('../controllers/caseController');
const { authMiddleware, hasPermission } = require('../middlewares/authMiddleware');

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

// Get all cases
router.get('/', caseController.getAllCases);

// Get case by ID
router.get('/:id', caseController.getCaseById);

// Create new case (requires create permission)
router.post('/', hasPermission('create'), [
  body('clientName').notEmpty().withMessage('Client name is required'),
  body('caseType').optional().isIn(['litigation', 'contract', 'consultation', 'other']),
  body('lawyersAssigned').optional().isArray().withMessage('Lawyers assigned must be an array'),
  body('lawyersAssigned.*').optional().isInt().withMessage('Each lawyer ID must be an integer'),
  validate
], caseController.createCase);

// Update case (requires edit permission)
router.put('/:id', hasPermission('edit'), [
  body('lawyersAssigned').optional().isArray().withMessage('Lawyers assigned must be an array'),
  body('lawyersAssigned.*').optional().isInt().withMessage('Each lawyer ID must be an integer'),
  validate
], caseController.updateCase);

// Delete case (requires delete permission)
router.delete('/:id', hasPermission('delete'), caseController.deleteCase);

// Get lawyers assigned to a case
router.get('/:id/lawyers', caseController.getCaseLawyers);

// Assign lawyer to a case (requires edit permission)
router.post('/:id/lawyers', hasPermission('edit'), [
  body('lawyerId').notEmpty().isInt().withMessage('Valid lawyer ID is required'),
  validate
], caseController.assignLawyer);

// Remove lawyer from a case (requires edit permission)
router.delete('/:id/lawyers/:lawyerId', hasPermission('edit'), caseController.removeLawyer);

module.exports = router;