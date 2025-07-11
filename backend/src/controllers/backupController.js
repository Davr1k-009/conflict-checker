const backupService = require('../services/backupService');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { logActivity } = require('./activityLogController');

// Configure multer for backup uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(__dirname, '../../temp');
    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `restore_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  }
});

// Create manual backup
const createBackup = async (req, res) => {
  try {
    global.logger.info('Manual backup requested', { userId: req.user.id });
    
    const backup = await backupService.createFullBackup();
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'backup.create',
      entityType: 'backup',
      entityId: null,
      entityName: backup.filename,
      details: {
        filename: backup.filename,
        size: backup.size,
        type: 'manual'
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      backup: {
        filename: backup.filename,
        size: backup.size,
        createdAt: backup.createdAt
      }
    });
  } catch (error) {
    global.logger.error('Create backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
};

// List all backups
const listBackups = async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    
    // Format file sizes
    const formattedBackups = backups.map(backup => ({
      ...backup,
      sizeFormatted: formatFileSize(backup.size)
    }));
    
    res.json(formattedBackups);
  } catch (error) {
    global.logger.error('List backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
};

// Download backup
const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename.match(/^backup_[\d\-T]+(_weekly)?\.zip$/)) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    const backupPath = path.join(__dirname, '../../backups', filename);
    
    // Check if file exists
    try {
      await fs.access(backupPath);
    } catch {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'backup.download',
      entityType: 'backup',
      entityId: null,
      entityName: filename,
      details: { filename },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.download(backupPath, filename);
  } catch (error) {
    global.logger.error('Download backup error:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
};

// Delete backup
const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename.match(/^backup_[\d\-T]+(_weekly)?\.zip$/)) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    const backupPath = path.join(__dirname, '../../backups', filename);
    
    // Delete file
    await fs.unlink(backupPath);
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'backup.delete',
      entityType: 'backup',
      entityId: null,
      entityName: filename,
      details: { filename },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    global.logger.info('Backup deleted', { filename, userId: req.user.id });
    
    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    global.logger.error('Delete backup error:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
};

// Restore from backup
const restoreBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    
    global.logger.info('Restore backup requested', { 
      userId: req.user.id,
      filename: req.file.originalname 
    });
    
    const result = await backupService.restoreFromBackup(req.file.path);
    
    // Delete uploaded file
    await fs.unlink(req.file.path);
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'backup.restore',
      entityType: 'backup',
      entityId: null,
      entityName: req.file.originalname,
      details: {
        filename: req.file.originalname,
        backupInfo: result.info
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Backup restored successfully',
      info: result.info
    });
  } catch (error) {
    global.logger.error('Restore backup error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        global.logger.warn('Failed to cleanup uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'Failed to restore backup' });
  }
};

// Get backup status
const getBackupStatus = async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    
    const status = {
      totalBackups: backups.length,
      lastBackup: backups[0] || null,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      autoBackupEnabled: true, // Always enabled when service is running
      nextScheduledBackup: getNextScheduledBackup()
    };
    
    res.json(status);
  } catch (error) {
    global.logger.error('Get backup status error:', error);
    res.status(500).json({ error: 'Failed to get backup status' });
  }
};

// Helper: Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper: Get next scheduled backup time
function getNextScheduledBackup() {
  const now = new Date();
  const next = new Date(now);
  
  // Next 2 AM
  next.setHours(2, 0, 0, 0);
  
  // If it's already past 2 AM today, set to tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString();
}

module.exports = {
  createBackup,
  listBackups,
  downloadBackup,
  deleteBackup,
  restoreBackup: [upload.single('backup'), restoreBackup],
  getBackupStatus
};