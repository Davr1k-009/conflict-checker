# Production Deployment Guide

## Windows Server 2016 Deployment

### Prerequisites

1. **Install Required Software**
   - Node.js 16+ (download from nodejs.org)
   - MySQL 5.7+ (download MySQL Installer)
   - IIS with URL Rewrite and ARR modules
   - Git (optional, for cloning repository)

### Step-by-Step Deployment

#### 1. Prepare the Server

```powershell
# Create application directory
mkdir C:\inetpub\conflict-checker
cd C:\inetpub\conflict-checker

# Copy application files
# (Copy your backend and frontend folders here)
```

#### 2. Setup MySQL Database

1. Open MySQL Workbench or command line
2. Create database and user:

```sql
CREATE DATABASE conflict_checker;
CREATE USER 'conflict_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON conflict_checker.* TO 'conflict_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. Configure Backend

```powershell
cd C:\inetpub\conflict-checker\backend

# Install dependencies
npm install --production

# Create .env file
copy .env.example .env
```

Edit `.env` file:
```env
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_USER=conflict_user
DB_PASSWORD=your_secure_password
DB_NAME=conflict_checker
JWT_SECRET=your-very-long-random-string-here
JWT_REFRESH_SECRET=another-very-long-random-string-here
FRONTEND_URL=http://your-server-name
```

```powershell
# Initialize database
node src/utils/initDatabase.js

# Install PM2 globally
npm install -g pm2
npm install -g pm2-windows-startup

# Start the application
pm2 start server.js --name conflict-checker-backend
pm2 save
pm2-startup install
```

#### 4. Build Frontend

```powershell
cd C:\inetpub\conflict-checker\frontend

# Install dependencies
npm install

# Create .env file
copy .env.example .env
```

Edit `.env` file:
```env
REACT_APP_API_URL=http://your-server-name/api
REACT_APP_SOCKET_URL=http://your-server-name
```

```powershell
# Build for production
npm run build
```

#### 5. Configure IIS

1. **Install IIS Features**
```powershell
# Run PowerShell as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpErrors, IIS-HttpRedirect, IIS-ApplicationDevelopment, IIS-HealthAndDiagnostics, IIS-HttpLogging, IIS-Security, IIS-RequestFiltering, IIS-Performance, IIS-WebServerManagementTools, IIS-ManagementConsole, IIS-IIS6ManagementCompatibility, IIS-Metabase
```

2. **Install URL Rewrite and ARR**
   - Download and install URL Rewrite 2.1 from Microsoft
   - Download and install Application Request Routing 3.0

3. **Create IIS Site**
   - Open IIS Manager
   - Right-click "Sites" → "Add Website"
   - Site name: `ConflictChecker`
   - Physical path: `C:\inetpub\conflict-checker\frontend\build`
   - Port: 80 (or 443 for HTTPS)

4. **Configure URL Rewrite for SPA**

Create `web.config` in frontend/build:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Reverse proxy for API -->
        <rule name="ReverseProxyInboundRule1" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:5000/api/{R:1}" />
        </rule>
        <!-- Reverse proxy for Socket.io -->
        <rule name="ReverseProxyInboundRule2" stopProcessing="true">
          <match url="^socket.io/(.*)" />
          <action type="Rewrite" url="http://localhost:5000/socket.io/{R:1}" />
        </rule>
        <!-- React Router -->
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
</configuration>
```

#### 6. Configure Firewall

```powershell
# Allow IIS through firewall
New-NetFirewallRule -DisplayName "IIS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "IIS HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

#### 7. Setup SSL Certificate (Optional but Recommended)

1. Obtain SSL certificate (Let's Encrypt, commercial CA, or self-signed)
2. Install certificate in IIS
3. Update site bindings to use HTTPS
4. Update frontend .env to use https:// URLs

### Monitoring and Maintenance

#### PM2 Monitoring

```powershell
# View application status
pm2 status

# View logs
pm2 logs conflict-checker-backend

# Monitor resources
pm2 monit

