const winston = require('winston');
const { initDatabase, runMigrations } = require('./src/config/initDatabase');

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

// Make logger globally available
global.logger = logger;

async function main() {
  try {
    logger.info('Starting database migration...');
    
    // Run SQL migrations from files
    await runMigrations();
    
    // Initialize core tables
    await initDatabase();
    
    logger.info('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

main();