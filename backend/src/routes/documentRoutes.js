const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const { authMiddleware, hasPermission } = require('../middlewares/authMiddleware');
const { logActivity } = require('../controllers/activityLogController');

// Helper function to check if user can see all cases
const canSeeAllCases = (user) => {
  return user.role === 'admin' || user.permissions?.manageUsers === true;
};

// Helper function to check case access
const checkCaseAccess = async (caseId, userId, userCanSeeAll) => {
  const [cases] = await db.execute(
    'SELECT created_by FROM cases WHERE id = ?',
    [caseId]
  );
  
  if (cases.length === 0) {
    return { hasAccess: false, error: 'Case not found' };
  }
  
  if (!userCanSeeAll && cases[0].created_by !== userId) {
    return { hasAccess: false, error: 'Access denied' };
  }
  
  return { hasAccess: true };
};

// Helper function to create safe folder name from case info
const createSafeFolderName = (caseNumber, caseId, clientName) => {
  // Prioritize client name over case number for folder naming
  let folderName = clientName || caseNumber || `case_${caseId}`;
  
  // If using case number, prepend it to client name
  if (caseNumber && clientName) {
    folderName = `${clientName}_${caseNumber}`;
  }
  
  // Remove or replace unsafe characters
  folderName = folderName
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace unsafe chars with underscore
    .replace(/\s+/g, '_')           // Replace spaces with underscore
    .replace(/\.+/g, '_')           // Replace dots with underscore
    .trim()
    .substring(0, 100);             // Limit length
    
  return folderName;
};

// Configure multer for file uploads with UTF-8 support and organized folders
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const caseId = req.params.caseId;
      
      // Get case information
      const [cases] = await db.execute(
        'SELECT id, case_number, client_name, created_by FROM cases WHERE id = ?',
        [caseId]
      );
      
      if (cases.length === 0) {
        return cb(new Error('Case not found'), null);
      }
      
      const caseData = cases[0];
      
      // Check access
      const userCanSeeAll = canSeeAllCases(req.user);
      if (!userCanSeeAll && caseData.created_by !== req.user.id) {
        return cb(new Error('Access denied'), null);
      }
      
      const folderName = createSafeFolderName(caseData.case_number, caseData.id, caseData.client_name);
      const uploadDir = path.join('./uploads', folderName);
      
      // Create directory if it doesn't exist
      await fs.mkdir(uploadDir, { recursive: true });
      
      // Store folder path in request for later use
      req.caseFolderPath = uploadDir;
      req.caseFolderName = folderName;
      req.caseData = caseData; // Store case data for logging
      
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Decode the filename to handle UTF-8 characters properly
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    // Create a safe filename while preserving the original for database
    const safeFileName = `${uniqueSuffix}${ext}`;
    
    // Store the original filename in the request for later use
    req.originalFileName = originalName;
    req.safeFileName = safeFileName;
    
    cb(null, safeFileName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const extname = allowedTypes.test(path.extname(originalName).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX are allowed.'));
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// Upload document
router.post('/upload/:caseId', hasPermission('create'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const caseId = req.params.caseId;
    const { filename, path: filePath, size, mimetype } = req.file;
    // Use the original filename stored in the request
    const originalname = req.originalFileName || req.file.originalname;
    
    // Store relative path for easier management
    const relativePath = path.join('uploads', req.caseFolderName, filename);

    // Save document info to database with proper UTF-8 encoded name
    const [result] = await db.execute(
      `INSERT INTO documents (case_id, filename, original_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [caseId, filename, originalname, relativePath, size, mimetype, req.user.id]
    );

    global.logger.info('Document uploaded', {
      documentId: result.insertId,
      caseId,
      folder: req.caseFolderName,
      uploadedBy: req.user.id
    });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'document.upload',
      entityType: 'document',
      entityId: result.insertId,
      entityName: originalname,
      details: {
        caseId: caseId,
        caseName: req.caseData?.client_name,
        fileName: originalname,
        fileSize: size,
        mimeType: mimetype
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      id: result.insertId,
      filename: originalname,
      size,
      uploadedAt: new Date(),
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    global.logger.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get documents by case
router.get('/case/:caseId', async (req, res) => {
  try {
    const caseId = req.params.caseId;
    
    // Check case access
    const userCanSeeAll = canSeeAllCases(req.user);
    const accessCheck = await checkCaseAccess(caseId, req.user.id, userCanSeeAll);
    
    if (!accessCheck.hasAccess) {
      return res.status(accessCheck.error === 'Case not found' ? 404 : 403)
        .json({ error: accessCheck.error });
    }

    const [documents] = await db.execute(
      `SELECT 
        d.*,
        u.full_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.case_id = ?
       ORDER BY d.uploaded_at DESC`,
      [caseId]
    );

    res.json(documents);
  } catch (error) {
    global.logger.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Preview document
router.get('/preview/:documentId', async (req, res) => {
  try {
    const documentId = req.params.documentId;

    const [documents] = await db.execute(
      'SELECT d.*, c.created_by FROM documents d JOIN cases c ON d.case_id = c.id WHERE d.id = ?',
      [documentId]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];
    
    // Check case access
    const userCanSeeAll = canSeeAllCases(req.user);
    if (!userCanSeeAll && document.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.resolve(document.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers for preview
    const mimeType = document.mime_type;
    res.setHeader('Content-Type', mimeType);
    
    // For PDFs and images, display inline instead of downloading
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.original_name)}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.original_name)}"`);
    }

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    global.logger.error('Document preview error:', error);
    res.status(500).json({ error: 'Failed to preview document' });
  }
});

