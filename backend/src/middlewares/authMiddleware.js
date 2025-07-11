const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const [users] = await db.execute(
      'SELECT id, username, email, full_name, role, permissions, is_active FROM users WHERE id = ? AND is_active = true',
      [decoded.userId]
    );

    if (users.length === 0) {
      throw new Error();
    }

    req.user = users[0];
    
    // Parse permissions safely
    if (typeof req.user.permissions === 'string') {
      try {
        req.user.permissions = JSON.parse(req.user.permissions);
      } catch (e) {
        req.user.permissions = {create: false, edit: false, delete: false, manageUsers: false};
      }
    } else if (!req.user.permissions) {
      req.user.permissions = {create: false, edit: false, delete: false, manageUsers: false};
    }
    
    // Ensure manageUsers field exists
    if (req.user.permissions.manageUsers === undefined) {
      req.user.permissions.manageUsers = false;
    }
    
    req.token = token;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

const canManageUsers = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.permissions.manageUsers === true) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. No user management permission.' });
  }
};

const hasPermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.permissions[permission]) {
      next();
    } else {
      res.status(403).json({ error: `Access denied. No ${permission} permission.` });
    }
  };
};

module.exports = { authMiddleware, isAdmin, hasPermission, canManageUsers };