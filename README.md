# Conflict Checker - Legal Conflict Management System

A comprehensive web application for law firms to manage and check conflicts of interest across cases, clients, and related entities.

## Features

- **User Management**: Role-based access control with customizable permissions
- **Case Management**: Create, edit, and track legal cases with detailed information
- **Conflict Detection**: Automated conflict checking across multiple parameters
- **Document Management**: Upload and manage case-related documents
- **Real-time Notifications**: WebSocket-based notifications for conflict alerts
- **Apple-style UI**: Modern, clean interface inspired by Apple's design language
- **Dark Mode Support**: Toggle between light and dark themes

## Tech Stack

### Backend
- Node.js with Express.js
- MySQL database
- JWT authentication
- Socket.io for real-time features
- Multer for file uploads

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- React Query for state management
- Framer Motion for animations
- Socket.io client

## Installation

### Prerequisites
- Node.js 16+
- MySQL 5.7+
- npm or yarn

### Quick Start

1. **Clone the repository**
```bash
git clone [repository-url]
cd conflict-checker
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run init-db
npm run dev
```

3. **Setup Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## Default Credentials

- Username: `admin`
- Password: `admin123`

**Important**: Change the default password after first login!

## Project Structure

```
conflict-checker/
├── backend/
│   ├── src/
│   │   ├── config/       # Database configuration
│   │   ├── controllers/  # Request handlers
│   │   ├── middlewares/  # Authentication, validation
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utilities
│   ├── uploads/          # Document storage
│   └── server.js         # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # Context providers
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── App.tsx       # Main app component
│   └── public/           # Static files
└── README.md
```

## Key Features Explained

### Conflict Detection Algorithm

The system checks for conflicts across multiple dimensions:
1. **Direct conflicts**: Same parties on opposite sides
2. **Lawyer conflicts**: Previous representation of opposing parties
3. **Related entity conflicts**: Conflicts through subsidiaries, founders, directors
4. **Cross-entity conflicts**: Complex relationships between entities

### Permission System

Three user roles with customizable permissions:
- **Admin**: Full system access
- **User**: Configurable create/edit/delete permissions
- **Viewer**: Read-only access

### Real-time Features

- Instant conflict notifications
- User activity updates
- Live case status changes

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/change-password` - Change password

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `POST /api/users/:id/reset-password` - Reset user password

### Cases
- `GET /api/cases` - List cases with filters
- `GET /api/cases/:id` - Get case details
- `POST /api/cases` - Create new case
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### Conflicts
- `POST /api/conflicts/check/:caseId` - Run conflict check
- `POST /api/conflicts/search` - Search for conflicts
- `GET /api/conflicts/stats` - Get conflict statistics

## Security Considerations

1. **Authentication**: JWT tokens with 8-hour expiration
2. **Authorization**: Role-based access control
3. **Data Validation**: Input validation on all endpoints
4. **File Upload**: Restricted file types and size limits
5. **SQL Injection**: Parameterized queries
6. **XSS Protection**: React's built-in protection

## Deployment

### Production Setup

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use strong JWT secrets
   - Configure proper database credentials

2. **Build Frontend**
```bash
cd frontend
npm run build
```

3. **Process Management**
```bash
npm install -g pm2
pm2 start backend/server.js --name conflict-checker
pm2 save
pm2 startup
```

4. **Reverse Proxy (Nginx)**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend/build;
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL is running
   - Verify credentials in .env
   - Ensure database exists

2. **Port Already in Use**
   - Change PORT in .env
   - Kill existing processes

3. **File Upload Issues**
   - Check uploads directory exists
   - Verify write permissions

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support, email support@conflictchecker.com or create an issue in the repository.