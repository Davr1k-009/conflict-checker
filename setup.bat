@echo off
REM Conflict Checker - Windows Setup Script v2.0
REM Обновленный установщик для проекта Конфликт интересов

setlocal enabledelayedexpansion

echo =====================================
echo    Conflict Checker Setup v2.0
echo    Установщик для Windows
echo =====================================
echo.

REM Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ВНИМАНИЕ: Рекомендуется запустить от имени администратора
    echo.
)

REM Проверка Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo Скачайте и установите Node.js 16+ с https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% найден

REM Проверка npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm не найден!
    pause
    exit /b 1
)

REM Проверка MySQL
where mysql >nul 2>nul
if %errorlevel% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] MySQL не найден в PATH
    echo Убедитесь что MySQL установлен: https://dev.mysql.com/downloads/installer/
    echo Если MySQL установлен, добавьте путь к mysql.exe в переменную PATH
    echo.
    set MYSQL_FOUND=0
) else (
    echo [OK] MySQL найден
    set MYSQL_FOUND=1
)

echo.
echo =====================================
echo    Настройка параметров
echo =====================================
echo.

REM Запрос параметров установки
set /p BACKEND_PORT="Backend порт [5001]: "
if "%BACKEND_PORT%"=="" set BACKEND_PORT=5001

set /p FRONTEND_PORT="Frontend порт [3000]: "
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=3000

set /p DB_NAME="Имя базы данных [conflict_checker]: "
if "%DB_NAME%"=="" set DB_NAME=conflict_checker

set /p DB_USER="MySQL пользователь [root]: "
if "%DB_USER%"=="" set DB_USER=root

set /p DB_PASSWORD="MySQL пароль: "

echo.
echo =====================================
echo    Создание структуры проекта
echo =====================================
echo.

REM Установка зависимостей корневого проекта
if exist package.json (
    echo Установка корневых зависимостей...
    call npm install
) else (
    echo [ОШИБКА] package.json не найден в корневой директории!
    pause
    exit /b 1
)

REM Backend setup
echo.
echo =====================================
echo    Настройка Backend
echo =====================================
echo.

cd backend

REM Создание необходимых директорий
echo Создание директорий...
if not exist uploads mkdir uploads
if not exist uploads\documents mkdir uploads\documents
if not exist uploads\letterheads mkdir uploads\letterheads
if not exist uploads\temp mkdir uploads\temp
if not exist backups mkdir backups
if not exist logs mkdir logs
echo. > uploads\.gitkeep
echo. > backups\.gitkeep
echo. > logs\.gitkeep

REM Создание .env файла
echo Создание .env файла...
(
    echo # Server Configuration
    echo PORT=%BACKEND_PORT%
    echo NODE_ENV=development
    echo.
    echo # Database Configuration
    echo DB_HOST=localhost
    echo DB_USER=%DB_USER%
    echo DB_PASSWORD=%DB_PASSWORD%
    echo DB_NAME=%DB_NAME%
    echo.
    echo # JWT Configuration
    echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-%RANDOM%
    echo JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-%RANDOM%
    echo.
    echo # Frontend URL ^(for CORS^)
    echo FRONTEND_URL=http://localhost:%FRONTEND_PORT%
    echo.
    echo # File Upload Configuration
    echo MAX_FILE_SIZE=10485760
    echo UPLOAD_DIR=./uploads
    echo.
    echo # Backup Configuration
    echo BACKUP_DIR=./backups
    echo BACKUP_RETENTION_DAYS=30
) > .env

echo [OK] .env файл создан

REM Установка backend зависимостей
echo.
echo Установка backend зависимостей...
call npm install

if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить backend зависимости
    pause
    exit /b 1
)

