const db = require('../config/database');

// Get activity logs with pagination and filters
const getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      entityType,
      startDate,
      endDate,
      search
    } = req.query;

    // Ensure numeric values
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Build filter conditions
    if (userId) {
      conditions.push('user_id = ?');
      params.push(parseInt(userId));
    }

    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }

    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }

    if (startDate) {
      conditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= ?');
      params.push(endDate);
    }

    if (search) {
      conditions.push('(user_name LIKE ? OR entity_name LIKE ? OR action LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM activity_logs ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get logs with pagination
    const queryParams = [...params];
    const [logs] = await db.query(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`,
      queryParams
    );

    // Parse JSON details
    const formattedLogs = logs.map(log => ({
      ...log,
      details: log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : null
    }));

    res.json({
      logs: formattedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    global.logger.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get activity summary for dashboard
const getActivitySummary = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = parseInt(days) || 7;

    // Get activity counts by action for the last N days
    const [actionCounts] = await db.execute(
      `SELECT action, COUNT(*) as count 
       FROM activity_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY action
       ORDER BY count DESC`,
      [daysNum]
    );

    // Get most active users
    const [activeUsers] = await db.execute(
      `SELECT user_id, user_name, COUNT(*) as activity_count
       FROM activity_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY user_id, user_name
       ORDER BY activity_count DESC
       LIMIT 10`,
      [daysNum]
    );

    // Get activity by day
    const [dailyActivity] = await db.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM activity_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [daysNum]
    );

    res.json({
      actionCounts,
      activeUsers,
      dailyActivity
    });
  } catch (error) {
    global.logger.error('Get activity summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user's activity
const getUserActivity = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { page = 1, limit = 50 } = req.query;
    
    // Ensure numeric values
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM activity_logs WHERE user_id = ?',
      [userId]
    );
    const total = countResult[0].total;

    // Get user's activity logs
    const [logs] = await db.query(
      `SELECT * FROM activity_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ${limitNum} OFFSET ${offset}`,
      [userId]
    );

    // Parse JSON details
    const formattedLogs = logs.map(log => ({
      ...log,
      details: log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : null
    }));

    res.json({
      logs: formattedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    global.logger.error('Get user activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Log activity helper function (used internally)
const logActivity = async ({
  userId,
  userName,
  action,
  entityType = null,
  entityId = null,
  entityName = null,
  details = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    await db.execute(
      `INSERT INTO activity_logs 
       (user_id, user_name, action, entity_type, entity_id, entity_name, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userName,
        action,
        entityType,
        entityId,
        entityName,
        details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    global.logger.error('Log activity error:', error);
    // Don't throw error to prevent disrupting the main operation
  }
};

module.exports = {
  getActivityLogs,
  getActivitySummary,
  getUserActivity,
  logActivity
};