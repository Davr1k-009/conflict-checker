const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Helper function to check if user can see all cases
const canSeeAllCases = (user) => {
  return user.role === 'admin' || user.permissions?.manageUsers === true;
};

// All routes require authentication
router.use(authMiddleware);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const userCanSeeAll = canSeeAllCases(req.user);
    const whereClause = userCanSeeAll ? '' : ' WHERE created_by = ?';
    const joinWhereClause = userCanSeeAll ? '' : ' AND c.created_by = ?';
    const params = userCanSeeAll ? [] : [req.user.id];

    // Get total cases
    const [totalCasesResult] = await db.execute(
      `SELECT COUNT(*) as count FROM cases${whereClause}`,
      params
    );
    const totalCases = totalCasesResult[0].count;

    // Get active conflicts (high and medium level) - filtered by user access
    const activeConflictsQuery = `
      SELECT COUNT(DISTINCT cc.case_id) as count 
      FROM conflict_checks cc
      JOIN cases c ON cc.case_id = c.id
      WHERE cc.conflict_level IN ('high', 'medium')
      AND cc.checked_at = (
        SELECT MAX(checked_at) 
        FROM conflict_checks cc2 
        WHERE cc2.case_id = cc.case_id
      )
      ${joinWhereClause}
    `;
    const [activeConflictsResult] = await db.execute(activeConflictsQuery, params);
    const activeConflicts = activeConflictsResult[0].count;

    // Get cases this month
    const casesThisMonthQuery = `
      SELECT COUNT(*) as count 
      FROM cases 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${whereClause ? ' AND created_by = ?' : ''}
    `;
    const [casesThisMonthResult] = await db.execute(casesThisMonthQuery, params);
    const casesThisMonth = casesThisMonthResult[0].count;

    // Get total users (visible to all)
    const [totalUsersResult] = await db.execute(
      'SELECT COUNT(*) as count FROM users WHERE is_active = true'
    );
    const totalUsers = totalUsersResult[0].count;

    // Get recent cases with conflict status - filtered by user access
    const recentCasesQuery = `
      SELECT 
        c.id, c.case_number, c.client_name, c.created_at,
        (
          SELECT conflict_level 
          FROM conflict_checks cc 
          WHERE cc.case_id = c.id 
          ORDER BY cc.checked_at DESC 
          LIMIT 1
        ) as conflict_level
      FROM cases c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT 10
    `;
    const [recentCases] = await db.execute(recentCasesQuery, params);

    // Get conflicts by level - filtered by user access
    const conflictsByLevelQuery = `
      SELECT 
        latest_conflicts.conflict_level as level,
        COUNT(*) as count
      FROM (
        SELECT DISTINCT 
          cc.case_id,
          FIRST_VALUE(cc.conflict_level) OVER (
            PARTITION BY cc.case_id 
            ORDER BY cc.checked_at DESC
          ) as conflict_level
        FROM conflict_checks cc
        JOIN cases c ON cc.case_id = c.id
        WHERE 1=1 ${joinWhereClause}
      ) as latest_conflicts
      GROUP BY latest_conflicts.conflict_level
    `;
    const [conflictsByLevel] = await db.execute(
      conflictsByLevelQuery,
      params.length > 0 ? params : []
    );

    // Get cases by month for the last 6 months - filtered by user access
    const casesByMonthQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM cases
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      ${whereClause ? ' AND created_by = ?' : ''}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `;
    const [casesByMonth] = await db.execute(casesByMonthQuery, params);

    res.json({
      totalCases,
      activeConflicts,
      casesThisMonth,
      totalUsers,
      recentCases,
      conflictsByLevel,
      casesByMonth: casesByMonth.map(item => ({
        month: formatMonth(item.month),
        count: item.count
      }))
    });
  } catch (error) {
    global.logger.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to format month
function formatMonth(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

module.exports = router;