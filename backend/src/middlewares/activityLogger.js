const { logActivity } = require('../controllers/activityLogController');

// Mapping of routes to activity types
const ACTIVITY_MAPPINGS = {
  'POST /auth/login': 'user.login',
  'POST /auth/logout': 'user.logout',
  'POST /users': 'user.create',
  'PUT /users/:id': 'user.update',
  'DELETE /users/:id': 'user.delete',
  'POST /users/:id/reset-password': 'user.password_reset',
  'POST /cases': 'case.create',
  'PUT /cases/:id': 'case.update',
  'DELETE /cases/:id': 'case.delete',
  'GET /cases/:id': 'case.view',
  'POST /conflicts/search': 'conflict.check',
  'POST /documents/upload': 'document.upload',
  'GET /documents/:id/download': 'document.download',
  'DELETE /documents/:id': 'document.delete'
};

// Middleware to log user activities
const activityLogger = (action = null) => {
  return async (req, res, next) => {
    // Skip if no user is authenticated
    if (!req.user) {
      return next();
    }

    // Store original end function
    const originalEnd = res.end;
    const startTime = Date.now();

    // Override end function to log after response
    res.end = function(...args) {
      // Call original end function
      originalEnd.apply(res, args);

      // Log activity if response was successful (2xx or 3xx)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const duration = Date.now() - startTime;
        
        // Determine action from route if not explicitly provided
        const routeKey = `${req.method} ${req.route?.path || req.path}`;
        const activityAction = action || ACTIVITY_MAPPINGS[routeKey];

        if (activityAction) {
          // Extract entity information from request
          let entityType = null;
          let entityId = null;
          let entityName = null;
          let details = {};

          // Parse entity information based on action
          if (activityAction.startsWith('case.')) {
            entityType = 'case';
            entityId = req.params.id || req.body.id || res.locals.caseId;
            entityName = req.body.clientName || res.locals.caseName;
            
            if (activityAction === 'case.create') {
              details = {
                caseNumber: req.body.caseNumber,
                caseType: req.body.caseType,
                clientName: req.body.clientName,
                opponentName: req.body.opponentName
              };
            }
          } else if (activityAction.startsWith('user.')) {
            entityType = 'user';
            entityId = req.params.id || res.locals.userId;
            entityName = req.body.fullName || req.body.username || res.locals.userName;
            
            if (activityAction === 'user.create') {
              details = {
                username: req.body.username,
                email: req.body.email,
                role: req.body.role
              };
            } else if (activityAction === 'user.update') {
              details = {
                updatedFields: Object.keys(req.body)
              };
            }
          } else if (activityAction === 'conflict.check') {
            entityType = 'conflict_check';
            details = {
              clientName: req.body.clientName,
              clientInn: req.body.clientInn,
              opponentName: req.body.opponentName,
              opponentInn: req.body.opponentInn,
              resultLevel: res.locals.conflictLevel
            };
          } else if (activityAction.startsWith('document.')) {
            entityType = 'document';
            entityId = req.params.id || res.locals.documentId;
            entityName = req.file?.originalname || res.locals.documentName;
            details = {
              fileName: entityName,
              fileSize: req.file?.size,
              mimeType: req.file?.mimetype
            };
          }

          // Add general details
          details.duration = duration;
          details.method = req.method;
          details.path = req.originalUrl;

          // Get IP address
          const ipAddress = req.headers['x-forwarded-for'] || 
                           req.connection.remoteAddress || 
                           req.socket.remoteAddress || 
                           req.ip;

          // Log the activity
          logActivity({
            userId: req.user.id,
            userName: req.user.full_name || req.user.username,
            action: activityAction,
            entityType,
            entityId,
            entityName,
            details,
            ipAddress,
            userAgent: req.headers['user-agent']
          });
        }
      }
    };

    next();
  };
};

module.exports = activityLogger;