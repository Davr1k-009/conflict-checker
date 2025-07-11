import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageUsers: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: 'create' | 'edit' | 'delete' | 'manageUsers') => boolean;
  isAdmin: () => boolean;
  canManageUsers: () => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '/api';

// Add request interceptor to include token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      const parsedUser = JSON.parse(storedUser);
      // Ensure manageUsers permission exists
      if (parsedUser.permissions && parsedUser.permissions.manageUsers === undefined) {
        parsedUser.permissions.manageUsers = false;
      }
      setUser(parsedUser);
    }

    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/auth/login', { username, password });
      const { user, token, refreshToken } = response.data;

      // Ensure manageUsers permission exists
      if (user.permissions && user.permissions.manageUsers === undefined) {
        user.permissions.manageUsers = false;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      setUser(user);
      setToken(token);

      toast.success(`Welcome back, ${user.fullName}!`);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const hasPermission = (permission: 'create' | 'edit' | 'delete' | 'manageUsers'): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions[permission] || false;
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin' || false;
  };

  const canManageUsers = (): boolean => {
    return isAdmin() || (user?.permissions?.manageUsers === true) || false;
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken && user) {
      try {
        // Since the updateProfile endpoint returns the updated user data,
        // we can use that response to update the user in context
        // For now, we'll create a simple object update since we don't have a dedicated /auth/me endpoint
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const updatedUser = JSON.parse(storedUser);
          // Ensure manageUsers permission exists
          if (updatedUser.permissions && updatedUser.permissions.manageUsers === undefined) {
            updatedUser.permissions.manageUsers = false;
          }
          setUser(updatedUser);
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }
  };

  // Also update the user in context when it changes in response to API calls
  useEffect(() => {
    // Listen for successful profile updates from the API response
    const interceptorId = axios.interceptors.response.use(
      (response) => {
        // If the response contains updated user data (from updateProfile endpoint)
        if (response.config.url === '/users/profile' && response.config.method === 'put' && response.data.user) {
          const updatedUser = response.data.user;
          // Ensure manageUsers permission exists
          if (updatedUser.permissions && updatedUser.permissions.manageUsers === undefined) {
            updatedUser.permissions.manageUsers = false;
          }
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        return response;
      },
      (error) => error
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!token,
    hasPermission,
    isAdmin,
    canManageUsers,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};