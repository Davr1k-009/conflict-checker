const db = require('./database');
const fs = require('fs').promises;
const path = require('path');

const initDatabase = async () => {
  global.logger.info('Starting database initialization...');

  try {
    // Get list of existing tables
    const [tables] = await db.execute(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE()`
    );
    
    const existingTables = tables.map(t => t.table_name || t.TABLE_NAME);
    
    // Create activity_logs table
    if (!existingTables.includes('activity_logs')) {
      global.logger.info('Creating activity_logs table...');
      await db.execute(`
        CREATE TABLE activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50),
          entity_id INT,
          entity_name VARCHAR(255),
          details JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_entity (entity_type, entity_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
    global.logger.info('Activity logs table ready');

    // Create entity_documents table
    if (!existingTables.includes('entity_documents')) {
      global.logger.info('Creating entity_documents table...');
      await db.execute(`
        CREATE TABLE entity_documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          case_id INT NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_index INT NOT NULL,
          entity_name VARCHAR(255) NOT NULL,
          entity_inn VARCHAR(20),
          entity_pinfl VARCHAR(20),
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size INT NOT NULL,
          mime_type VARCHAR(100),
          uploaded_by INT NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_case_entity (case_id, entity_type, entity_index),
          INDEX idx_uploaded_by (uploaded_by),
          
          CONSTRAINT fk_entity_docs_case 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
          CONSTRAINT fk_entity_docs_user 
            FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
    global.logger.info('Entity documents table ready');

    // Check and create entity_documents table (keep for compatibility)
    await checkAndCreateEntityDocumentsTable();

    // Create case_lawyers table
    if (!existingTables.includes('case_lawyers')) {
      global.logger.info('Creating case_lawyers table...');
      await db.execute(`
        CREATE TABLE case_lawyers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          case_id INT NOT NULL,
          lawyer_id INT NOT NULL,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_by INT NOT NULL,
          
          INDEX idx_case_id (case_id),
          INDEX idx_lawyer_id (lawyer_id),
          INDEX idx_assigned_by (assigned_by),
          
          UNIQUE KEY unique_case_lawyer (case_id, lawyer_id),
          
          CONSTRAINT fk_case_lawyers_case 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
          CONSTRAINT fk_case_lawyers_lawyer 
            FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE RESTRICT,
          CONSTRAINT fk_case_lawyers_assigned_by 
            FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Migrate existing lawyer assignments
      global.logger.info('Migrating existing lawyer assignments...');
      
      // Check if lawyer_assigned column exists
      const [columns] = await db.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'cases' 
        AND COLUMN_NAME = 'lawyer_assigned'
      `);
      
      if (columns.length > 0) {
        await db.execute(`
          INSERT INTO case_lawyers (case_id, lawyer_id, assigned_by, assigned_at)
          SELECT 
            c.id as case_id,
            c.lawyer_assigned as lawyer_id,
            c.created_by as assigned_by,
            c.created_at as assigned_at
          FROM cases c
          WHERE c.lawyer_assigned IS NOT NULL
          ON DUPLICATE KEY UPDATE lawyer_id = lawyer_id
        `);
        global.logger.info('Lawyer assignments migrated successfully');
      }
    }
    global.logger.info('Case lawyers table ready');
    
    // Log existing tables
    global.logger.info('Existing tables:', existingTables);
    
    global.logger.info('Database initialization completed successfully');

  } catch (error) {
    global.logger.error('Database initialization error:', error);
    throw error;
  }
};

const checkAndCreateEntityDocumentsTable = async () => {
  try {
    // Check if entity_documents table exists
    const [tables] = await db.execute(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'entity_documents'`
    );

    if (tables.length === 0) {
      // Create entity_documents table
      await db.execute(`
        CREATE TABLE entity_documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          case_id INT NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_index INT NOT NULL,
          entity_name VARCHAR(255) NOT NULL,
          entity_inn VARCHAR(20),
          entity_pinfl VARCHAR(20),
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size INT NOT NULL,
          mime_type VARCHAR(100),
          uploaded_by INT NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_case_entity (case_id, entity_type, entity_index),
          INDEX idx_uploaded_by (uploaded_by),
          
          CONSTRAINT fk_entity_docs_case 
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
          CONSTRAINT fk_entity_docs_user 
            FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      global.logger.info('Created entity_documents table');
    }

    global.logger.info('Entity documents table ready');
  } catch (error) {
    global.logger.error('Error checking/creating entity_documents table:', error);
    // Don't throw error, continue with initialization
  }
};

const runMigrations = async () => {
  try {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    global.logger.info(`Found ${sqlFiles.length} migration files`);

    for (const file of sqlFiles) {
      global.logger.info(`Running migration: ${file}`);
      
      try {
        const filePath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filePath, 'utf8');
        
        // Special handling for remove_lawyer_assigned_column.sql
        if (file === 'remove_lawyer_assigned_column.sql') {
          // Check if column exists first
          const [columns] = await db.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'cases' 
            AND COLUMN_NAME = 'lawyer_assigned'
          `);
          
          if (columns.length === 0) {
            global.logger.info('Column lawyer_assigned already removed, skipping migration');
            continue;
          }
          
          // Try to drop foreign key
          try {
            await db.execute('ALTER TABLE cases DROP FOREIGN KEY cases_ibfk_1');
          } catch (err) {
            // Ignore error if foreign key doesn't exist
            global.logger.info('Foreign key cases_ibfk_1 does not exist or already dropped');
          }
          
          // Try to drop column
          try {
            await db.execute('ALTER TABLE cases DROP COLUMN lawyer_assigned');
            global.logger.info('Successfully removed lawyer_assigned column');
          } catch (err) {
            global.logger.error('Error dropping lawyer_assigned column:', err.message);
          }
        } else {
          // For other migrations, split by semicolon and execute each statement
          const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
            
          for (const statement of statements) {
            try {
              await db.execute(statement);
            } catch (err) {
              // Log error but continue with other statements
              global.logger.error(`Error executing statement: ${err.message}`);
              if (!statement.includes('IF NOT EXISTS') && !statement.includes('IF EXISTS')) {
                // Only throw if it's not a conditional statement
                throw err;
              }
            }
          }
        }
        
        global.logger.info(`Migration ${file} completed successfully`);
      } catch (error) {
        global.logger.error(`Error running migration ${file}:`, error);
        // Don't stop on migration errors, continue with others
      }
    }
  } catch (error) {
    global.logger.error('Error reading migrations directory:', error);
  }
};

module.exports = { initDatabase, runMigrations };