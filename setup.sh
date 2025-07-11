#!/bin/bash

# Conflict Checker - Quick Setup Script
# This script helps set up the development environment

echo "🚀 Conflict Checker Setup Script"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}❌ MySQL is not installed. Please install MySQL 5.7+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"

# Create project structure
echo "📁 Creating project structure..."
mkdir -p conflict-checker/{backend,frontend}
cd conflict-checker

# Backend setup
echo "🔧 Setting up backend..."
cd backend

# Create directories
mkdir -p src/{config,controllers,middlewares,routes,services,utils}
mkdir -p uploads
touch uploads/.gitkeep

# Copy .env example if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=conflict_checker

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
EOL
    echo -e "${GREEN}✓ .env file created. Please update database credentials.${NC}"
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

# Initialize database
echo "🗄️  Initializing database..."
echo "Please enter your MySQL root password:"
npm run init-db

cd ..

# Frontend setup
echo "🎨 Setting up frontend..."
cd frontend

# Copy .env example if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << EOL
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
EOL
fi

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

cd ..

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Update backend/.env with your MySQL credentials"
echo "2. Start the backend: cd backend && npm run dev"
echo "3. Start the frontend: cd frontend && npm start"
echo "4. Access the application at http://localhost:3000"
echo ""
echo "Default login credentials:"
echo "Username: admin"
echo "Password: admin123"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"