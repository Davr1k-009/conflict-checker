import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  User,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  UserPlus,
  UserX,
  Key,
  Briefcase,
  Upload,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

interface ActivityLog {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_name: string | null;
  details: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface ActivityLogResponse {
  logs: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ActivitySummary {
  actionCounts: Array<{ action: string; count: number }>;
  activeUsers: Array<{ user_id: number; user_name: string; activity_count: number }>;
  dailyActivity: Array<{ date: string; count: number }>;
}

const ActivityLogs: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch activity logs
  const { data: logsData, isLoading, refetch } = useQuery<ActivityLogResponse>({
    queryKey: ['activity-logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        }, {} as any)
      });
      const response = await api.get(`/activity-logs?${params}`);
      return response.data;
    },
  });

  // Fetch activity summary
  const { data: summaryData } = useQuery<ActivitySummary>({
    queryKey: ['activity-summary'],
    queryFn: async () => {
      const response = await api.get('/activity-logs/summary');
      return response.data;
    },
  });

  // Get icon for action
  const getActionIcon = (action: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      'user.login': <LogIn className="w-4 h-4 text-green-600" />,
      'user.logout': <LogOut className="w-4 h-4 text-gray-600" />,
      'user.create': <UserPlus className="w-4 h-4 text-blue-600" />,
      'user.update': <User className="w-4 h-4 text-yellow-600" />,
      'user.delete': <UserX className="w-4 h-4 text-red-600" />,
      'user.password_reset': <Key className="w-4 h-4 text-purple-600" />,
      'user.password_change': <Key className="w-4 h-4 text-purple-600" />,
      'case.create': <Briefcase className="w-4 h-4 text-blue-600" />,
      'case.update': <Briefcase className="w-4 h-4 text-yellow-600" />,
      'case.delete': <Briefcase className="w-4 h-4 text-red-600" />,
      'case.view': <Briefcase className="w-4 h-4 text-gray-600" />,
      'conflict.check': <AlertTriangle className="w-4 h-4 text-orange-600" />,
      'document.upload': <Upload className="w-4 h-4 text-green-600" />,
      'document.download': <Download className="w-4 h-4 text-blue-600" />,
      'document.delete': <Trash2 className="w-4 h-4 text-red-600" />
    };
    return iconMap[action] || <Activity className="w-4 h-4 text-gray-600" />;
  };

  // Get action label
  const getActionLabel = (action: string): string => {
    const labelMap: { [key: string]: string } = {
      'user.login': t('activityLogs.actions.userLogin'),
      'user.logout': t('activityLogs.actions.userLogout'),
      'user.create': t('activityLogs.actions.userCreate'),
      'user.update': t('activityLogs.actions.userUpdate'),
      'user.delete': t('activityLogs.actions.userDelete'),
      'user.password_reset': t('activityLogs.actions.userPasswordReset'),
      'user.password_change': t('activityLogs.actions.userPasswordChange'),
      'case.create': t('activityLogs.actions.caseCreate'),
      'case.update': t('activityLogs.actions.caseUpdate'),
      'case.delete': t('activityLogs.actions.caseDelete'),
      'case.view': t('activityLogs.actions.caseView'),
      'conflict.check': t('activityLogs.actions.conflictCheck'),
      'document.upload': t('activityLogs.actions.documentUpload'),
      'document.download': t('activityLogs.actions.documentDownload'),
      'document.delete': t('activityLogs.actions.documentDelete')
    };
    return labelMap[action] || action;
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      userId: '',
      startDate: '',
      endDate: ''
    });
    setPage(1);
  };

  // Export logs
  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({
        ...filters,
        format: 'csv'
      });
      const response = await api.get(`/activity-logs/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('activityLogs.title')}
          </h1>
          <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
            {t('activityLogs.subtitle')}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className="w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-4 shadow-apple"
          >
            <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">
              {t('activityLogs.todayActivity')}
            </h3>
            <div className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {summaryData.dailyActivity.find(d => d.date === format(new Date(), 'yyyy-MM-dd'))?.count || 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-4 shadow-apple"
          >
            <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">
              {t('activityLogs.activeUsers')}
            </h3>
            <div className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {summaryData.activeUsers.length}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-4 shadow-apple"
          >
            <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">
              {t('activityLogs.totalActions')}
            </h3>
            <div className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {summaryData.actionCounts.reduce((sum, item) => sum + item.count, 0)}
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <form onSubmit={handleSearch} className="flex-1 flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder={t('activityLogs.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                           focus:outline-none focus:ring-2 focus:ring-apple-accent
                           bg-white dark:bg-apple-dark-bg 
                           text-apple-text-primary dark:text-apple-dark-text-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
              >
                <Filter className="w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
              </button>
            </form>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-1">
                    {t('activityLogs.action')}
                  </label>
                  <select
                    value={filters.action}
                    onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             focus:outline-none focus:ring-2 focus:ring-apple-accent
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary"
                  >
                    <option value="">{t('common.all')}</option>
                    <option value="user.login">{t('activityLogs.actions.userLogin')}</option>
                    <option value="user.create">{t('activityLogs.actions.userCreate')}</option>
                    <option value="case.create">{t('activityLogs.actions.caseCreate')}</option>
                    <option value="conflict.check">{t('activityLogs.actions.conflictCheck')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-1">
                    {t('activityLogs.startDate')}
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             focus:outline-none focus:ring-2 focus:ring-apple-accent
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-1">
                    {t('activityLogs.endDate')}
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             focus:outline-none focus:ring-2 focus:ring-apple-accent
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                  >
                    {t('common.clearFilters')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Activity Logs Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-apple-surface dark:bg-apple-dark-bg">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('activityLogs.time')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('activityLogs.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('activityLogs.action')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('activityLogs.details')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('activityLogs.ipAddress')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {logsData?.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-apple-accent rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                            {log.user_name}
                          </div>
                          <div className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                            ID: {log.user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getActionIcon(log.action)}
                        <span className="ml-2 text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                          {getActionLabel(log.action)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                      {log.entity_name && (
                        <div>
                          {log.entity_type}: {log.entity_name}
                          {log.entity_id && ` (#${log.entity_id})`}
                        </div>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
                          {log.action === 'conflict.check' && log.details.clientName && (
                            <span>Client: {log.details.clientName}</span>
                          )}
                          {log.action === 'document.upload' && log.details.fileName && (
                            <span>File: {log.details.fileName}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {logsData && logsData.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                {t('common.showing')} {((page - 1) * 50) + 1} - {Math.min(page * 50, logsData.pagination.total)} {t('common.of')} {logsData.pagination.total}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-apple text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors"
                >
                  {t('common.previous')}
                </button>
                <span className="px-3 py-1 text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                  {page} / {logsData.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === logsData.pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-apple text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;