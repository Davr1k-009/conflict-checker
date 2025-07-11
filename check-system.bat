@echo off
REM Conflict Checker - System Check Script
REM Скрипт для проверки состояния системы и диагностики проблем

setlocal enabledelayedexpansion

echo =====================================
echo    Conflict Checker System Check
echo    Диагностика системы
echo =====================================
echo.

set ERRORS=0
set WARNINGS=0

REM Проверка Node.js
echo [1/10] Проверка Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo       [X] Node.js не установлен
    set /a ERRORS+=1
) else (
    for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
    echo       [OK] Node.js !NODE_VERSION!
    
    REM Проверка версии
    for /f "tokens=2 delims=v." %%i in ('node -v') do set MAJOR=%%i
    if !MAJOR! LSS 16 (
        echo       [!] Рекомендуется Node.js 16+
        set /a WARNINGS+=1
    )
)

REM Проверка npm
echo [2/10] Проверка npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo       [X] npm не найден
    set /a ERRORS+=1
) else (
    for /f "tokens=1" %%i in ('npm -v') do set NPM_VERSION=%%i
    echo       [OK] npm v!NPM_VERSION!
)

REM Проверка MySQL
echo [3/10] Проверка MySQL...
where mysql >nul 2>nul
if %errorlevel% neq 0 (
    echo       [!] MySQL не найден в PATH
    set /a WARNINGS+=1
) else (
    echo       [OK] MySQL найден
)

REM Проверка структуры проекта
echo [4/10] Проверка структуры проекта...
set PROJECT_OK=1
if not exist package.json (
    echo       [X] package.json не найден
    set PROJECT_OK=0
    set /a ERRORS+=1
)
if not exist backend\package.json (
    echo       [X] backend\package.json не найден
    set PROJECT_OK=0
    set /a ERRORS+=1
)
if not exist frontend\package.json (
    echo       [X] frontend\package.json не найден
    set PROJECT_OK=0
    set /a ERRORS+=1
)
if !PROJECT_OK!==1 (
    echo       [OK] Структура проекта корректна
)

REM Проверка .env файлов
echo [5/10] Проверка конфигурации...
set CONFIG_OK=1
if not exist backend\.env (
    echo       [X] backend\.env не найден
    set CONFIG_OK=0
    set /a ERRORS+=1
) else (
    REM Проверка ключевых параметров
    findstr /C:"DB_HOST" backend\.env >nul || (
        echo       [!] DB_HOST не настроен
        set /a WARNINGS+=1
    )
    findstr /C:"JWT_SECRET=your-super-secret" backend\.env >nul && (
        echo       [!] JWT_SECRET использует значение по умолчанию
        set /a WARNINGS+=1
    )
)
if not exist frontend\.env (
    echo       [X] frontend\.env не найден
    set CONFIG_OK=0
    set /a ERRORS+=1
)
if !CONFIG_OK!==1 (
    echo       [OK] Конфигурационные файлы найдены
)

REM Проверка node_modules
echo [6/10] Проверка зависимостей...
set DEPS_OK=1
if not exist node_modules (
    echo       [!] Корневые зависимости не установлены
    set DEPS_OK=0
    set /a WARNINGS+=1
)
if not exist backend\node_modules (
    echo       [!] Backend зависимости не установлены
    set DEPS_OK=0
    set /a WARNINGS+=1
)
if not exist frontend\node_modules (
    echo       [!] Frontend зависимости не установлены
    set DEPS_OK=0
    set /a WARNINGS+=1
)
if !DEPS_OK!==1 (
    echo       [OK] Все зависимости установлены
)

REM Проверка директорий
echo [7/10] Проверка директорий...
set DIRS_OK=1
if not exist backend\uploads (
    echo       [!] backend\uploads не существует
    set /a WARNINGS+=1
    set DIRS_OK=0
)
if not exist backend\backups (
    echo       [!] backend\backups не существует
    set /a WARNINGS+=1
    set DIRS_OK=0
)
if not exist backend\logs (
    echo       [!] backend\logs не существует
    set /a WARNINGS+=1
    set DIRS_OK=0
)
if !DIRS_OK!==1 (
    echo       [OK] Все директории созданы
)

REM Проверка портов
echo [8/10] Проверка портов...
set PORT_BACKEND=5001
set PORT_FRONTEND=3000

