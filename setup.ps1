# Conflict Checker - PowerShell Setup Script
# Требует PowerShell 5.0+

param(
    [string]$BackendPort = "5001",
    [string]$FrontendPort = "3000",
    [string]$DbName = "conflict_checker",
    [string]$DbUser = "root",
    [string]$DbPassword = "",
    [switch]$SkipDbCreation,
    [switch]$Silent
)

# Настройка цветов
$Host.UI.RawUI.WindowTitle = "Conflict Checker Setup"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success($message) {
    Write-Host "[OK] " -ForegroundColor Green -NoNewline
    Write-Host $message
}

function Write-Error($message) {
    Write-Host "[ОШИБКА] " -ForegroundColor Red -NoNewline
    Write-Host $message
}

function Write-Warning($message) {
    Write-Host "[ПРЕДУПРЕЖДЕНИЕ] " -ForegroundColor Yellow -NoNewline
    Write-Host $message
}

function Write-Info($message) {
    Write-Host "[INFO] " -ForegroundColor Cyan -NoNewline
    Write-Host $message
}

Clear-Host
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   Conflict Checker Setup v2.0" -ForegroundColor White
Write-Host "   PowerShell Edition" -ForegroundColor Gray
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host

# Проверка версии PowerShell
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Error "Требуется PowerShell 5.0 или выше"
    exit 1
}

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Warning "Рекомендуется запустить от имени администратора"
}

# Проверка зависимостей
Write-Host "Проверка зависимостей..." -ForegroundColor Yellow
Write-Host

# Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js $nodeVersion найден"
    } else {
        throw
    }
} catch {
    Write-Error "Node.js не установлен!"
    Write-Host "Скачайте с: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# npm
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Success "npm v$npmVersion найден"
    }
} catch {
    Write-Error "npm не найден!"
    exit 1
}

# MySQL
$mysqlFound = $false
try {
    $mysqlVersion = mysql --version 2>$null
    if ($mysqlVersion) {
        Write-Success "MySQL найден"
        $mysqlFound = $true
    }
} catch {
    Write-Warning "MySQL не найден в PATH"
    Write-Host "Если MySQL установлен, добавьте путь к mysql.exe в PATH" -ForegroundColor Yellow
}

Write-Host
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   Параметры установки" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host

# Интерактивный режим
if (-not $Silent) {
    $input = Read-Host "Backend порт [$BackendPort]"
    if ($input) { $BackendPort = $input }
    
    $input = Read-Host "Frontend порт [$FrontendPort]"
    if ($input) { $FrontendPort = $input }
    
    $input = Read-Host "Имя базы данных [$DbName]"
    if ($input) { $DbName = $input }
    
    $input = Read-Host "MySQL пользователь [$DbUser]"
    if ($input) { $DbUser = $input }
    
    if (-not $DbPassword) {
        $securePassword = Read-Host "MySQL пароль" -AsSecureString
        $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
    }
}

Write-Host
Write-Info "Backend порт: $BackendPort"
Write-Info "Frontend порт: $FrontendPort"
Write-Info "База данных: $DbName"
Write-Info "MySQL пользователь: $DbUser"

Write-Host
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   Установка" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host

# Проверка package.json
if (-not (Test-Path "package.json")) {
    Write-Error "package.json не найден в текущей директории!"
    exit 1
}

# Установка корневых зависимостей
Write-Info "Установка корневых зависимостей..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Не удалось установить корневые зависимости"
    exit 1
}
Write-Success "Корневые зависимости установлены"

# Backend setup
Write-Host
Write-Host "Backend Setup" -ForegroundColor Yellow
Write-Host "-------------" -ForegroundColor Gray

Set-Location backend

# Создание директорий
Write-Info "Создание директорий..."
$directories = @(
    "uploads",
    "uploads\documents",
    "uploads\letterheads",
    "uploads\temp",
    "backups",
    "logs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Создана папка $dir"
    }
}

# Создание .gitkeep файлов
@("uploads", "backups", "logs") | ForEach-Object {
    if (-not (Test-Path "$_\.gitkeep")) {
        New-Item -ItemType File -Path "$_\.gitkeep" -Force | Out-Null
    }
}

# Создание .env файла
Write-Info "Создание .env файла..."
$envContent = @"
# Server Configuration
PORT=$BackendPort
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=$DbUser
DB_PASSWORD=$DbPassword
DB_NAME=$DbName

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(Get-Random)
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-$(Get-Random)

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:$FrontendPort

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Backup Configuration
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8
Write-Success ".env файл создан"

