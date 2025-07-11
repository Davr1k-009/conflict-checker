import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Calendar,
  User,
  Building,
  Hash
} from 'lucide-react';
import { casesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface Case {
  id: number;
  case_number: string;
  client_name: string;
  client_inn: string;
  opponent_name: string;
  opponent_inn: string;
  case_type: string;
  description: string;
  lawyer_names: string; // Comma-separated list of lawyer names
  lawyer_count: number; // Count of assigned lawyers
  created_by_name: string;
  created_at: string;
  document_count: number;
  conflict_level?: string;
}

const Cases: React.FC = () => {
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLawyer, setFilterLawyer] = useState('');

  const { data: cases, isLoading, error, refetch } = useQuery<Case[]>({
    queryKey: ['cases', searchTerm, filterType, filterLawyer],
    queryFn: async () => {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (filterType) params.type = filterType;
      if (filterLawyer) params.lawyerId = filterLawyer;
      
      const response = await casesAPI.getAll(params);
      return response.data;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Refetch cases when component mounts
  useEffect(() => {
    refetch();
  }, [refetch]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 },
    },
  };

  const getConflictIcon = (level?: string) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-apple-danger" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-apple-warning" />;
      case 'low':
        return <AlertTriangle className="w-5 h-5 text-blue-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-apple-success" />;
    }
  };

  const getCaseTypeColor = (type: string) => {
    switch (type) {
      case 'litigation':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'contract':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'consultation':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400';
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-apple-danger mx-auto mb-4" />
          <p className="text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('errors.loadingCases')}
          </p>
        </div>
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
      <motion.div variants={itemVariants} className="flex justify-between items-center">
        <div>
          <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('cases.title')}
          </h1>
          <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
            {t('cases.subtitle')}
          </p>
        </div>
        {hasPermission('create') && (
          <Link
            to="/cases/new"
            className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('cases.newCase')}
          </Link>
        )}
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
            <input
              type="text"
              placeholder={t('cases.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                         focus:outline-none focus:ring-2 focus:ring-apple-accent 
                         bg-white dark:bg-apple-dark-bg 
                         text-apple-text-primary dark:text-apple-dark-text-primary
                         placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                         focus:outline-none focus:ring-2 focus:ring-apple-accent appearance-none
                         bg-white dark:bg-apple-dark-bg 
                         text-apple-text-primary dark:text-apple-dark-text-primary"
            >
              <option value="">{t('cases.allTypes')}</option>
              <option value="litigation">{t('cases.litigation')}</option>
              <option value="contract">{t('cases.contract')}</option>
              <option value="consultation">{t('cases.consultation')}</option>
              <option value="other">{t('cases.other')}</option>
            </select>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('');
              setFilterLawyer('');
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-all"
          >
            {t('common.clearFilters')}
          </button>
        </div>
      </motion.div>

      {/* Cases List */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent"></div>
          </div>
        ) : cases && cases.length > 0 ? (
          <div className="space-y-4">
            {cases.map((case_) => (
              <motion.div
                key={case_.id}
                whileHover={{ scale: 1.01 }}
                className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-all duration-300"
              >
                <Link to={`/cases/${case_.id}`} className="block p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <span className="flex items-center text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          <Hash className="w-4 h-4 mr-1" />
                          {case_.case_number || `Case ${case_.id}`}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCaseTypeColor(
                            case_.case_type
                          )}`}
                        >
                          {t(`cases.${case_.case_type}`)}
                        </span>
                        <span className="flex items-center">
                          {getConflictIcon(case_.conflict_level)}
                          <span className="ml-1 text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                            {case_.conflict_level ? t(`conflictLevels.${case_.conflict_level}`) : t('cases.noConflicts')}
                          </span>
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-1">
                        {case_.client_name}
                      </h3>

                      {case_.opponent_name && (
                        <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                          {t('cases.vs')} {case_.opponent_name}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          <User className="w-4 h-4 mr-2" />
                          {case_.lawyer_count > 0 
                            ? case_.lawyer_count === 1 
                              ? case_.lawyer_names 
                              : `${case_.lawyer_count} ${t('cases.lawyers')}`
                            : t('cases.unassigned')}
                        </div>
                        <div className="flex items-center text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          <Calendar className="w-4 h-4 mr-2" />
                          {format(new Date(case_.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="flex items-center text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          <Briefcase className="w-4 h-4 mr-2" />
                          {case_.document_count} {t('cases.documents')}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary ml-4" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-12 text-center">
            <Briefcase className="w-16 h-16 text-apple-text-secondary dark:text-apple-dark-text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
              {t('cases.noCasesFound')}
            </h3>
            <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary mb-6">
              {searchTerm || filterType
                ? t('cases.tryAdjustingFilters')
                : t('cases.getStarted')}
            </p>
            {hasPermission('create') && !searchTerm && !filterType && (
              <Link
                to="/cases/new"
                className="inline-flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('cases.createFirstCase')}
              </Link>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Cases;