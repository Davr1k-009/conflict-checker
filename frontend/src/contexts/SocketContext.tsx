import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'conflict' | 'success' | 'info' | 'warning';
  message: string;
  timestamp: Date;
  link?: string;
}

interface SocketContextType {
  socket: Socket | null;
  notifications: Notification[];
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const socketUrl = process.env.REACT_APP_SOCKET_URL || '';
      const newSocket = io(socketUrl, {
        auth: {
          token: localStorage.getItem('token'),
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        newSocket.emit('join-room', user.id);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      // Handle conflict detection notifications
      newSocket.on('conflict-detected', (data) => {
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'conflict',
          message: data.message || 'New conflict detected',
          timestamp: new Date(),
          link: data.caseId ? `/cases/${data.caseId}` : undefined,
        };
        
        setNotifications(prev => [notification, ...prev]);
        
        // Show toast notification
        toast.error(notification.message, {
          duration: 5000,
          icon: '⚠️',
        });
      });

      // Handle user creation notifications
      newSocket.on('user-created', (data) => {
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'success',
          message: `New user created: ${data.fullName}`,
          timestamp: new Date(),
          link: '/users',
        };
        
        setNotifications(prev => [notification, ...prev]);
        
        if (user.role === 'admin') {
          toast.success(notification.message, {
            duration: 4000,
          });
        }
      });

      // Handle general notifications
      newSocket.on('notification', (data) => {
        const notification: Notification = {
          id: Date.now().toString(),
          type: data.type || 'info',
          message: data.message,
          timestamp: new Date(),
          link: data.link,
        };
        
        setNotifications(prev => [notification, ...prev]);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, user]);

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const value: SocketContextType = {
    socket,
    notifications,
    clearNotification,
    clearAllNotifications,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};