#!/bin/bash

# Скрипт подготовки проекта к переносу на Windows

echo "🚀 Подготовка Conflict Checker к переносу"
echo "========================================"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo -e "${RED}Ошибка: package.json не найден!${NC}"
    echo "Запустите скрипт из корневой папки проекта"
    exit 1
fi

echo -e "${YELLOW}1. Создание списка файлов для переноса...${NC}"

# Создание .transfer-ignore файла
cat > .transfer-ignore << 'EOF'
# Игнорировать при переносе
node_modules/
.env
.env.local
.DS_Store
*.log
uploads/documents/*
uploads/letterheads/*
uploads/temp/*
backups/*.zip
logs/*.log
dist/
build/
.git/
*.sqlite
*.db
EOF

echo -e "${GREEN}✓ Создан .transfer-ignore${NC}"

# Сохранение структуры .env файлов
echo -e "${YELLOW}2. Сохранение примеров конфигурации...${NC}"

# Backend .env example
if [ -f "backend/.env" ]; then
    cp backend/.env backend/.env.example.transfer
    # Очистка секретных данных
    sed -i '' 's/DB_PASSWORD=.*/DB_PASSWORD=/' backend/.env.example.transfer
    sed -i '' 's/JWT_SECRET=.*/JWT_SECRET=your-super-secret-jwt-key-change-this-in-production/' backend/.env.example.transfer
    sed -i '' 's/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production/' backend/.env.example.transfer
    echo -e "${GREEN}✓ Создан backend/.env.example.transfer${NC}"
fi

# Frontend .env example
if [ -f "frontend/.env" ]; then
    cp frontend/.env frontend/.env.example.transfer
    echo -e "${GREEN}✓ Создан frontend/.env.example.transfer${NC}"
fi

# Создание информационного файла
echo -e "${YELLOW}3. Создание информации о проекте...${NC}"

cat > PROJECT_INFO.txt << EOF
Conflict Checker - Transfer Information
======================================

Дата создания архива: $(date)
Платформа источник: macOS ($(uname -r))
Node.js версия: $(node -v)
npm версия: $(npm -v)

Структура проекта:
- Backend порт: 5001 (см. backend/.env.example.transfer)
- Frontend порт: 3000
- База данных: MySQL

Файлы конфигурации:
- backend/.env.example.transfer - пример конфигурации backend
- frontend/.env.example.transfer - пример конфигурации frontend

После распаковки на Windows:
1. Запустите setup.bat
2. Введите параметры базы данных
3. Дождитесь завершения установки

Папки, которые будут созданы автоматически:
- node_modules (npm install)
- uploads/
- backups/
- logs/
EOF

echo -e "${GREEN}✓ Создан PROJECT_INFO.txt${NC}"

# Создание архива
echo -e "${YELLOW}4. Создание архива для переноса...${NC}"

ARCHIVE_NAME="conflict-checker-transfer-$(date +%Y%m%d-%H%M%S).tar.gz"

# Используем .transfer-ignore для исключения файлов
tar --exclude-from=.transfer-ignore -czf "../$ARCHIVE_NAME" .

if [ $? -eq 0 ]; then
    ARCHIVE_SIZE=$(ls -lh "../$ARCHIVE_NAME" | awk '{print $5}')
    echo -e "${GREEN}✓ Архив создан успешно!${NC}"
    echo ""
    echo "📦 Файл: ../$ARCHIVE_NAME"
    echo "📏 Размер: $ARCHIVE_SIZE"
    echo ""
    echo "Следующие шаги:"
    echo "1. Перенесите файл $ARCHIVE_NAME на Windows сервер"
    echo "2. Распакуйте архив"
    echo "3. Запустите setup.bat"
else
    echo -e "${RED}✗ Ошибка при создании архива${NC}"
    exit 1
fi

# Опционально: создание контрольной суммы
echo -e "${YELLOW}5. Создание контрольной суммы...${NC}"
shasum -a 256 "../$ARCHIVE_NAME" > "../$ARCHIVE_NAME.sha256"
echo -e "${GREEN}✓ Создан файл контрольной суммы${NC}"

# Очистка временных файлов
rm -f .transfer-ignore

echo ""
echo -e "${GREEN}✅ Подготовка завершена!${NC}"
echo ""
echo "Файлы для переноса:"
echo "- ../$ARCHIVE_NAME (основной архив)"
echo "- ../$ARCHIVE_NAME.sha256 (контрольная сумма)"
echo ""
echo "Способы переноса:"
echo "1. GitHub: git push и clone на Windows"
echo "2. Облако: загрузите в Google Drive/Dropbox"
echo "3. SCP: scp ../$ARCHIVE_NAME user@server:/path/"
echo "4. USB: скопируйте на флешку"
echo "5. Сетевая папка: через SMB"