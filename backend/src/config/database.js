const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'conflict_checker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Add charset configuration for proper UTF-8 support
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  // Enable multiple statements for migrations
  multipleStatements: true
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    
    // Set UTF-8 for the connection
    await connection.execute("SET NAMES 'utf8mb4'");
    await connection.execute("SET CHARACTER SET utf8mb4");
    
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

module.exports = pool;