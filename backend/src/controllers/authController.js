const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { parsePermissions } = require('../utils/jsonUtils');
const { logActivity } = require('./activityLogController');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '8h' }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    { expiresIn: '7d' }
  );
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Log login attempt
    global.logger.info('Login attempt', { 
      username, 
      ip: req.ip,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']
    });

    if (!username || !password) {
      global.logger.warn('Login failed: missing credentials', { username });
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const [users] = await db.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = true',
      [username]
    );

    if (users.length === 0) {
      global.logger.warn('Login failed: user not found or inactive', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      global.logger.warn('Login failed: invalid password', { username, userId: user.id });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Log successful login
    global.logger.info('Login successful', { 
      userId: user.id, 
      username: user.username,
      role: user.role,
      ip: req.ip
    });

    // Log activity
    await logActivity({
      userId: user.id,
      userName: user.full_name || user.username,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      entityName: user.username,
      details: {
        role: user.role,
        loginTime: new Date()
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Parse permissions safely
    const permissions = parsePermissions(user.permissions);

    // Return user data and tokens
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        permissions: permissions
      },
      token,
      refreshToken
    });
  } catch (error) {
    global.logger.error('Login error:', {
      error: error.message,
      stack: error.stack,
      username: req.body.username,
      ip: req.ip
    });
    res.status(500).json({ error: 'Server error' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
    );

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Generate new access token
    const token = generateToken(decoded.userId);

    res.json({ token });
  } catch (error) {
    global.logger.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Get current password hash
    const [users] = await db.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    global.logger.info('Password changed', { userId });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'user.password_change',
      entityType: 'user',
      entityId: req.user.id,
      entityName: req.user.username,
      details: {
        changedAt: new Date()
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    global.logger.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  login,
  refresh,
  changePassword
};