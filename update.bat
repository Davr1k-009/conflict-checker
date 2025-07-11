@echo off
REM Conflict Checker - Update Script
REM Скрипт для обновления существующей установки

echo =====================================
echo    Conflict Checker Update
echo    Обновление проекта
echo =====================================
echo.

REM Проверка наличия package.json
if not exist package.json (
    echo [ОШИБКА] package.json не найден!
    echo Запустите скрипт из корневой директории проекта
    pause
    exit /b 1
)

REM Сохранение .env файлов
echo Сохранение конфигурации...
if exist backend\.env (
    copy backend\.env backend\.env.backup >nul
    echo [OK] Backend .env сохранен
)
if exist frontend\.env (
    copy frontend\.env frontend\.env.backup >nul
    echo [OK] Frontend .env сохранен
)

echo.
echo =====================================
echo    Обновление зависимостей
echo =====================================
echo.

REM Обновление корневых зависимостей
echo Обновление корневых зависимостей...
call npm update

REM Обновление backend
echo.
echo Обновление backend...
cd backend
call npm update

REM Запуск миграций
echo.
echo Применение миграций базы данных...
call npm run migrate

if %errorlevel% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Некоторые миграции не применились
    echo Проверьте логи и примените вручную при необходимости
) else (
    echo [OK] Миграции применены
)

cd ..

REM Обновление frontend
echo.
echo Обновление frontend...
cd frontend
call npm update

REM Сборка frontend (опционально)
set /p BUILD_FRONTEND="Собрать production версию frontend? (y/n) [n]: "
if /i "%BUILD_FRONTEND%"=="y" (
    echo Сборка frontend...
    call npm run build
    
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось собрать frontend
    ) else (
        echo [OK] Frontend собран в папку build/
    )
)

cd ..

echo.
echo =====================================
echo    Проверка новых папок
echo =====================================
echo.

REM Создание новых папок если их нет
cd backend
if not exist uploads\letterheads (
    mkdir uploads\letterheads
    echo [OK] Создана папка uploads\letterheads
)
if not exist backups (
    mkdir backups
    echo. > backups\.gitkeep
    echo [OK] Создана папка backups
)
if not exist logs (
    mkdir logs
    echo. > logs\.gitkeep
    echo [OK] Создана папка logs
)
cd ..

echo.
echo =====================================
echo    Обновление завершено!
echo =====================================
echo.
echo Резервные копии конфигурации:
echo - backend\.env.backup
echo - frontend\.env.backup
echo.
echo Рекомендации:
echo 1. Проверьте .env файлы на наличие новых параметров
echo 2. Перезапустите серверы
echo 3. Проверьте работу приложения
echo.
pause