# Restart application
pm2 restart conflict-checker-backend
```

#### Database Backup

Create scheduled task for daily backups:

```batch
@echo off
set BACKUP_PATH=C:\backups\mysql
set TIMESTAMP=%DATE:~-4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
mysqldump -u conflict_user -pyour_secure_password conflict_checker > "%BACKUP_PATH%\conflict_checker_%TIMESTAMP%.sql"
```

#### Log Rotation

Configure PM2 log rotation:

```powershell
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Performance Optimization

1. **Enable IIS Compression**
   - In IIS Manager, select server
   - Open "Compression"
   - Enable static and dynamic compression

2. **Configure Caching**
   
Add to web.config:
```xml
<system.webServer>
  <staticContent>
    <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" />
  </staticContent>
</system.webServer>
```

3. **MySQL Optimization**

Edit my.ini:
```ini
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_method = O_DIRECT
innodb_file_per_table = 1
query_cache_type = 1
query_cache_size = 128M
```

### Security Hardening

1. **Remove Default Pages**
```powershell
Remove-Item C:\inetpub\wwwroot\* -Recurse
```

2. **Disable Directory Browsing**
   - In IIS Manager, select site
   - Open "Directory Browsing"
   - Click "Disable"

3. **Configure Request Filtering**
   - Set maximum URL length
   - Set maximum query string length
   - Block suspicious file extensions

4. **Enable Failed Request Tracing**
   - Helps diagnose issues
   - Monitor for attacks

### Troubleshooting

#### Application Won't Start
```powershell
# Check PM2 logs
pm2 logs conflict-checker-backend --lines 100

# Test database connection
node -e "require('./src/config/database')"

# Check port availability
netstat -an | findstr :5000
```

#### IIS Issues
1. Check Event Viewer → Windows Logs → Application
2. Enable Failed Request Tracing
3. Check IIS logs in `C:\inetpub\logs\LogFiles`

#### Performance Issues
1. Monitor with PM2: `pm2 monit`
2. Check MySQL slow query log
3. Use Windows Performance Monitor

### Backup and Recovery

#### Full Backup Script

```powershell
# backup.ps1
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = "C:\backups\conflict-checker"

# Backup database
mysqldump -u conflict_user -pyour_secure_password conflict_checker > "$backupRoot\db\conflict_checker_$date.sql"

# Backup uploaded files
Copy-Item -Path "C:\inetpub\conflict-checker\backend\uploads" -Destination "$backupRoot\uploads_$date" -Recurse

# Backup configuration
Copy-Item -Path "C:\inetpub\conflict-checker\backend\.env" -Destination "$backupRoot\config\backend_env_$date"
Copy-Item -Path "C:\inetpub\conflict-checker\frontend\.env" -Destination "$backupRoot\config\frontend_env_$date"

# Compress backup
Compress-Archive -Path "$backupRoot\*_$date*" -DestinationPath "$backupRoot\full_backup_$date.zip"

# Clean up old backups (keep last 30 days)
Get-ChildItem -Path $backupRoot -Filter "full_backup_*.zip" | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

Schedule this script to run daily using Task Scheduler.

### Updates and Maintenance

#### Updating the Application

1. **Backup everything first**
2. **Update Backend**:
```powershell
cd C:\inetpub\conflict-checker\backend
pm2 stop conflict-checker-backend
git pull  # or copy new files
npm install --production
pm2 start conflict-checker-backend
```

3. **Update Frontend**:
```powershell
cd C:\inetpub\conflict-checker\frontend
git pull  # or copy new files
npm install
npm run build
# New build is automatically served by IIS
```

#### Monthly Maintenance Checklist

- [ ] Review and archive old logs
- [ ] Check disk space
- [ ] Verify backups are working
- [ ] Update Node.js dependencies (test first!)
- [ ] Review security logs
- [ ] Test restore procedure
- [ ] Update SSL certificates if needed

### Support

For production issues:
1. Check PM2 logs first
2. Review Windows Event Viewer
3. Check IIS logs
4. Enable debug logging if needed

For database issues:
1. Check MySQL error log
2. Verify connections with MySQL Workbench
3. Check for locked tables
4. Monitor slow queries