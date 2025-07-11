import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Home,
  Briefcase,
  Search,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  Moon,
  Sun,
  AlertTriangle,
  CheckCircle,
  Globe,
  Activity,
  Database,
  FileImage
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, canManageUsers } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, clearNotification } = useSocket();
  const { t, i18n } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const navItems = [
    { path: '/dashboard', label: t('navigation.dashboard'), icon: Home },
    { path: '/cases', label: t('navigation.cases'), icon: Briefcase },
    { path: '/conflict-check', label: t('navigation.checkConflicts'), icon: Search },
    ...(canManageUsers() ? [{ path: '/users', label: t('navigation.users'), icon: Users }] : []),
    ...(user?.role === 'admin' ? [
      { path: '/activity-logs', label: t('navigation.activityLogs'), icon: Activity },
      { path: '/letterheads', label: t('navigation.letterheads'), icon: FileImage },
      { path: '/backups', label: t('navigation.backups'), icon: Database }
    ] : []),
  ];

  const handleLogout = () => {
    logout();
    toast.success(t('auth.loggedOut'));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'conflict':
        return <AlertTriangle className="w-4 h-4 text-apple-danger" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-apple-success" />;
      default:
        return <Bell className="w-4 h-4 text-apple-accent" />;
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLanguageMenu(false);
  };

  return (
    <div className="min-h-screen bg-apple-bg dark:bg-apple-dark-bg transition-colors">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-apple-dark-surface/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 fixed w-full top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Desktop Nav */}
            <div className="flex items-center flex-1">
              <Link to="/dashboard" className="flex items-center space-x-2 mr-3 lg:mr-6 flex-shrink-0">
                <div className="p-1.5 lg:p-2 bg-apple-accent rounded-apple">
                  <Shield className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                </div>
                <span className="text-base lg:text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary hidden sm:block transition-colors whitespace-nowrap">
                  Conflict Checker
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        group relative flex items-center px-2 lg:px-3 py-2 rounded-apple text-sm font-medium
                        transition-all duration-200
                        ${isActive
                          ? 'bg-apple-accent text-white'
                          : 'text-apple-text-secondary dark:text-apple-dark-text-secondary hover:text-apple-text-primary dark:hover:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 lg:mr-1.5 xl:mr-2 flex-shrink-0" />
                      <span className="hidden lg:inline">{item.label}</span>
                      
                      {/* Tooltip for medium screens */}
                      <span className="
                        lg:hidden absolute top-full left-1/2 transform -translate-x-1/2 
                        mt-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs 
                        rounded whitespace-nowrap opacity-0 group-hover:opacity-100 
                        pointer-events-none transition-opacity duration-200 z-50
                      ">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side items */}
            <div className="flex items-center space-x-1 lg:space-x-3">
              {/* Language Selector */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="p-1.5 lg:p-2 rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50 transition-colors flex items-center group relative"
                  title={i18n.language === 'en' ? 'Language: EN' : 'Язык: RU'}
                >
                  <Globe className="w-4 h-4 lg:w-5 lg:h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                  {/* Current language indicator */}
                  <span className="absolute -bottom-1 -right-1 text-[10px] font-semibold bg-apple-accent text-white px-1 rounded">
                    {i18n.language.toUpperCase()}
                  </span>
                </motion.button>

                {/* Language Dropdown */}
                <AnimatePresence>
                  {showLanguageMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-20 bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg overflow-hidden"
                    >
                      <button
                        onClick={() => changeLanguage('en')}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors ${
                          i18n.language === 'en' 
                            ? 'text-apple-accent font-medium' 
                            : 'text-apple-text-primary dark:text-apple-dark-text-primary'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => changeLanguage('ru')}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors ${
                          i18n.language === 'ru' 
                            ? 'text-apple-accent font-medium' 
                            : 'text-apple-text-primary dark:text-apple-dark-text-primary'
                        }`}
                      >
                        RU
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Toggle */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-1.5 lg:p-2 rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50 transition-colors"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                ) : (
                  <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                )}
              </motion.button>

              {/* Notifications */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1.5 lg:p-2 rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50 transition-colors"
                >
                  <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-apple-danger rounded-full" />
                  )}
                </motion.button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
                          {t('navigation.notifications')}
                        </h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-apple-text-secondary dark:text-apple-dark-text-secondary text-sm">
                            {t('navigation.noNotifications')}
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className="p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors cursor-pointer"
                              onClick={() => {
                                clearNotification(notification.id);
                                if (notification.link) {
                                  navigate(notification.link);
                                }
                                setShowNotifications(false);
                              }}
                            >
                              <div className="flex items-start">
                                <div className="mr-3 mt-1">
                                  {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
                                    {new Date(notification.timestamp).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-1 lg:space-x-2">
                <Link
                  to="/profile"
                  className="flex items-center space-x-1.5 lg:space-x-2 px-1.5 lg:px-3 py-1.5 lg:py-2 rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50 transition-colors"
                >
                  <div className="w-6 h-6 lg:w-7 lg:h-7 bg-apple-accent rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white" />
                  </div>
                  <span className="text-xs lg:text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary hidden 2xl:block">
                    {user?.fullName}
                  </span>
                </Link>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleLogout}
                  className="p-1.5 lg:p-2 rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50 transition-colors group relative"
                  title={t('auth.logout')}
                >
                  <LogOut className="w-4 h-4 lg:w-5 lg:h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                  {/* Tooltip */}
                  <span className="
                    absolute top-full right-0 mt-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs 
                    rounded whitespace-nowrap opacity-0 group-hover:opacity-100 
                    pointer-events-none transition-opacity duration-200 z-50
                  ">
                    {t('auth.logout')}
                  </span>
                </motion.button>
              </div>

              {/* Mobile menu button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-apple-text-primary dark:text-apple-dark-text-primary" />
                ) : (
                  <Menu className="w-5 h-5 text-apple-text-primary dark:text-apple-dark-text-primary" />
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white dark:bg-apple-dark-surface border-t border-gray-200 dark:border-gray-800"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`
                        flex items-center px-3 py-2 rounded-apple text-base font-medium
                        ${isActive
                          ? 'bg-apple-accent text-white'
                          : 'text-apple-text-secondary dark:text-apple-dark-text-secondary hover:text-apple-text-primary dark:hover:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-surface/50'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Layout;