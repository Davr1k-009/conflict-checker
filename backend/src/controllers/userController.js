const bcrypt = require('bcrypt');
const db = require('../config/database');
const { parsePermissions } = require('../utils/jsonUtils');
const { logActivity } = require('./activityLogController');

const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT 
        u.id, u.full_name, u.position, u.role, u.email, 
        u.username, u.is_active, u.permissions, u.created_at,
        creator.full_name as created_by_name
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      ORDER BY u.created_at DESC
    `);

    const formattedUsers = users.map(user => ({
      ...user,
      permissions: parsePermissions(user.permissions)
    }));

    res.json(formattedUsers);
  } catch (error) {
    global.logger.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createUser = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { fullName, position, role, email, username, password, permissions } = req.body;
    
    // Validation
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check if username or email already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Ensure permissions object has all required fields
    const userPermissions = {
      create: permissions?.create || false,
      edit: permissions?.edit || false,
      delete: permissions?.delete || false,
      manageUsers: permissions?.manageUsers || false
    };

    // Insert user
    const [result] = await connection.execute(
      `INSERT INTO users (full_name, position, role, email, username, password, permissions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName,
        position || null,
        role || 'user',
        email,
        username,
        hashedPassword,
        JSON.stringify(userPermissions),
        req.user.id
      ]
    );

    await connection.commit();

    global.logger.info('User created', { 
      newUserId: result.insertId, 
      createdBy: req.user.id 
    });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'user.create',
      entityType: 'user',
      entityId: result.insertId,
      entityName: fullName,
      details: {
        username,
        email,
        role: role || 'user',
        permissions: userPermissions
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Notify via WebSocket
    global.io.emit('user-created', {
      id: result.insertId,
      fullName,
      createdBy: req.user.fullName
    });

    res.status(201).json({
      id: result.insertId,
      fullName,
      position,
      role,
      email,
      username,
      message: 'User created successfully'
    });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullName, position, role, email, isActive, permissions } = req.body;

    // Get original user data for logging
    const [originalUser] = await db.execute(
      'SELECT full_name, email, role FROM users WHERE id = ?',
      [userId]
    );

    if (originalUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    const changes = {};

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(fullName);
      changes.fullName = fullName;
    }
    if (position !== undefined) {
      updates.push('position = ?');
      values.push(position);
      changes.position = position;
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
      changes.role = role;
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
      changes.email = email;
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
      changes.isActive = isActive;
    }
    if (permissions !== undefined) {
      // Ensure permissions object has all required fields
      const userPermissions = {
        create: permissions.create || false,
        edit: permissions.edit || false,
        delete: permissions.delete || false,
        manageUsers: permissions.manageUsers || false
      };
      updates.push('permissions = ?');
      values.push(JSON.stringify(userPermissions));
      changes.permissions = userPermissions;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    await db.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    global.logger.info('User updated', { userId, updatedBy: req.user.id });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'user.update',
      entityType: 'user',
      entityId: userId,
      entityName: originalUser[0].full_name,
      details: {
        updatedFields: Object.keys(changes),
        changes
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    global.logger.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.id;
    const { username, email } = req.body;

    // Only admins can update their profile
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can update their profile' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (username !== undefined && username !== req.user.username) {
      // Check if new username already exists
      const [existingUsername] = await connection.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );

      if (existingUsername.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Username already exists' });
      }

      updates.push('username = ?');
      values.push(username);
    }

    if (email !== undefined && email !== req.user.email) {
      // Check if new email already exists
      const [existingEmail] = await connection.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingEmail.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Email already exists' });
      }

      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    await connection.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated user data
    const [updatedUser] = await connection.execute(
      'SELECT id, username, email, full_name, role, permissions FROM users WHERE id = ?',
      [userId]
    );

    await connection.commit();

    global.logger.info('Profile updated', { userId });

    // Log activity - profile update is a special case of user update
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'user.update',
      entityType: 'user',
      entityId: userId,
      entityName: req.user.full_name,
      details: {
        updatedFields: updates.map(u => u.split(' ')[0]),
        profileUpdate: true
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Return updated user data
    res.json({
      message: 'Profile updated successfully',
      user: {
        ...updatedUser[0],
        permissions: parsePermissions(updatedUser[0].permissions)
      }
    });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

const resetPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Get user info for logging
    const [users] = await db.execute(
      'SELECT full_name, username FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    global.logger.info('Password reset', { userId, resetBy: req.user.id });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: userId,
      entityName: users[0].full_name,
      details: {
        targetUsername: users[0].username,
        resetBy: req.user.username
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    global.logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    // Prevent admin from deleting themselves
    if (userId === currentUserId) {
      await connection.rollback();
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const [users] = await connection.execute(
      'SELECT id, full_name, role, username FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const userToDelete = users[0];

    // Prevent deleting the last admin
    if (userToDelete.role === 'admin') {
      const [adminCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = true',
        ['admin']
      );

      if (adminCount[0].count <= 1) {
        await connection.rollback();
        return res.status(403).json({ error: 'Cannot delete the last administrator' });
      }
    }

    // Update cases to remove lawyer assignment
    await connection.execute(
      'UPDATE cases SET lawyer_assigned = NULL WHERE lawyer_assigned = ?',
      [userId]
    );

    // Delete user
    await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();

    global.logger.info('User deleted', { 
      deletedUserId: userId,
      deletedUserName: userToDelete.full_name,
      deletedBy: req.user.id 
    });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'user.delete',
      entityType: 'user',
      entityId: userId,
      entityName: userToDelete.full_name,
      details: {
        deletedUsername: userToDelete.username,
        deletedRole: userToDelete.role
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Notify via WebSocket
    global.io.emit('user-deleted', {
      id: userId,
      fullName: userToDelete.full_name,
      deletedBy: req.user.fullName
    });

    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id: userId,
        fullName: userToDelete.full_name
      }
    });
  } catch (error) {
    await connection.rollback();
    global.logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

const getUserActivity = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get user's cases
    const [cases] = await db.execute(
      `SELECT 
        c.id, c.case_number, c.client_name, c.created_at,
        'case_created' as activity_type
       FROM cases c
       WHERE c.created_by = ?
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Get user's conflict checks
    const [checks] = await db.execute(
      `SELECT 
        cc.id, cc.checked_at as created_at, cc.conflict_level,
        c.client_name, c.case_number,
        'conflict_check' as activity_type
       FROM conflict_checks cc
       JOIN cases c ON cc.case_id = c.id
       WHERE cc.checked_by = ?
       ORDER BY cc.checked_at DESC
       LIMIT 50`,
      [userId]
    );

    const activities = [...cases, ...checks]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    res.json(activities);
  } catch (error) {
    global.logger.error('Get user activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  updateProfile,
  resetPassword,
  deleteUser,
  getUserActivity
};