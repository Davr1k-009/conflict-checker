const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');

// All backup routes require authentication and admin privileges
router.use(authMiddleware);
router.use(isAdmin);

// Get backup status
router.get('/status', backupController.getBackupStatus);

// List all backups
router.get('/', backupController.listBackups);

// Create new backup
router.post('/create', backupController.createBackup);

// Download backup
router.get('/download/:filename', backupController.downloadBackup);

// Delete backup
router.delete('/:filename', backupController.deleteBackup);

// Restore from backup (with file upload)
router.post('/restore', backupController.restoreBackup);

module.exports = router;