REM Создание и настройка базы данных
if "%MYSQL_FOUND%"=="1" (
    echo.
    echo =====================================
    echo    Настройка базы данных
    echo =====================================
    echo.
    
    set /p CREATE_DB="Создать базу данных %DB_NAME%? (y/n) [y]: "
    if /i "!CREATE_DB!"=="" set CREATE_DB=y
    
    if /i "!CREATE_DB!"=="y" (
        echo Создание базы данных...
        
        REM Создание SQL файла для инициализации
        (
            echo CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            echo USE %DB_NAME%;
            echo.
            echo -- Создание таблицы пользователей
            echo CREATE TABLE IF NOT EXISTS users ^(
            echo   id INT AUTO_INCREMENT PRIMARY KEY,
            echo   username VARCHAR^(50^) UNIQUE NOT NULL,
            echo   password VARCHAR^(255^) NOT NULL,
            echo   role ENUM^('admin', 'lawyer', 'user'^) DEFAULT 'user',
            echo   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            echo   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            echo ^) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            echo.
            echo -- Создание таблицы дел
            echo CREATE TABLE IF NOT EXISTS cases ^(
            echo   id INT AUTO_INCREMENT PRIMARY KEY,
            echo   case_number VARCHAR^(100^) UNIQUE NOT NULL,
            echo   case_type VARCHAR^(50^),
            echo   client_name VARCHAR^(255^) NOT NULL,
            echo   client_inn VARCHAR^(20^),
            echo   client_type ENUM^('legal', 'individual'^) DEFAULT 'legal',
            echo   client_pinfl VARCHAR^(20^),
            echo   opponent_name VARCHAR^(255^),
            echo   opponent_inn VARCHAR^(20^),
            echo   opponent_type ENUM^('legal', 'individual'^) DEFAULT 'legal',
            echo   opponent_pinfl VARCHAR^(20^),
            echo   description TEXT,
            echo   created_by INT,
            echo   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            echo   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            echo   FOREIGN KEY ^(created_by^) REFERENCES users^(id^)
            echo ^) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            echo.
            echo -- Создание таблицы проверок конфликтов
            echo CREATE TABLE IF NOT EXISTS conflict_checks ^(
            echo   id INT AUTO_INCREMENT PRIMARY KEY,
            echo   case_id INT,
            echo   conflict_level VARCHAR^(20^),
            echo   conflict_reasons JSON,
            echo   conflicting_cases JSON,
            echo   recommendations JSON,
            echo   checked_by INT,
            echo   checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            echo   FOREIGN KEY ^(case_id^) REFERENCES cases^(id^) ON DELETE CASCADE,
            echo   FOREIGN KEY ^(checked_by^) REFERENCES users^(id^)
            echo ^) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            echo.
            echo -- Вставка администратора по умолчанию
            echo -- Пароль: admin123
            echo INSERT INTO users ^(username, password, role^) VALUES 
            echo ^('admin', '$2b$10$YourHashedPasswordHere', 'admin'^)
            echo ON DUPLICATE KEY UPDATE username=username;
        ) > init_db.sql
        
        mysql -u %DB_USER% -p%DB_PASSWORD% < init_db.sql
        
        if %errorlevel% neq 0 (
            echo [ОШИБКА] Не удалось создать базу данных
            echo Проверьте данные подключения и попробуйте снова
        ) else (
            echo [OK] База данных создана
            
            REM Запуск миграций
            echo Запуск миграций...
            call npm run migrate
            
            if %errorlevel% neq 0 (
                echo [ПРЕДУПРЕЖДЕНИЕ] Некоторые миграции не удалось применить
            ) else (
                echo [OK] Миграции применены
            )
        )
        
        del init_db.sql
    )
)

cd ..

REM Frontend setup
echo.
echo =====================================
echo    Настройка Frontend
echo =====================================
echo.

cd frontend

REM Создание .env файла
echo Создание .env файла...
(
    echo REACT_APP_API_URL=http://localhost:%BACKEND_PORT%/api
    echo REACT_APP_SOCKET_URL=http://localhost:%BACKEND_PORT%
) > .env

echo [OK] .env файл создан

REM Установка frontend зависимостей
echo.
echo Установка frontend зависимостей...
call npm install

if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить frontend зависимости
    pause
    exit /b 1
)

cd ..

REM Создание скриптов запуска
echo.
echo =====================================
echo    Создание скриптов запуска
echo =====================================
echo.

REM start-dev.bat
echo Создание start-dev.bat...
(
    echo @echo off
    echo echo Запуск Conflict Checker в режиме разработки...
    echo echo.
    echo echo Backend: http://localhost:%BACKEND_PORT%
    echo echo Frontend: http://localhost:%FRONTEND_PORT%
    echo echo.
    echo call npm start
) > start-dev.bat

REM start-backend.bat
echo Создание start-backend.bat...
(
    echo @echo off
    echo cd backend
    echo npm run dev
) > start-backend.bat

REM start-frontend.bat
echo Создание start-frontend.bat...
(
    echo @echo off
    echo cd frontend
    echo npm start
) > start-frontend.bat

echo [OK] Скрипты созданы

echo.
echo =====================================
echo    Установка завершена!
echo =====================================
echo.
echo Информация о проекте:
echo - Backend порт: %BACKEND_PORT%
echo - Frontend порт: %FRONTEND_PORT%
echo - База данных: %DB_NAME%
echo.
echo Команды для запуска:
echo - Оба сервера: start-dev.bat
echo - Только backend: start-backend.bat
echo - Только frontend: start-frontend.bat
echo.
echo Учетные данные по умолчанию:
echo Логин: admin
echo Пароль: admin123
echo.
echo ВАЖНО: Обновите пароль администратора после первого входа!
echo.
echo Дополнительные команды:
echo - cd backend ^&^& npm run migrate - запуск миграций
echo - cd backend ^&^& npm run init-db - инициализация БД
echo.
pause