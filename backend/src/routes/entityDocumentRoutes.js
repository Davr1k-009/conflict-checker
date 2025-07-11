const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const { authMiddleware, hasPermission } = require('../middlewares/authMiddleware');

// Check if entity_documents table exists and create if not
const ensureEntityDocumentsTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entity_documents (
        id int NOT NULL AUTO_INCREMENT,
        case_id int NOT NULL,
        entity_type enum('related_companies','founders','directors','beneficiaries') NOT NULL,
        entity_index int NOT NULL COMMENT 'Index of entity in JSON array',
        entity_name varchar(255) NOT NULL,
        entity_inn varchar(20) DEFAULT NULL COMMENT 'INN for companies and founders',
        entity_pinfl varchar(14) DEFAULT NULL COMMENT 'PINFL for directors',
        filename varchar(255) NOT NULL,
        original_name varchar(255) NOT NULL,
        file_path varchar(500) NOT NULL,
        file_size int DEFAULT NULL,
        mime_type varchar(100) DEFAULT NULL,
        uploaded_by int NOT NULL,
        uploaded_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY case_id (case_id),
        KEY uploaded_by (uploaded_by),
        KEY idx_entity_lookup (case_id, entity_type, entity_index),
        CONSTRAINT entity_documents_ibfk_1 FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE,
        CONSTRAINT entity_documents_ibfk_2 FOREIGN KEY (uploaded_by) REFERENCES users (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    global.logger.info('Entity documents table ready');
  } catch (error) {
    // Table might already exist
    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
      global.logger.error('Failed to ensure entity_documents table:', error.message);
    }
  }
};

// Call it when the module loads
ensureEntityDocumentsTable();

// Helper function to create safe folder name
const createSafeFolderName = (caseNumber, caseId, clientName) => {
  let folderName = clientName || caseNumber || `case_${caseId}`;
  
  if (caseNumber && clientName) {
    folderName = `${clientName}_${caseNumber}`;
  }
  
  folderName = folderName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+/g, '_')
    .trim()
    .substring(0, 100);
    
  return folderName;
};

