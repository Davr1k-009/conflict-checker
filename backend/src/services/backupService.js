const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const cron = require('node-cron');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.tempDir = path.join(__dirname, '../../temp');
    this.initDirectories();
  }

  async initDirectories() {
    // Create directories if they don't exist
    for (const dir of [this.backupDir, this.tempDir]) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  // Generate backup filename with timestamp
  generateBackupName() {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `backup_${timestamp}`;
  }

  // Create database dump
  async createDatabaseDump(filename) {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'conflict_checker'
    };

    const dumpFile = path.join(this.tempDir, `${filename}.sql`);
    
    // Build mysqldump command
    let command = `mysqldump -h ${dbConfig.host} -u ${dbConfig.user}`;
    if (dbConfig.password) {
      command += ` -p${dbConfig.password}`;
    }
    command += ` ${dbConfig.database} > "${dumpFile}"`;

    try {
      await execAsync(command);
      global.logger.info('Database dump created successfully', { file: dumpFile });
      return dumpFile;
    } catch (error) {
      global.logger.error('Failed to create database dump:', error);
      throw error;
    }
  }

  // Create full backup (database + uploads)
  async createFullBackup() {
    const backupName = this.generateBackupName();
    const zipPath = path.join(this.backupDir, `${backupName}.zip`);

    try {
      // Create database dump
      const dumpFile = await this.createDatabaseDump(backupName);

      // Create zip archive
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        output.on('close', async () => {
          // Clean up temp files
          try {
            await fs.unlink(dumpFile);
          } catch (error) {
            global.logger.warn('Failed to delete temp file:', error);
          }

          const stats = await fs.stat(zipPath);
          const backup = {
            filename: `${backupName}.zip`,
            path: zipPath,
            size: stats.size,
            createdAt: new Date()
          };

          global.logger.info('Backup created successfully', backup);
          resolve(backup);
        });

        archive.on('error', reject);
        archive.pipe(output);

        // Add database dump
        archive.file(dumpFile, { name: 'database.sql' });

        // Add uploads directory
        archive.directory(this.uploadsDir, 'uploads');

        // Add backup info
        const info = {
          version: '1.0',
          createdAt: new Date().toISOString(),
          database: process.env.DB_NAME,
          includesUploads: true
        };
        archive.append(JSON.stringify(info, null, 2), { name: 'backup-info.json' });

        archive.finalize();
      });
    } catch (error) {
      global.logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  // List all backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }

      return backups.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      global.logger.error('Failed to list backups:', error);
      return [];
    }
  }

  // Delete old backups (keep last N backups)
  async cleanupOldBackups(keepCount = 10) {
    try {
      const backups = await this.listBackups();
      
      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);
        
        for (const backup of toDelete) {
          const filePath = path.join(this.backupDir, backup.filename);
          await fs.unlink(filePath);
          global.logger.info('Deleted old backup:', backup.filename);
        }
      }
    } catch (error) {
      global.logger.error('Failed to cleanup old backups:', error);
    }
  }

  // Restore from backup
  async restoreFromBackup(backupFilePath) {
    const tempRestoreDir = path.join(this.tempDir, 'restore_' + Date.now());
    
    try {
      // Create temp directory for extraction
      await fs.mkdir(tempRestoreDir, { recursive: true });

      // Extract backup
      const extract = require('extract-zip');
      await extract(backupFilePath, { dir: tempRestoreDir });

      // Read backup info
      const infoPath = path.join(tempRestoreDir, 'backup-info.json');
      const info = JSON.parse(await fs.readFile(infoPath, 'utf8'));
      
      global.logger.info('Restoring backup:', info);

      // Restore database
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'conflict_checker'
      };

      const sqlFile = path.join(tempRestoreDir, 'database.sql');
      let command = `mysql -h ${dbConfig.host} -u ${dbConfig.user}`;
      if (dbConfig.password) {
        command += ` -p${dbConfig.password}`;
      }
      command += ` ${dbConfig.database} < "${sqlFile}"`;

      await execAsync(command);
      global.logger.info('Database restored successfully');

      // Restore uploads if included
      if (info.includesUploads) {
        const backupUploadsDir = path.join(tempRestoreDir, 'uploads');
        
        // Clear existing uploads
        await this.clearDirectory(this.uploadsDir);
        
        // Copy uploads from backup
        await this.copyDirectory(backupUploadsDir, this.uploadsDir);
        global.logger.info('Uploads restored successfully');
      }

      // Clean up temp directory
      await this.clearDirectory(tempRestoreDir);
      await fs.rmdir(tempRestoreDir);

      return { success: true, info };
    } catch (error) {
      global.logger.error('Failed to restore backup:', error);
      
      // Clean up on error
      try {
        await this.clearDirectory(tempRestoreDir);
        await fs.rmdir(tempRestoreDir);
      } catch (cleanupError) {
        global.logger.warn('Failed to cleanup temp directory:', cleanupError);
      }
      
      throw error;
    }
  }

  // Helper: Clear directory contents
  async clearDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await this.clearDirectory(filePath);
          await fs.rmdir(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      global.logger.warn('Error clearing directory:', error);
    }
  }

  // Helper: Copy directory recursively
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  // Schedule automatic backups
  scheduleAutoBackups() {
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      global.logger.info('Starting scheduled backup...');
      try {
        await this.createFullBackup();
        await this.cleanupOldBackups();
      } catch (error) {
        global.logger.error('Scheduled backup failed:', error);
      }
    });

    // Weekly backup on Sunday at 3 AM (keep more of these)
    cron.schedule('0 3 * * 0', async () => {
      global.logger.info('Starting weekly backup...');
      try {
        const backupName = this.generateBackupName() + '_weekly';
        const backup = await this.createFullBackup();
        // Rename to mark as weekly
        const newPath = backup.path.replace('.zip', '_weekly.zip');
        await fs.rename(backup.path, newPath);
      } catch (error) {
        global.logger.error('Weekly backup failed:', error);
      }
    });

    global.logger.info('Automatic backups scheduled');
  }
}

module.exports = new BackupService();