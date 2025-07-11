import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Users,
  TrendingUp,
  FileText,
  Calendar,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardStats {
  totalCases: number;
  activeConflicts: number;
  casesThisMonth: number;
  totalUsers: number;
  recentCases: Array<{
    id: number;
    case_number: string;
    client_name: string;
    created_at: string;
    conflict_level: string;
  }>;
  conflictsByLevel: Array<{
    level: string;
    count: number;
  }>;
  casesByMonth: Array<{
    month: string;
    count: number;
  }>;
}

const Dashboard: React.FC = () => {
  const { user, canManageUsers } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await axios.get('/dashboard/stats');
      return response.data;
    },
  });

  const statCards = [
    {
      title: t('dashboard.totalCases'),
      value: stats?.totalCases || 0,
      icon: Briefcase,
      color: 'bg-apple-accent',
      trend: '+12%',
    },
    {
      title: t('dashboard.activeConflicts'),
      value: stats?.activeConflicts || 0,
      icon: AlertTriangle,
      color: 'bg-apple-danger',
      trend: '-5%',
    },
    {
      title: t('dashboard.casesThisMonth'),
      value: stats?.casesThisMonth || 0,
      icon: Calendar,
      color: 'bg-apple-success',
      trend: '+23%',
    },
    {
      title: t('dashboard.totalUsers'),
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'bg-apple-warning',
      trend: '+2%',
    },
  ];

  const conflictColors = {
    high: '#ff3b30',
    medium: '#ff9500',
    low: '#ffcc00',
    none: '#34c759',
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent"></div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
          {t('dashboard.welcome', { name: user?.fullName })}
        </h1>
        <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
          {t('dashboard.subtitle')}
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-6 shadow-apple hover:shadow-apple-lg transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${stat.color} rounded-apple`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-apple-success">
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-3xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
                {stat.value}
              </h3>
              <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
                {stat.title}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cases by Month Chart */}
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-6 shadow-apple"
        >
          <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
            {t('dashboard.casesTrend')}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.casesByMonth || []}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme === 'dark' ? '#333' : '#f0f0f0'} 
              />
              <XAxis 
                dataKey="month" 
                stroke={theme === 'dark' ? '#86868b' : '#86868b'} 
              />
              <YAxis 
                stroke={theme === 'dark' ? '#86868b' : '#86868b'} 
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#1d1d1f' : '#fff',
                  border: theme === 'dark' ? '1px solid #333' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: theme === 'dark' ? '#f5f5f7' : '#1d1d1f'
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0071e3"
                strokeWidth={2}
                dot={{ fill: '#0071e3', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Conflicts by Level Chart */}
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-6 shadow-apple"
        >
          <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
            {t('dashboard.conflictsByLevel')}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.conflictsByLevel || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ level, count }) => `${t(`conflictLevels.${level}`)}: ${count}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {stats?.conflictsByLevel.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={conflictColors[entry.level as keyof typeof conflictColors]}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#1d1d1f' : '#fff',
                  border: theme === 'dark' ? '1px solid #333' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: theme === 'dark' ? '#f5f5f7' : '#1d1d1f'
                }}
                formatter={(value, name) => [value, t(`conflictLevels.${name}`)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Cases */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {t('dashboard.recentCases')}
            </h2>
            <Link
              to="/cases"
              className="text-sm text-apple-accent hover:text-blue-600 transition-colors"
            >
              {t('common.viewAll')} →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-apple-surface dark:bg-apple-dark-bg">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                  {t('dashboard.caseNumber')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                  {t('dashboard.client')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                  {t('dashboard.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                  {t('dashboard.conflictStatus')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                  {t('dashboard.action')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {stats?.recentCases.map((case_) => (
                <tr key={case_.id} className="hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                    {case_.case_number || `#${case_.id}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                    {case_.client_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {format(new Date(case_.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        case_.conflict_level === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : case_.conflict_level === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : case_.conflict_level === 'low'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}
                    >
                      {t(`conflictLevels.${case_.conflict_level || 'none'}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      to={`/cases/${case_.id}`}
                      className="text-apple-accent hover:text-blue-600 transition-colors"
                    >
                      {t('common.viewDetails')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className={`grid grid-cols-1 md:grid-cols-${canManageUsers() ? '3' : '2'} gap-4`}>
        <Link
          to="/cases/new"
          className="p-6 bg-apple-accent text-white rounded-apple-lg hover:bg-blue-600 transition-all duration-300 text-center"
        >
          <FileText className="w-8 h-8 mx-auto mb-2" />
          <span className="font-medium">{t('dashboard.createNewCase')}</span>
        </Link>
        <Link
          to="/conflict-check"
          className="p-6 bg-apple-surface dark:bg-apple-dark-surface text-apple-text-primary dark:text-apple-dark-text-primary rounded-apple-lg hover:bg-gray-200 dark:hover:bg-apple-dark-bg transition-all duration-300 text-center"
        >
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <span className="font-medium">{t('dashboard.checkConflicts')}</span>
        </Link>
        {canManageUsers() && (
          <Link
            to="/users"
            className="p-6 bg-apple-surface dark:bg-apple-dark-surface text-apple-text-primary dark:text-apple-dark-text-primary rounded-apple-lg hover:bg-gray-200 dark:hover:bg-apple-dark-bg transition-all duration-300 text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2" />
            <span className="font-medium">{t('dashboard.manageUsers')}</span>
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;