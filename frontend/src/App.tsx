import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import './i18n'; // Import i18n configuration

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetails from './pages/CaseDetails';
import NewCase from './pages/NewCase';
import Users from './pages/Users';
import ConflictCheck from './pages/ConflictCheck';
import Profile from './pages/Profile';
import ActivityLogs from './pages/ActivityLogs';
import Backups from './pages/Backups';
import LetterheadManagement from './pages/LetterheadManagement';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Router>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  className: 'dark:bg-apple-dark-surface dark:text-apple-dark-text-primary',
                  style: {
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '14px',
                  },
                  success: {
                    iconTheme: {
                      primary: '#34c759',
                      secondary: '#ffffff',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ff3b30',
                      secondary: '#ffffff',
                    },
                  },
                }}
              />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="cases" element={<Cases />} />
                  <Route path="cases/:id" element={<CaseDetails />} />
                  <Route path="cases/new" element={<NewCase />} />
                  <Route path="conflict-check" element={<ConflictCheck />} />
                  <Route path="users" element={<Users />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="activity-logs" element={<ActivityLogs />} />
                  <Route
                    path="backups"
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Backups />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="letterheads"
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <LetterheadManagement />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Routes>
            </Router>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;