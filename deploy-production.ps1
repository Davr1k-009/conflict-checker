# Conflict Checker - Production Deployment Script
# Требует PowerShell 5.0+ и права администратора

param(
    [Parameter(Mandatory=$false)]
    [string]$ArchivePath,
    
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\inetpub\conflict-checker",
    
    [Parameter(Mandatory=$false)]
    [string]$IISSiteName = "ConflictChecker",
    
    [Parameter(Mandatory=$false)]
    [int]$IISPort = 80,
    
    [Parameter(Mandatory=$false)]
    [string]$BackendServiceName = "ConflictCheckerBackend",
    
    [switch]$InstallIIS,
    [switch]$InstallPM2,
    [switch]$CreateServices
)

# Проверка прав администратора
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Этот скрипт требует прав администратора!" -ForegroundColor Red
    exit 1
}

function Write-Step($message) {
    Write-Host "`n===== $message =====" -ForegroundColor Cyan
}

function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

Clear-Host
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Conflict Checker - Production Deployment" -ForegroundColor White
Write-Host "   Windows Server Configuration" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Green

# Поиск архива если не указан
if (-not $ArchivePath) {
    $archives = Get-ChildItem -Filter "conflict-checker-transfer-*.tar.gz" -File
    if ($archives.Count -eq 0) {
        Write-Host "Архив не найден! Укажите путь через -ArchivePath" -ForegroundColor Red
        exit 1
    }
    $ArchivePath = $archives[0].FullName
}

Write-Host "`nИспользуется архив: $ArchivePath" -ForegroundColor Yellow

# Шаг 1: Распаковка
Write-Step "Распаковка проекта"

if (Test-Path $InstallPath) {
    $confirm = Read-Host "$InstallPath уже существует. Удалить? (y/n)"
    if ($confirm -eq 'y') {
        Remove-Item $InstallPath -Recurse -Force
    } else {
        Write-Host "Установка отменена" -ForegroundColor Yellow
        exit
    }
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
tar -xzf $ArchivePath -C $InstallPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при распаковке!" -ForegroundColor Red
    exit 1
}

Set-Location $InstallPath

# Шаг 2: Восстановление конфигурации
Write-Step "Восстановление конфигурации"

if (Test-Path "backend\.env.example.transfer") {
    Copy-Item "backend\.env.example.transfer" "backend\.env" -Force
    Write-Host "backend\.env создан из примера" -ForegroundColor Green
}

if (Test-Path "frontend\.env.example.transfer") {
    # Обновляем URL для production
    $envContent = Get-Content "frontend\.env.example.transfer"
    $envContent = $envContent -replace "http://localhost:5001", "http://$env:COMPUTERNAME:5001"
    $envContent | Out-File "frontend\.env" -Encoding utf8
    Write-Host "frontend\.env создан и настроен" -ForegroundColor Green
}

# Шаг 3: Установка зависимостей Node.js
Write-Step "Установка зависимостей"

# Корневые зависимости
Write-Host "Установка корневых зависимостей..."
npm install --production

# Backend
Write-Host "`nУстановка backend зависимостей..."
Set-Location backend
npm install --production

# Frontend
Write-Host "`nУстановка frontend зависимостей..."
Set-Location ..\frontend
npm install

# Build frontend для production
Write-Host "`nСборка frontend для production..."
npm run build

if (-not (Test-Path "build")) {
    Write-Host "Ошибка при сборке frontend!" -ForegroundColor Red
    exit 1
}

Set-Location ..

