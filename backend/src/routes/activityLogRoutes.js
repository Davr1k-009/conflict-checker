const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(isAdmin);

// Get activity logs with filters and pagination
router.get('/', activityLogController.getActivityLogs);

// Get activity summary for dashboard
router.get('/summary', activityLogController.getActivitySummary);

// Get specific user's activity
router.get('/user/:userId', activityLogController.getUserActivity);

module.exports = router;