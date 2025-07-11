const db = require('../config/database');
const { checkConflicts } = require('../services/conflictService');
const { parseCaseJsonFields, safeJsonParse } = require('../utils/jsonUtils');
const { generateSearchVariants } = require('../utils/transliterate');
const { logActivity } = require('./activityLogController');
const fs = require('fs').promises;
const path = require('path');

// Helper function to check if user can see all cases
const canSeeAllCases = (user) => {
  return user.role === 'admin' || user.permissions?.manageUsers === true;
};

const getAllCases = async (req, res) => {
  try {
    const { search, type, lawyerId } = req.query;
    
    let query = `
      SELECT 
        c.*, 
        creator.full_name as created_by_name,
        COUNT(DISTINCT d.id) as document_count,
        COUNT(DISTINCT cl.lawyer_id) as lawyer_count,
        GROUP_CONCAT(DISTINCT u.full_name ORDER BY u.full_name SEPARATOR ', ') as lawyer_names
      FROM cases c
      LEFT JOIN case_lawyers cl ON c.id = cl.case_id
      LEFT JOIN users u ON cl.lawyer_id = u.id
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN documents d ON c.id = d.case_id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Add visibility filter - only show cases created by user unless admin or has manageUsers permission
    if (!canSeeAllCases(req.user)) {
      query += ` AND c.created_by = ?`;
      params.push(req.user.id);
    }
    
    if (search) {
      // Generate search variants (original + transliterated)
      const searchVariants = generateSearchVariants(search);
      
      // Build search conditions for all variants
      const searchConditions = searchVariants.map(() => `(
        c.client_name LIKE ? OR 
        c.opponent_name LIKE ? OR 
        c.case_number LIKE ? OR
        c.client_inn = ? OR
        c.client_pinfl = ? OR
        c.opponent_inn = ? OR
        c.opponent_pinfl = ?
      )`).join(' OR ');
      
      query += ` AND (${searchConditions})`;
      
      // Add parameters for each variant
      searchVariants.forEach(variant => {
        const searchPattern = `%${variant}%`;
        params.push(searchPattern, searchPattern, searchPattern, variant, variant, variant, variant);
      });
    }
    
    if (type) {
      query += ` AND c.case_type = ?`;
      params.push(type);
    }
    
    if (lawyerId) {
      query += ` AND EXISTS (SELECT 1 FROM case_lawyers WHERE case_id = c.id AND lawyer_id = ?)`;
      params.push(lawyerId);
    }
    
    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;
    
    const [cases] = await db.execute(query, params);
    
    // Parse JSON fields safely
    const formattedCases = cases.map(c => parseCaseJsonFields(c));
    
    res.json(formattedCases);
  } catch (error) {
    global.logger.error('Get cases error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getCaseById = async (req, res) => {
  try {
    const caseId = req.params.id;
    
    const [cases] = await db.execute(
      `SELECT 
        c.*, 
        creator.full_name as created_by_name
      FROM cases c
      LEFT JOIN users creator ON c.created_by = creator.id
      WHERE c.id = ?`,
      [caseId]
    );
    
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Check if user has access to this case
    if (!canSeeAllCases(req.user) && cases[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const caseData = parseCaseJsonFields(cases[0]);
    
    // Get assigned lawyers
    const [lawyers] = await db.execute(
      `SELECT 
        cl.*, 
        u.full_name as lawyer_name,
        u.position,
        u.email,
        assigner.full_name as assigned_by_name
      FROM case_lawyers cl
      LEFT JOIN users u ON cl.lawyer_id = u.id
      LEFT JOIN users assigner ON cl.assigned_by = assigner.id
      WHERE cl.case_id = ?
      ORDER BY cl.assigned_at DESC`,
      [caseId]
    );
    
    // Get documents
    const [documents] = await db.execute(
      `SELECT 
        d.*,
        u.full_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.case_id = ?`,
      [caseId]
    );
    
    // Get conflict history
    const [conflicts] = await db.execute(
      `SELECT 
        cc.*, 
        u.full_name as checked_by_name
      FROM conflict_checks cc
      LEFT JOIN users u ON cc.checked_by = u.id
      WHERE cc.case_id = ?
      ORDER BY cc.checked_at DESC`,
      [caseId]
    );
    
    // Log case view activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'case.view',
      entityType: 'case',
      entityId: caseId,
      entityName: caseData.client_name,
      details: {
        caseNumber: caseData.case_number,
        caseType: caseData.case_type
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      ...caseData,
      lawyers,
      documents,
      conflictHistory: conflicts.map(c => ({
        ...c,
        conflicting_cases: safeJsonParse(c.conflicting_cases, [])
      }))
    });
  } catch (error) {
    global.logger.error('Get case error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createCase = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      caseNumber,
      clientName,
      clientType,
      clientInn,
      clientPinfl,
      opponentName,
      opponentType,
      opponentInn,
      opponentPinfl,
      caseType,
      description,
      lawyersAssigned, // Changed from lawyerAssigned to lawyersAssigned (array)
      contactPersons, // New field for contact persons
      relatedCompanies,
      relatedIndividuals, // New field
      founders,
      directors,
      beneficiaries
    } = req.body;
    
    // Validation
    if (!clientName) {
      return res.status(400).json({ error: 'Client name is required' });
    }
    
    // Validate INN/PINFL based on client type
    if (clientType === 'legal' && !clientInn) {
      return res.status(400).json({ error: 'Client INN is required for legal entities' });
    }
    
    if (clientType === 'individual' && !clientPinfl) {
      return res.status(400).json({ error: 'Client PINFL is required for individuals' });
    }
    
    // Validate contact persons - at least one required
    if (!contactPersons || contactPersons.length === 0 || 
        !contactPersons.some(cp => cp.name && cp.name.trim() !== '' && cp.phone && cp.phone.trim() !== '')) {
      return res.status(400).json({ error: 'At least one contact person with name and phone number is required' });
    }
    
    // Check for duplicate case number
    if (caseNumber) {
      const [existing] = await connection.execute(
        'SELECT id FROM cases WHERE case_number = ?',
        [caseNumber]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Case number already exists' });
      }
    }
    
    // Insert case with new fields including contact_persons and related_individuals
    const [result] = await connection.execute(
      `INSERT INTO cases (
        case_number, client_name, client_type, client_inn, client_pinfl,
        opponent_name, opponent_type, opponent_inn, opponent_pinfl,
        case_type, description, contact_persons, related_companies, related_individuals,
        founders, directors, beneficiaries, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseNumber || null,
        clientName,
        clientType || 'legal',
        clientInn || null,
        clientPinfl || null,
        opponentName || null,
        opponentType || 'legal',
        opponentInn || null,
        opponentPinfl || null,
        caseType || 'other',
        description || null,
        JSON.stringify(contactPersons || []), // New field
        JSON.stringify(relatedCompanies || []),
        JSON.stringify(relatedIndividuals || []), // New field
        JSON.stringify(founders || []),
        JSON.stringify(directors || []),
        JSON.stringify(beneficiaries || []),
        req.user.id
      ]
    );
    
    const caseId = result.insertId;
    
    // Assign lawyers if provided
    if (lawyersAssigned && lawyersAssigned.length > 0) {
      const lawyerValues = lawyersAssigned.map(lawyerId => [
        caseId,
        lawyerId,
        req.user.id
      ]);
      
      await connection.query(
        `INSERT INTO case_lawyers (case_id, lawyer_id, assigned_by) VALUES ?`,
        [lawyerValues]
      );
    }
    
    // Check for conflicts (Note: conflict check still searches ALL cases, not filtered by visibility)
    const conflictResult = await checkConflicts({
      id: caseId,
      client_name: clientName,
      client_type: clientType || 'legal',
      client_inn: clientInn || '',
      client_pinfl: clientPinfl || '',
      opponent_name: opponentName || '',
      opponent_type: opponentType || 'legal',
      opponent_inn: opponentInn || '',
      opponent_pinfl: opponentPinfl || '',
      lawyersAssigned: lawyersAssigned || [],
      contact_persons: contactPersons || [], // New field
      related_companies: relatedCompanies || [],
      related_individuals: relatedIndividuals || [], // New field
      founders: founders || [],
      directors: directors || [],
      beneficiaries: beneficiaries || []
    });
    
    // Save conflict check result
    await connection.execute(
      `INSERT INTO conflict_checks (
        case_id, conflict_level, conflict_reason, conflicting_cases, checked_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        caseId,
        conflictResult.level,
        conflictResult.reasons.join('; '),
        JSON.stringify(conflictResult.conflictingCases || []),
        req.user.id
      ]
    );
    
    await connection.commit();
    
    global.logger.info('Case created', { caseId, createdBy: req.user.id });
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'case.create',
      entityType: 'case',
      entityId: caseId,
      entityName: clientName,
      details: {
        caseNumber: caseNumber || null,
        caseType: caseType || 'other',
        clientName,
        clientType: clientType || 'legal',
        clientInn: clientInn || null,
        clientPinfl: clientPinfl || null,
        opponentName: opponentName || null,
        opponentType: opponentType || 'legal',
        opponentInn: opponentInn || null,
        opponentPinfl: opponentPinfl || null,
        conflictLevel: conflictResult.level,
        lawyersAssigned: lawyersAssigned || [],
        contactPersonsCount: contactPersons ? contactPersons.length : 0
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    // Notify about conflict if found
    if (conflictResult.level !== 'none') {
      global.io.emit('conflict-detected', {
        caseId,
        clientName,
        level: conflictResult.level,
        message: `Conflict detected for case: ${clientName}`
      });
    }
    
    res.status(201).json({
      id: caseId,
      message: 'Case created successfully',
      conflictCheck: conflictResult
    });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Create case error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

const updateCase = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const caseId = req.params.id;
    const updates = req.body;
    
    // Get original case data for logging and access check
    const [originalCase] = await connection.execute(
      'SELECT client_name, client_type, created_by FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (originalCase.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Check if user has access to update this case
    if (!canSeeAllCases(req.user) && originalCase[0].created_by !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Build update query for case table
    const fields = [];
    const values = [];
    
    // Validate INN/PINFL based on client type if updating
    if (updates.client_type !== undefined || updates.client_inn !== undefined || updates.client_pinfl !== undefined) {
      const clientType = updates.client_type || originalCase[0].client_type;
      
      if (clientType === 'legal' && updates.client_inn === '') {
        await connection.rollback();
        return res.status(400).json({ error: 'Client INN is required for legal entities' });
      }
      
      if (clientType === 'individual' && updates.client_pinfl === '') {
        await connection.rollback();
        return res.status(400).json({ error: 'Client PINFL is required for individuals' });
      }
    }
    
    // Validate contact persons if provided
    if (updates.contact_persons !== undefined) {
      if (!updates.contact_persons || updates.contact_persons.length === 0 || 
          !updates.contact_persons.some(cp => cp.name && cp.name.trim() !== '' && cp.phone && cp.phone.trim() !== '')) {
        await connection.rollback();
        return res.status(400).json({ error: 'At least one contact person with name and phone number is required' });
      }
    }
    
    const allowedFields = [
      'client_name', 'client_type', 'client_inn', 'client_pinfl',
      'opponent_name', 'opponent_type', 'opponent_inn', 'opponent_pinfl',
      'case_type', 'description'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    
    // Handle JSON fields
    const jsonFields = ['contact_persons', 'related_companies', 'related_individuals', 'founders', 'directors', 'beneficiaries'];
    for (const field of jsonFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(JSON.stringify(updates[field]));
      }
    }
    
    if (fields.length > 0) {
      values.push(caseId);
      await connection.execute(
        `UPDATE cases SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
    
    // Handle lawyers assignment updates
    if (updates.lawyersAssigned !== undefined) {
      // Remove all existing lawyer assignments
      await connection.execute(
        'DELETE FROM case_lawyers WHERE case_id = ?',
        [caseId]
      );
      
      // Add new lawyer assignments
      if (updates.lawyersAssigned && updates.lawyersAssigned.length > 0) {
        const lawyerValues = updates.lawyersAssigned.map(lawyerId => [
          caseId,
          lawyerId,
          req.user.id
        ]);
        
        await connection.query(
          `INSERT INTO case_lawyers (case_id, lawyer_id, assigned_by) VALUES ?`,
          [lawyerValues]
        );
      }
    }
    
    // Re-check conflicts after update (still searches ALL cases)
    const [updatedCase] = await connection.execute(
      'SELECT * FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (updatedCase.length > 0) {
      const parsedCase = parseCaseJsonFields(updatedCase[0]);
      
      // Get current lawyers
      const [lawyers] = await connection.execute(
        'SELECT lawyer_id FROM case_lawyers WHERE case_id = ?',
        [caseId]
      );
      parsedCase.lawyersAssigned = lawyers.map(l => l.lawyer_id);
      
      const conflictResult = await checkConflicts(parsedCase);
      
      await connection.execute(
        `INSERT INTO conflict_checks (
          case_id, conflict_level, conflict_reason, conflicting_cases, checked_by
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          caseId,
          conflictResult.level,
          conflictResult.reasons.join('; '),
          JSON.stringify(conflictResult.conflictingCases || []),
          req.user.id
        ]
      );
    }
    
    await connection.commit();
    
    global.logger.info('Case updated', { caseId, updatedBy: req.user.id });
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'case.update',
      entityType: 'case',
      entityId: caseId,
      entityName: originalCase[0].client_name,
      details: {
        updatedFields: Object.keys(updates),
        changes: updates
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Case updated successfully' });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Update case error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

const deleteCase = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const caseId = req.params.id;
    
    // Get case info for folder deletion, logging and access check
    const [cases] = await connection.execute(
      'SELECT case_number, client_name, created_by FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const caseData = cases[0];
    
    // Check if user has access to delete this case
    if (!canSeeAllCases(req.user) && caseData.created_by !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete case lawyers assignments first
    await connection.execute('DELETE FROM case_lawyers WHERE case_id = ?', [caseId]);
    
    // Delete conflict checks
    await connection.execute('DELETE FROM conflict_checks WHERE case_id = ?', [caseId]);
    
    // Get all documents for this case to delete files
    const [documents] = await connection.execute(
      'SELECT file_path FROM documents WHERE case_id = ?',
      [caseId]
    );
    
    // Get all entity documents for this case (if table exists)
    let entityDocuments = [];
    try {
      [entityDocuments] = await connection.execute(
        'SELECT file_path FROM entity_documents WHERE case_id = ?',
        [caseId]
      );
    } catch (error) {
      // Table might not exist yet
      global.logger.warn('entity_documents table might not exist:', error.message);
    }
    
    // Delete the case (this will cascade delete related records due to foreign keys)
    await connection.execute('DELETE FROM cases WHERE id = ?', [caseId]);
    
    await connection.commit();
    
    // Delete physical files after successful database deletion
    const allDocuments = [...documents, ...entityDocuments];
    for (const doc of allDocuments) {
      try {
        if (doc.file_path) {
          await fs.unlink(path.resolve(doc.file_path));
        }
      } catch (error) {
        global.logger.warn('Failed to delete file:', error);
      }
    }
    
    // Try to delete the case folder if it's empty
    try {
      const folderName = createSafeFolderName(caseData.case_number, caseId, caseData.client_name);
      const caseFolder = path.join('./uploads', folderName);
      
      // Check if folder exists and is empty
      const files = await fs.readdir(caseFolder).catch(() => []);
      if (files.length === 0) {
        await fs.rmdir(caseFolder);
      }
    } catch (error) {
      global.logger.warn('Failed to delete case folder:', error);
    }
    
    global.logger.info('Case deleted', { caseId, deletedBy: req.user.id });
    
    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'case.delete',
      entityType: 'case',
      entityId: caseId,
      entityName: caseData.client_name,
      details: {
        caseNumber: caseData.case_number,
        clientName: caseData.client_name,
        documentCount: documents.length
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Delete case error:', error);
    res.status(500).json({ error: 'Failed to delete case. Please check if there are related records.' });
  } finally {
    connection.release();
  }
};

// Get lawyers assigned to a case
const getCaseLawyers = async (req, res) => {
  try {
    const caseId = req.params.id;
    
    // First check if user has access to this case
    const [cases] = await db.execute(
      'SELECT created_by FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    if (!canSeeAllCases(req.user) && cases[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [lawyers] = await db.execute(
      `SELECT 
        cl.*, 
        u.full_name as lawyer_name,
        u.position,
        u.email,
        assigner.full_name as assigned_by_name
      FROM case_lawyers cl
      LEFT JOIN users u ON cl.lawyer_id = u.id
      LEFT JOIN users assigner ON cl.assigned_by = assigner.id
      WHERE cl.case_id = ?
      ORDER BY cl.assigned_at DESC`,
      [caseId]
    );
    
    res.json(lawyers);
  } catch (error) {
    global.logger.error('Get case lawyers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Assign lawyer to a case
const assignLawyer = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { lawyerId } = req.body;
    
    if (!lawyerId) {
      return res.status(400).json({ error: 'Lawyer ID is required' });
    }
    
    // Check if user has access to this case
    const [cases] = await db.execute(
      'SELECT created_by, client_name FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    if (!canSeeAllCases(req.user) && cases[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if already assigned
    const [existing] = await db.execute(
      'SELECT id FROM case_lawyers WHERE case_id = ? AND lawyer_id = ?',
      [caseId, lawyerId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Lawyer already assigned to this case' });
    }
    
    // Assign lawyer
    await db.execute(
      'INSERT INTO case_lawyers (case_id, lawyer_id, assigned_by) VALUES (?, ?, ?)',
      [caseId, lawyerId, req.user.id]
    );
    
    // Log activity
    const [lawyerData] = await db.execute('SELECT full_name FROM users WHERE id = ?', [lawyerId]);
    
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'case.lawyer_assigned',
      entityType: 'case',
      entityId: caseId,
      entityName: cases[0].client_name,
      details: {
        lawyerId,
        lawyerName: lawyerData[0]?.full_name
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Lawyer assigned successfully' });
  } catch (error) {
    global.logger.error('Assign lawyer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Remove lawyer from a case
const removeLawyer = async (req, res) => {
  try {
    const caseId = req.params.id;
    const lawyerId = req.params.lawyerId;
    
    // Check if user has access to this case
    const [cases] = await db.execute(
      'SELECT created_by, client_name FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    if (!canSeeAllCases(req.user) && cases[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [result] = await db.execute(
      'DELETE FROM case_lawyers WHERE case_id = ? AND lawyer_id = ?',
      [caseId, lawyerId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Lawyer assignment not found' });
    }
    
    // Log activity
    const [lawyerData] = await db.execute('SELECT full_name FROM users WHERE id = ?', [lawyerId]);
    
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'case.lawyer_removed',
      entityType: 'case',
      entityId: caseId,
      entityName: cases[0].client_name,
      details: {
        lawyerId,
        lawyerName: lawyerData[0]?.full_name
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Lawyer removed successfully' });
  } catch (error) {
    global.logger.error('Remove lawyer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper function to create safe folder name (same as in documentRoutes.js)
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

module.exports = {
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  getCaseLawyers,
  assignLawyer,
  removeLawyer
};