// Download document
router.get('/download/:documentId', async (req, res) => {
  try {
    const documentId = req.params.documentId;

    const [documents] = await db.execute(
      'SELECT d.*, c.client_name, c.created_by FROM documents d JOIN cases c ON d.case_id = c.id WHERE d.id = ?',
      [documentId]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];
    
    // Check case access
    const userCanSeeAll = canSeeAllCases(req.user);
    if (!userCanSeeAll && document.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.resolve(document.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'document.download',
      entityType: 'document',
      entityId: documentId,
      entityName: document.original_name,
      details: {
        caseId: document.case_id,
        caseName: document.client_name,
        fileName: document.original_name,
        fileSize: document.file_size
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Set proper headers for UTF-8 filename
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.original_name)}"`);
    
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    global.logger.error('Document download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Delete document
router.delete('/:documentId', hasPermission('delete'), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const documentId = req.params.documentId;

    // Get document info
    const [documents] = await connection.execute(
      'SELECT d.*, c.client_name, c.created_by FROM documents d JOIN cases c ON d.case_id = c.id WHERE d.id = ?',
      [documentId]
    );

    if (documents.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];
    
    // Check case access
    const userCanSeeAll = canSeeAllCases(req.user);
    if (!userCanSeeAll && document.created_by !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete from database
    await connection.execute('DELETE FROM documents WHERE id = ?', [documentId]);

    // Delete file from filesystem
    try {
      await fs.unlink(document.file_path);
      
      // Check if the folder is empty and delete it
      const folderPath = path.dirname(document.file_path);
      const files = await fs.readdir(folderPath);
      if (files.length === 0) {
        await fs.rmdir(folderPath);
        global.logger.info('Empty folder deleted', { folderPath });
      }
    } catch (error) {
      global.logger.warn('Failed to delete file from filesystem:', error);
    }

    await connection.commit();

    global.logger.info('Document deleted', {
      documentId,
      deletedBy: req.user.id
    });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'document.delete',
      entityType: 'document',
      entityId: documentId,
      entityName: document.original_name,
      details: {
        caseId: document.case_id,
        caseName: document.client_name,
        fileName: document.original_name,
        fileSize: document.file_size
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Document delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  } finally {
    connection.release();
  }
});

module.exports = router;