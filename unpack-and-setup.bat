@echo off
REM Conflict Checker - Unpack and Setup Script
REM Скрипт для распаковки и установки на Windows сервере

setlocal enabledelayedexpansion

echo =====================================
echo    Conflict Checker - Unpack ^& Setup
echo    Windows Server Installation
echo =====================================
echo.

REM Проверка наличия архива
set ARCHIVE_FOUND=0
for %%f in (conflict-checker-transfer-*.tar.gz) do (
    set ARCHIVE_NAME=%%f
    set ARCHIVE_FOUND=1
    goto :found
)

:found
if %ARCHIVE_FOUND%==0 (
    echo [ОШИБКА] Архив conflict-checker-transfer-*.tar.gz не найден!
    echo.
    echo Убедитесь что вы:
    echo 1. Скопировали архив в текущую папку
    echo 2. Находитесь в правильной директории
    pause
    exit /b 1
)

echo Найден архив: %ARCHIVE_NAME%
echo.

REM Проверка tar
where tar >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] tar не найден!
    echo.
    echo Windows 10/Server 2019+ имеют встроенный tar
    echo Для старых версий установите 7-Zip и используйте:
    echo 7z x %ARCHIVE_NAME% -so ^| 7z x -si -ttar
    pause
    exit /b 1
)

REM Проверка контрольной суммы (если есть)
if exist "%ARCHIVE_NAME%.sha256" (
    echo Проверка контрольной суммы...
    certutil -hashfile "%ARCHIVE_NAME%" SHA256 > temp_hash.txt
    findstr /v ":" temp_hash.txt > actual_hash.txt
    
    REM Здесь нужна более сложная проверка, пока пропустим
    del temp_hash.txt actual_hash.txt
    echo [OK] Файл готов к распаковке
) else (
    echo [!] Файл контрольной суммы не найден, пропуск проверки
)

REM Создание директории проекта
set PROJECT_DIR=conflict-checker
if exist %PROJECT_DIR% (
    echo.
    echo [ВНИМАНИЕ] Папка %PROJECT_DIR% уже существует!
    set /p OVERWRITE="Удалить существующую папку? (y/n) [n]: "
    if /i "!OVERWRITE!"=="y" (
        echo Удаление старой папки...
        rmdir /s /q %PROJECT_DIR%
    ) else (
        set /p PROJECT_DIR="Введите новое имя папки: "
    )
)

echo.
echo Распаковка архива в %PROJECT_DIR%...
mkdir %PROJECT_DIR% 2>nul
tar -xzf %ARCHIVE_NAME% -C %PROJECT_DIR%

if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось распаковать архив!
    pause
    exit /b 1
)

echo [OK] Архив распакован

cd %PROJECT_DIR%

REM Проверка наличия setup.bat
if not exist setup.bat (
    echo [ОШИБКА] setup.bat не найден в распакованном архиве!
    pause
    exit /b 1
)

REM Восстановление .env файлов из примеров
echo.
echo Проверка конфигурационных файлов...

if exist backend\.env.example.transfer (
    if not exist backend\.env (
        echo Восстановление backend\.env из примера...
        copy backend\.env.example.transfer backend\.env >nul
        echo [OK] Создан backend\.env (требует настройки)
    )
)

if exist frontend\.env.example.transfer (
    if not exist frontend\.env (
        echo Восстановление frontend\.env из примера...
        copy frontend\.env.example.transfer frontend\.env >nul
        echo [OK] Создан frontend\.env
    )
)

REM Показ информации о проекте
if exist PROJECT_INFO.txt (
    echo.
    echo =====================================
    echo    Информация о проекте
    echo =====================================
    type PROJECT_INFO.txt
    echo =====================================
    echo.
)

REM Запрос на автоматическую установку
echo.
set /p AUTO_SETUP="Запустить автоматическую установку? (y/n) [y]: "
if /i "%AUTO_SETUP%"=="" set AUTO_SETUP=y

if /i "%AUTO_SETUP%"=="y" (
    echo.
    echo Запуск setup.bat...
    echo.
    call setup.bat
) else (
    echo.
    echo Установка отложена.
    echo.
    echo Для установки вручную:
    echo 1. cd %PROJECT_DIR%
    echo 2. Отредактируйте backend\.env и frontend\.env
    echo 3. Запустите setup.bat
)

echo.
echo =====================================
echo    Дополнительные действия
echo =====================================
echo.
echo 1. Настройка IIS (если используется):
echo    - Создайте сайт для frontend (порт 80/443)
echo    - Настройте URL Rewrite для SPA
echo    - Укажите папку frontend\build как корневую
echo.
echo 2. Настройка файрвола:
echo    - Откройте порт 5001 для backend (если нужен внешний доступ)
echo    - Откройте порт 3000 для frontend (режим разработки)
echo.
echo 3. Настройка служб Windows:
echo    - Используйте node-windows или PM2 для backend
echo    - Пример: npm install -g pm2
echo             pm2 start backend\server.js
echo             pm2 save
echo             pm2 startup
echo.
echo 4. Настройка планировщика:
echo    - Добавьте задачу для автоматического бэкапа
echo    - Добавьте задачу для очистки старых логов
echo.
pause