// Configure multer for entity file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const caseId = req.params.caseId;
      
      // Get case information
      const [cases] = await db.execute(
        'SELECT id, case_number, client_name FROM cases WHERE id = ?',
        [caseId]
      );
      
      if (cases.length === 0) {
        return cb(new Error('Case not found'), null);
      }
      
      const caseData = cases[0];
      const folderName = createSafeFolderName(caseData.case_number, caseData.id, caseData.client_name);
      
      // Create a temporary subfolder - will be moved to correct entity type folder later
      const uploadDir = path.join('./uploads', folderName, 'entities', 'temp');
      
      // Create directory if it doesn't exist
      await fs.mkdir(uploadDir, { recursive: true });
      
      req.caseFolderPath = uploadDir;
      req.caseFolderName = folderName;
      req.caseData = caseData;
      
      global.logger.info('Entity document temp upload directory:', { uploadDir });
      
      cb(null, uploadDir);
    } catch (error) {
      global.logger.error('Error in multer destination:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const safeFileName = `${uniqueSuffix}${ext}`;
    
    req.originalFileName = originalName;
    req.safeFileName = safeFileName;
    
    cb(null, safeFileName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for entity files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const extname = allowedTypes.test(path.extname(originalName).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, DOC, DOCX are allowed.'));
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// Upload entity document
router.post('/upload/:caseId', hasPermission('create'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const caseId = req.params.caseId;
    const { entityType, entityIndex, entityName, entityInn, entityPinfl } = req.body;
    
    if (!entityType || entityIndex === undefined || !entityName) {
      // Delete uploaded file if validation fails
      try {
        await fs.unlink(path.join(req.file.destination, req.file.filename));
      } catch (e) {}
      return res.status(400).json({ error: 'Missing required fields: entityType, entityIndex, or entityName' });
    }
    
    const { filename, size, mimetype, destination } = req.file;
    const originalname = req.originalFileName || req.file.originalname;
    
    // Move file from temp to correct entity type folder
    const tempFilePath = path.join(destination, filename);
    const finalDir = path.join('./uploads', req.caseFolderName, 'entities', entityType);
    const finalFilePath = path.join(finalDir, filename);
    
    try {
      // Create final directory if it doesn't exist
      await fs.mkdir(finalDir, { recursive: true });
      
      // Move file from temp to final location
      await fs.rename(tempFilePath, finalFilePath);
      
      // Try to remove temp directory if empty
      try {
        await fs.rmdir(destination);
      } catch (e) {
        // Ignore if not empty
      }
    } catch (moveError) {
      global.logger.error('Failed to move file to final location:', moveError);
      // Try to clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}
      throw moveError;
    }
    
    // Store relative path for easier management
    const relativePath = path.join('uploads', req.caseFolderName, 'entities', entityType, filename);

    // Save entity document info to database
    const [result] = await db.execute(
      `INSERT INTO entity_documents 
       (case_id, entity_type, entity_index, entity_name, entity_inn, entity_pinfl, filename, original_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [caseId, entityType, entityIndex, entityName, entityInn || null, entityPinfl || null, filename, originalname, relativePath, size, mimetype, req.user.id]
    );

    global.logger.info('Entity document uploaded', {
      documentId: result.insertId,
      caseId,
      entityType,
      uploadedBy: req.user.id
    });

    res.status(201).json({
      id: result.insertId,
      filename: originalname,
      entityType,
      entityIndex,
      size,
      uploadedAt: new Date(),
      message: 'Entity document uploaded successfully'
    });
  } catch (error) {
    global.logger.error('Entity document upload error:', error);
    
    // Delete uploaded file if database insert failed
    if (req.file) {
      try {
        const uploadedFilePath = path.join(req.file.destination, req.file.filename);
        await fs.unlink(uploadedFilePath);
        global.logger.info('Cleaned up uploaded file after error');
      } catch (unlinkError) {
        global.logger.error('Failed to delete uploaded file after error:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to upload entity document',
      details: error.message 
    });
  }
});

// Get entity documents by case
router.get('/case/:caseId', async (req, res) => {
  try {
    const caseId = req.params.caseId;

    const [documents] = await db.execute(
      `SELECT 
        ed.*,
        u.full_name as uploaded_by_name
       FROM entity_documents ed
       LEFT JOIN users u ON ed.uploaded_by = u.id
       WHERE ed.case_id = ?
       ORDER BY ed.entity_type, ed.entity_index, ed.uploaded_at DESC`,
      [caseId]
    );

    // Group documents by entity type and index
    const groupedDocuments = documents.reduce((acc, doc) => {
      const key = `${doc.entity_type}_${doc.entity_index}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(doc);
      return acc;
    }, {});

    res.json(groupedDocuments);
  } catch (error) {
    global.logger.error('Get entity documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve entity documents' });
  }
});

// Download entity document
router.get('/download/:documentId', async (req, res) => {
  try {
    const documentId = req.params.documentId;

    const [documents] = await db.execute(
      'SELECT * FROM entity_documents WHERE id = ?',
      [documentId]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];
    const filePath = path.resolve(document.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set proper headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.original_name)}"`);
    
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    global.logger.error('Entity document download error:', error);
    res.status(500).json({ error: 'Failed to download entity document' });
  }
});

// Delete entity document
router.delete('/:documentId', hasPermission('delete'), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const documentId = req.params.documentId;

    // Get document info
    const [documents] = await connection.execute(
      'SELECT * FROM entity_documents WHERE id = ?',
      [documentId]
    );

    if (documents.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    // Delete from database
    await connection.execute('DELETE FROM entity_documents WHERE id = ?', [documentId]);

    // Delete file from filesystem
    try {
      const filePath = path.resolve(document.file_path);
      await fs.unlink(filePath);
      
      // Check if the folder is empty and delete it
      const folderPath = path.dirname(filePath);
      const files = await fs.readdir(folderPath);
      if (files.length === 0) {
        await fs.rmdir(folderPath);
      }
    } catch (error) {
      global.logger.warn('Failed to delete entity file from filesystem:', error);
    }

    await connection.commit();

    global.logger.info('Entity document deleted', {
      documentId,
      deletedBy: req.user.id
    });

    res.json({ message: 'Entity document deleted successfully' });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Entity document delete error:', error);
    res.status(500).json({ error: 'Failed to delete entity document' });
  } finally {
    connection.release();
  }
});

module.exports = router;