# Шаг 4: Настройка IIS (опционально)
if ($InstallIIS) {
    Write-Step "Настройка IIS"
    
    # Установка IIS и необходимых компонентов
    $features = @(
        "IIS-WebServerRole",
        "IIS-WebServer",
        "IIS-CommonHttpFeatures",
        "IIS-StaticContent",
        "IIS-DefaultDocument",
        "IIS-DirectoryBrowsing",
        "IIS-HttpErrors",
        "IIS-HttpRedirect",
        "IIS-ApplicationDevelopment",
        "IIS-NetExtensibility45",
        "IIS-HealthAndDiagnostics",
        "IIS-HttpLogging",
        "IIS-Security",
        "IIS-RequestFiltering",
        "IIS-Performance",
        "IIS-WebServerManagementTools",
        "IIS-ManagementConsole",
        "IIS-IIS6ManagementCompatibility",
        "IIS-Metabase"
    )
    
    foreach ($feature in $features) {
        Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart | Out-Null
    }
    
    # Установка URL Rewrite Module
    Write-Host "Установка URL Rewrite Module..."
    $urlRewriteUrl = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
    $urlRewritePath = "$env:TEMP\urlrewrite2.msi"
    Invoke-WebRequest -Uri $urlRewriteUrl -OutFile $urlRewritePath
    Start-Process msiexec.exe -ArgumentList "/i `"$urlRewritePath`" /quiet" -Wait
    
    # Создание сайта в IIS
    Import-Module WebAdministration
    
    # Удаление существующего сайта если есть
    if (Get-Website -Name $IISSiteName -ErrorAction SilentlyContinue) {
        Remove-Website -Name $IISSiteName
    }
    
    # Создание нового сайта
    $frontendPath = Join-Path $InstallPath "frontend\build"
    New-Website -Name $IISSiteName -Port $IISPort -PhysicalPath $frontendPath
    
    # Создание web.config для React Router
    $webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
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
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
</configuration>
"@
    
    $webConfig | Out-File "$frontendPath\web.config" -Encoding utf8
    
    # Установка прав доступа
    $acl = Get-Acl $InstallPath
    $permission = "IIS_IUSRS","FullControl","ContainerInherit,ObjectInherit","None","Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    Set-Acl $InstallPath $acl
    
    Write-Host "IIS настроен. Сайт доступен на http://localhost:$IISPort" -ForegroundColor Green
}

# Шаг 5: Установка PM2 (опционально)
if ($InstallPM2) {
    Write-Step "Установка PM2"
    
    if (-not (Test-Command "pm2")) {
        Write-Host "Установка PM2 глобально..."
        npm install -g pm2
        npm install -g pm2-windows-startup
    }
    
    # Создание ecosystem.config.js
    $ecosystem = @"
module.exports = {
  apps: [{
    name: '$BackendServiceName',
    script: './backend/server.js',
    cwd: '$InstallPath',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    error_file: './backend/logs/pm2-error.log',
    out_file: './backend/logs/pm2-out.log',
    merge_logs: true,
    time: true
  }]
};
"@
    
    $ecosystem | Out-File "$InstallPath\ecosystem.config.js" -Encoding utf8
    
    # Запуск backend через PM2
    Set-Location $InstallPath
    pm2 start ecosystem.config.js
    pm2 save
    
    # Настройка автозапуска
    pm2-startup install
    
    Write-Host "PM2 настроен. Backend запущен как служба" -ForegroundColor Green
}

# Шаг 6: Создание Windows служб (альтернатива PM2)
if ($CreateServices -and -not $InstallPM2) {
    Write-Step "Создание Windows службы"
    
    # Установка node-windows
    Set-Location "$InstallPath\backend"
    npm install node-windows
    
    # Создание скрипта службы
    $serviceScript = @"
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: '$BackendServiceName',
  description: 'Conflict Checker Backend Service',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [{
    name: "NODE_ENV",
    value: "production"
  }, {
    name: "PORT",
    value: "5001"
  }]
});

svc.on('install', () => {
  console.log('Service installed');
  svc.start();
});

svc.on('start', () => {
  console.log('Service started');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

svc.install();
"@
    
    $serviceScript | Out-File "install-service.js" -Encoding utf8
    
    # Установка службы
    node install-service.js
    
    Write-Host "Windows служба создана и запущена" -ForegroundColor Green
}

# Шаг 7: Настройка файрвола
Write-Step "Настройка файрвола"

# Backend порт
New-NetFirewallRule -DisplayName "Conflict Checker Backend" `
    -Direction Inbound -Protocol TCP -LocalPort 5001 `
    -Action Allow -ErrorAction SilentlyContinue | Out-Null

# IIS порт если настроен
if ($InstallIIS) {
    New-NetFirewallRule -DisplayName "Conflict Checker Frontend" `
        -Direction Inbound -Protocol TCP -LocalPort $IISPort `
        -Action Allow -ErrorAction SilentlyContinue | Out-Null
}

Write-Host "Правила файрвола созданы" -ForegroundColor Green

# Шаг 8: Настройка планировщика задач
Write-Step "Настройка планировщика задач"

# Задача для резервного копирования
$backupAction = New-ScheduledTaskAction -Execute "node" `
    -Argument "$InstallPath\backend\src\services\backupService.js" `
    -WorkingDirectory "$InstallPath\backend"

$backupTrigger = New-ScheduledTaskTrigger -Daily -At 2am

Register-ScheduledTask -TaskName "ConflictChecker-Backup" `
    -Action $backupAction -Trigger $backupTrigger `
    -Description "Daily backup of Conflict Checker database" `
    -RunLevel Highest -ErrorAction SilentlyContinue | Out-Null

Write-Host "Задача резервного копирования создана" -ForegroundColor Green

# Шаг 9: Финальная проверка
Write-Step "Проверка установки"

$errors = 0

# Проверка backend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] Backend работает" -ForegroundColor Green
    }
} catch {
    Write-Host "[ОШИБКА] Backend не отвечает" -ForegroundColor Red
    $errors++
}

# Проверка frontend (если IIS настроен)
if ($InstallIIS) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$IISPort" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "[OK] Frontend доступен" -ForegroundColor Green
        }
    } catch {
        Write-Host "[ОШИБКА] Frontend не доступен" -ForegroundColor Red
        $errors++
    }
}

# Итоговая информация
Write-Host "`n================================================" -ForegroundColor Green
Write-Host "   Развертывание завершено!" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green

Write-Host "`nИнформация о системе:" -ForegroundColor Cyan
Write-Host "- Путь установки: $InstallPath" -ForegroundColor White
Write-Host "- Backend URL: http://${env:COMPUTERNAME}:5001" -ForegroundColor White

if ($InstallIIS) {
    Write-Host "- Frontend URL: http://${env:COMPUTERNAME}:$IISPort" -ForegroundColor White
}

if ($InstallPM2) {
    Write-Host "- PM2 Dashboard: pm2 monit" -ForegroundColor White
}

Write-Host "`nСледующие шаги:" -ForegroundColor Cyan
Write-Host "1. Настройте backend\.env с параметрами БД" -ForegroundColor Yellow
Write-Host "2. Запустите миграции: cd backend && npm run migrate" -ForegroundColor Yellow
Write-Host "3. Измените пароль администратора по умолчанию" -ForegroundColor Yellow

if ($errors -gt 0) {
    Write-Host "`n[ВНИМАНИЕ] Обнаружены ошибки при проверке!" -ForegroundColor Red
}

Write-Host "`nЛоги:" -ForegroundColor Cyan
Write-Host "- Backend: $InstallPath\backend\logs\" -ForegroundColor White
Write-Host "- IIS: C:\inetpub\logs\LogFiles\" -ForegroundColor White
Write-Host "- Windows Events: Event Viewer > Applications" -ForegroundColor White