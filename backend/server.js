const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const caseRoutes = require('./src/routes/caseRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const entityDocumentRoutes = require('./src/routes/entityDocumentRoutes');
const conflictRoutes = require('./src/routes/conflictRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const activityLogRoutes = require('./src/routes/activityLogRoutes');
const backupRoutes = require('./src/routes/backupRoutes');
const letterheadRoutes = require('./src/routes/letterheadRoutes');
const backupService = require('./src/services/backupService');

// Import database
const db = require('./src/config/database');
const { initDatabase, runMigrations } = require('./src/config/initDatabase');

// Create Express app
const app = express();
const httpServer = createServer(app);

// Configure allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  `http://${process.env.SERVER_IP || '192.168.1.51'}:3000`,
  `http://${process.env.SERVER_IP || '192.168.1.51'}:3001`,
  // Add any other IPs that might access the server
];

// Add dynamic origin if provided in environment
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

const io = new Server(httpServer, {
  cors: corsOptions
});

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'conflict-checker' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Make logger globally available
global.logger = logger;
global.io = io;

// Set default charset to UTF-8 for all responses
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin for static files
}));

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parsing middleware with UTF-8 support
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Static files for uploaded documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  // Set proper headers for different file types
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    // Set content type based on file extension
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      res.setHeader('Content-Type', `image/${ext.substring(1)}`);
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition', 'attachment');
    }
    
    // Enable CORS for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    user: req.user?.id,
    origin: req.headers.origin
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/entity-documents', entityDocumentRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/letterheads', letterheadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    serverIP: process.env.SERVER_IP || '192.168.1.51',
    port: PORT
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info('New WebSocket connection', { socketId: socket.id });
  
  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    logger.info(`User ${userId} joined their room`);
  });
  
  socket.on('disconnect', () => {
    logger.info('WebSocket disconnected', { socketId: socket.id });
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection first
    const connection = await db.getConnection();
    logger.info('Database connected successfully');
    
    // Установка глобальных настроек MySQL для оптимизации
    await connection.execute('SET GLOBAL group_concat_max_len = 32768');
    await connection.execute('SET GLOBAL max_allowed_packet = 67108864'); // 64MB
    
    connection.release();
    
    // Run migrations from SQL files
    await runMigrations();
    
    // Initialize database tables
    await initDatabase();
    
    // Schedule automatic backups
    backupService.scheduleAutoBackups();
    
    // Start HTTP server
    httpServer.listen(PORT, HOST, () => {
      logger.info(`Server running on ${HOST}:${PORT}`);
      logger.info(`Server accessible at http://${process.env.SERVER_IP || '192.168.1.105'}:${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();