const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

// Configure multer for letterhead uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/letterheads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `letterhead-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG and GIF are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
}).single('letterhead');

// Upload letterhead
const uploadLetterhead = async (req, res) => {
  upload(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Deactivate all existing letterheads
      await connection.execute(
        'UPDATE letterheads SET is_active = FALSE WHERE is_active = TRUE'
      );

      // Insert new letterhead
      const [result] = await connection.execute(
        `INSERT INTO letterheads (name, filename, file_path, mime_type, file_size, is_active, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
        [
          req.body.name || 'Company Letterhead',
          req.file.filename,
          `uploads/letterheads/${req.file.filename}`,
          req.file.mimetype,
          req.file.size,
          req.user.id
        ]
      );

      await connection.commit();

      global.logger.info('Letterhead uploaded', { 
        id: result.insertId,
        filename: req.file.filename,
        uploadedBy: req.user.id 
      });

      res.json({
        id: result.insertId,
        message: 'Letterhead uploaded successfully'
      });
    } catch (error) {
      await connection.rollback();
      
      // Delete uploaded file on error
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        global.logger.error('Failed to delete file after error:', unlinkError);
      }

      global.logger.error('Upload letterhead error:', error);
      res.status(500).json({ error: 'Server error' });
    } finally {
      connection.release();
    }
  });
};

// Get active letterhead
const getActiveLetterhead = async (req, res) => {
  try {
    const [letterheads] = await db.execute(
      `SELECT l.*, u.full_name as uploaded_by_name 
       FROM letterheads l
       LEFT JOIN users u ON l.uploaded_by = u.id
       WHERE l.is_active = TRUE
       LIMIT 1`
    );

    if (letterheads.length === 0) {
      return res.json({ letterhead: null });
    }

    res.json({ letterhead: letterheads[0] });
  } catch (error) {
    global.logger.error('Get active letterhead error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all letterheads
const getAllLetterheads = async (req, res) => {
  try {
    const [letterheads] = await db.execute(
      `SELECT l.*, u.full_name as uploaded_by_name 
       FROM letterheads l
       LEFT JOIN users u ON l.uploaded_by = u.id
       ORDER BY l.uploaded_at DESC`
    );

    res.json(letterheads);
  } catch (error) {
    global.logger.error('Get all letterheads error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Set active letterhead
const setActiveLetterhead = async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // Check if letterhead exists
    const [letterheads] = await connection.execute(
      'SELECT * FROM letterheads WHERE id = ?',
      [id]
    );

    if (letterheads.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Letterhead not found' });
    }

    // Deactivate all letterheads
    await connection.execute(
      'UPDATE letterheads SET is_active = FALSE'
    );

    // Activate selected letterhead
    await connection.execute(
      'UPDATE letterheads SET is_active = TRUE WHERE id = ?',
      [id]
    );

    await connection.commit();

    global.logger.info('Letterhead activated', { 
      id: id,
      activatedBy: req.user.id 
    });

    res.json({ message: 'Letterhead activated successfully' });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Set active letterhead error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

// Delete letterhead
const deleteLetterhead = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get letterhead info
    const [letterheads] = await db.execute(
      'SELECT * FROM letterheads WHERE id = ?',
      [id]
    );

    if (letterheads.length === 0) {
      return res.status(404).json({ error: 'Letterhead not found' });
    }

    const letterhead = letterheads[0];

    // Delete from database
    await db.execute('DELETE FROM letterheads WHERE id = ?', [id]);

    // Delete file
    const filePath = path.join(__dirname, '../../', letterhead.file_path);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      global.logger.error('Failed to delete letterhead file:', error);
    }

    global.logger.info('Letterhead deleted', { 
      id: id,
      deletedBy: req.user.id 
    });

    res.json({ message: 'Letterhead deleted successfully' });
  } catch (error) {
    global.logger.error('Delete letterhead error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Download letterhead
const downloadLetterhead = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [letterheads] = await db.execute(
      'SELECT * FROM letterheads WHERE id = ?',
      [id]
    );

    if (letterheads.length === 0) {
      return res.status(404).json({ error: 'Letterhead not found' });
    }

    const letterhead = letterheads[0];
    const filePath = path.join(__dirname, '../../', letterhead.file_path);

    res.download(filePath, letterhead.filename);
  } catch (error) {
    global.logger.error('Download letterhead error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  uploadLetterhead,
  getActiveLetterhead,
  getAllLetterheads,
  setActiveLetterhead,
  deleteLetterhead,
  downloadLetterhead
};