# Установка backend зависимостей
Write-Info "Установка backend зависимостей..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Не удалось установить backend зависимости"
    exit 1
}
Write-Success "Backend зависимости установлены"

# База данных
if ($mysqlFound -and -not $SkipDbCreation) {
    Write-Host
    Write-Host "Database Setup" -ForegroundColor Yellow
    Write-Host "--------------" -ForegroundColor Gray
    
    $createDb = "y"
    if (-not $Silent) {
        $createDb = Read-Host "Создать базу данных $DbName? (y/n) [y]"
        if (-not $createDb) { $createDb = "y" }
    }
    
    if ($createDb -eq "y") {
        Write-Info "Создание базы данных..."
        
        $sqlScript = @"
CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE $DbName;

-- Базовые таблицы будут созданы через миграции
"@
        
        $sqlScript | Out-File -FilePath "init_db.sql" -Encoding utf8
        
        try {
            if ($DbPassword) {
                mysql -u $DbUser -p$DbPassword < init_db.sql 2>$null
            } else {
                mysql -u $DbUser < init_db.sql 2>$null
            }
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "База данных создана"
                
                # Запуск миграций
                Write-Info "Применение миграций..."
                npm run migrate
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Миграции применены"
                } else {
                    Write-Warning "Некоторые миграции не применились"
                }
            } else {
                Write-Error "Не удалось создать базу данных"
            }
        } finally {
            Remove-Item "init_db.sql" -Force -ErrorAction SilentlyContinue
        }
    }
}

Set-Location ..

# Frontend setup
Write-Host
Write-Host "Frontend Setup" -ForegroundColor Yellow
Write-Host "--------------" -ForegroundColor Gray

Set-Location frontend

# Создание .env файла
Write-Info "Создание .env файла..."
$frontendEnv = @"
REACT_APP_API_URL=http://localhost:$BackendPort/api
REACT_APP_SOCKET_URL=http://localhost:$BackendPort
"@

$frontendEnv | Out-File -FilePath ".env" -Encoding utf8
Write-Success ".env файл создан"

# Установка frontend зависимостей
Write-Info "Установка frontend зависимостей..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Не удалось установить frontend зависимости"
    exit 1
}
Write-Success "Frontend зависимости установлены"

Set-Location ..

# Создание скриптов запуска
Write-Host
Write-Host "Создание скриптов запуска..." -ForegroundColor Yellow

# start-dev.ps1
@"
# Запуск Conflict Checker
Write-Host "Запуск Conflict Checker..." -ForegroundColor Green
Write-Host "Backend: http://localhost:$BackendPort" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host
npm start
"@ | Out-File -FilePath "start-dev.ps1" -Encoding utf8

# start-backend.ps1
@"
Set-Location backend
npm run dev
"@ | Out-File -FilePath "start-backend.ps1" -Encoding utf8

# start-frontend.ps1
@"
Set-Location frontend
npm start
"@ | Out-File -FilePath "start-frontend.ps1" -Encoding utf8

Write-Success "Скрипты созданы"

# Финальное сообщение
Write-Host
Write-Host "=====================================" -ForegroundColor Green
Write-Host "   Установка завершена!" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Green
Write-Host
Write-Host "Информация о проекте:" -ForegroundColor Cyan
Write-Host "- Backend: http://localhost:$BackendPort" -ForegroundColor White
Write-Host "- Frontend: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "- База данных: $DbName" -ForegroundColor White
Write-Host
Write-Host "Команды для запуска:" -ForegroundColor Cyan
Write-Host "- Оба сервера: " -NoNewline
Write-Host ".\start-dev.ps1" -ForegroundColor Yellow
Write-Host "- Только backend: " -NoNewline
Write-Host ".\start-backend.ps1" -ForegroundColor Yellow
Write-Host "- Только frontend: " -NoNewline
Write-Host ".\start-frontend.ps1" -ForegroundColor Yellow
Write-Host
Write-Host "Учетные данные по умолчанию:" -ForegroundColor Cyan
Write-Host "Логин: " -NoNewline
Write-Host "admin" -ForegroundColor Yellow
Write-Host "Пароль: " -NoNewline
Write-Host "admin123" -ForegroundColor Yellow
Write-Host
Write-Host "ВАЖНО: " -ForegroundColor Red -NoNewline
Write-Host "Обновите пароль администратора после первого входа!" -ForegroundColor White
Write-Host

if (-not $Silent) {
    Write-Host "Нажмите любую клавишу для завершения..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}