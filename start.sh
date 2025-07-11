#!/bin/bash

echo "🚀 Запуск Conflict Checker..."

# Проверка MySQL
if ! pgrep -x "mysqld" > /dev/null; then
    echo "⚠️  MySQL не запущен. Запускаю..."
    brew services start mysql
    sleep 2
fi

# Запуск Backend
echo "📦 Запуск Backend..."
cd backend
npm run dev &
BACKEND_PID=$!

# Ждем пока backend запустится
sleep 3

# Запуск Frontend
echo "🎨 Запуск Frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Приложение запущено!"
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend: http://localhost:5000"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Функция для остановки серверов
cleanup() {
    echo ""
    echo "⏹️  Останавливаю серверы..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# При нажатии Ctrl+C вызываем cleanup
trap cleanup INT

# Ждем
wait