if exist backend\.env (
    for /f "tokens=2 delims==" %%i in ('findstr /C:"PORT=" backend\.env') do set PORT_BACKEND=%%i
)

netstat -an | findstr ":!PORT_BACKEND!" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo       [!] Порт !PORT_BACKEND! уже используется
    set /a WARNINGS+=1
) else (
    echo       [OK] Backend порт !PORT_BACKEND! свободен
)

netstat -an | findstr ":!PORT_FRONTEND!" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo       [!] Порт !PORT_FRONTEND! уже используется
    set /a WARNINGS+=1
) else (
    echo       [OK] Frontend порт !PORT_FRONTEND! свободен
)

REM Проверка подключения к БД
echo [9/10] Проверка базы данных...
if exist backend\.env (
    set DB_CHECK=0
    for /f "tokens=2 delims==" %%i in ('findstr /C:"DB_HOST=" backend\.env') do set DB_HOST=%%i
    for /f "tokens=2 delims==" %%i in ('findstr /C:"DB_USER=" backend\.env') do set DB_USER=%%i
    for /f "tokens=2 delims==" %%i in ('findstr /C:"DB_PASSWORD=" backend\.env') do set DB_PASSWORD=%%i
    for /f "tokens=2 delims==" %%i in ('findstr /C:"DB_NAME=" backend\.env') do set DB_NAME=%%i
    
    where mysql >nul 2>nul
    if %errorlevel% equ 0 (
        if "!DB_PASSWORD!"=="" (
            mysql -h !DB_HOST! -u !DB_USER! -e "SELECT 1" >nul 2>nul
        ) else (
            mysql -h !DB_HOST! -u !DB_USER! -p!DB_PASSWORD! -e "SELECT 1" >nul 2>nul
        )
        
        if !errorlevel! equ 0 (
            echo       [OK] Подключение к MySQL успешно
            
            REM Проверка существования БД
            if "!DB_PASSWORD!"=="" (
                mysql -h !DB_HOST! -u !DB_USER! -e "USE !DB_NAME!" >nul 2>nul
            ) else (
                mysql -h !DB_HOST! -u !DB_USER! -p!DB_PASSWORD! -e "USE !DB_NAME!" >nul 2>nul
            )
            
            if !errorlevel! neq 0 (
                echo       [!] База данных !DB_NAME! не существует
                set /a WARNINGS+=1
            ) else (
                echo       [OK] База данных !DB_NAME! найдена
            )
        ) else (
            echo       [X] Не удалось подключиться к MySQL
            set /a ERRORS+=1
        )
    ) else (
        echo       [!] MySQL не установлен, пропуск проверки БД
    )
)

REM Проверка миграций
echo [10/10] Проверка миграций...
if exist backend\migrations (
    set /a MIGRATION_COUNT=0
    for %%f in (backend\migrations\*.sql) do set /a MIGRATION_COUNT+=1
    echo       [OK] Найдено !MIGRATION_COUNT! файлов миграций
) else (
    echo       [!] Папка миграций не найдена
    set /a WARNINGS+=1
)

echo.
echo =====================================
echo    Результаты диагностики
echo =====================================
echo.

if !ERRORS! GTR 0 (
    echo Критических ошибок: !ERRORS!
    echo.
    echo Необходимые действия:
    if not exist package.json echo - Запустите скрипт из корневой папки проекта
    where node >nul 2>nul || echo - Установите Node.js 16+
    where npm >nul 2>nul || echo - Установите npm
    if not exist backend\.env echo - Запустите setup.bat для настройки
    if not exist frontend\.env echo - Запустите setup.bat для настройки
    echo.
)

if !WARNINGS! GTR 0 (
    echo Предупреждений: !WARNINGS!
    echo.
    echo Рекомендуемые действия:
    if not exist backend\node_modules echo - Запустите: cd backend ^&^& npm install
    if not exist frontend\node_modules echo - Запустите: cd frontend ^&^& npm install
    if not exist backend\uploads echo - Создайте папку backend\uploads
    if not exist backend\backups echo - Создайте папку backend\backups
    if not exist backend\logs echo - Создайте папку backend\logs
    echo.
)

if !ERRORS!==0 if !WARNINGS!==0 (
    echo [OK] Система готова к работе!
    echo.
    echo Для запуска используйте:
    echo - start-dev.bat (оба сервера)
    echo - start-backend.bat (только backend)
    echo - start-frontend.bat (только frontend)
)

echo.
pause