import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Building,
  User,
  Briefcase,
  Info,
  XCircle,
  Download,
  Printer
} from 'lucide-react';
import { conflictsAPI } from '../services/api';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface ConflictSearchForm {
  clientType: 'legal' | 'individual';
  clientName: string;
  clientInn: string;
  clientPinfl: string;
  opponentType: 'legal' | 'individual';
  opponentName: string;
  opponentInn: string;
  opponentPinfl: string;
}

interface ConflictResult {
  level: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
  conflictingCases: number[];
  recommendations: string[];
  reportId?: number;
  detailedCases?: Array<{
    id: number;
    case_number: string;
    client_name: string;
    opponent_name: string;
    case_type: string;
    created_at: string;
  }>;
}

const ConflictCheck: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const [result, setResult] = useState<ConflictResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { },
    reset,
    setValue,
    watch
  } = useForm<ConflictSearchForm>({
    defaultValues: {
      clientType: 'legal',
      clientName: '',
      clientInn: '',
      clientPinfl: '',
      opponentType: 'legal',
      opponentName: '',
      opponentInn: '',
      opponentPinfl: ''
    }
  });

  const clientType = watch('clientType');
  const opponentType = watch('opponentType');

  // Clear data when component unmounts or user changes
  useEffect(() => {
    return () => {
      // Clear session storage when leaving the page
      const userKey = user?.id ? `conflict_search_${user.id}` : null;
      if (userKey) {
        sessionStorage.removeItem(`${userKey}_data`);
        sessionStorage.removeItem(`${userKey}_result`);
      }
    };
  }, [user?.id]);

  // Load data from location state if coming from case creation
  useEffect(() => {
    if (location.state && location.state.searchData) {
      const { 
        clientType: cType, 
        clientName, 
        clientInn, 
        clientPinfl,
        opponentType: oType,
        opponentName, 
        opponentInn,
        opponentPinfl
      } = location.state.searchData;
      
      setValue('clientType', cType || 'legal');
      setValue('clientName', clientName || '');
      setValue('clientInn', clientInn || '');
      setValue('clientPinfl', clientPinfl || '');
      setValue('opponentType', oType || 'legal');
      setValue('opponentName', opponentName || '');
      setValue('opponentInn', opponentInn || '');
      setValue('opponentPinfl', opponentPinfl || '');
      
      // Clear the location state to prevent re-use
      window.history.replaceState({}, document.title);
      
      // Auto-submit the form if data was provided
      handleSubmit(onSubmit)();
    }
  }, [location.state, setValue, handleSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear INN when switching to individual, clear PINFL when switching to legal
  useEffect(() => {
    if (clientType === 'individual') {
      setValue('clientInn', '');
    } else {
      setValue('clientPinfl', '');
    }
  }, [clientType, setValue]);

  useEffect(() => {
    if (opponentType === 'individual') {
      setValue('opponentInn', '');
    } else {
      setValue('opponentPinfl', '');
    }
  }, [opponentType, setValue]);

  // Translation function for recommendations
  const translateRecommendation = (recommendation: string): string => {
    const recommendationMap: { [key: string]: string } = {
      'IMMEDIATE ACTION REQUIRED: High conflict detected': 'conflictCheck.highRiskAction',
      'Do not proceed with this case without senior partner approval': 'conflictCheck.doNotProceed',
      'Consider declining representation or obtaining conflict waiver': 'conflictCheck.considerDeclining',
      'Review conflict details carefully': 'conflictCheck.reviewCarefully',
      'Consult with compliance department': 'conflictCheck.consultCompliance',
      'Document any mitigation measures taken': 'conflictCheck.documentMeasures',
      'Minor conflicts detected - review for potential issues': 'conflictCheck.minorConflicts',
      'Ensure proper information barriers if proceeding': 'conflictCheck.ensureBarriers',
      'No conflicts detected': 'conflictCheck.noConflictsDetected',
      'Case can proceed normally': 'conflictCheck.canProceedNormally'
    };

    // Check if there's a translation key for this recommendation
    for (const [english, key] of Object.entries(recommendationMap)) {
      if (recommendation.includes(english)) {
        return t(key);
      }
    }

    // If no translation found, return the original
    return recommendation;
  };

  // Translation function for conflict reasons
  const translateConflictReason = (reason: string): string => {
    // Check for common patterns in conflict reasons
    if (reason.includes('Direct conflict')) {
      return t('conflictCheck.directConflict');
    }
    
    // For other reasons, try to extract and translate key parts
    // This is a simple implementation - you might need to expand this based on your actual conflict reasons
    if (i18n.language === 'ru') {
      // Replace common English terms with Russian equivalents
      let translated = reason
        .replace('representing', 'представляет')
        .replace('against', 'против')
        .replace('in case', 'в деле')
        .replace('conflict with', 'конфликт с')
        .replace('same client', 'тот же клиент')
        .replace('same opponent', 'тот же оппонент');
      
      return translated;
    }
    
    return reason;
  };

  const searchMutation = useMutation({
    mutationFn: conflictsAPI.search,
    onSuccess: (response) => {
      setResult(response.data);
    },
    onError: (error: any) => {
      console.error('Search error:', error);
    },
  });

  const onSubmit = (data: ConflictSearchForm) => {
    // Prepare search data based on entity types
    const searchData: any = {};
    
    // Client data
    searchData.clientType = data.clientType;
    if (data.clientName) searchData.clientName = data.clientName;
    if (data.clientType === 'legal' && data.clientInn) {
      searchData.clientInn = data.clientInn;
    } else if (data.clientType === 'individual' && data.clientPinfl) {
      searchData.clientPinfl = data.clientPinfl;
    }
    
    // Opponent data
    searchData.opponentType = data.opponentType;
    if (data.opponentName) searchData.opponentName = data.opponentName;
    if (data.opponentType === 'legal' && data.opponentInn) {
      searchData.opponentInn = data.opponentInn;
    } else if (data.opponentType === 'individual' && data.opponentPinfl) {
      searchData.opponentPinfl = data.opponentPinfl;
    }
    
    searchMutation.mutate(searchData);
  };

  const clearSearch = () => {
    // Clear form
    reset({
      clientType: 'legal',
      clientName: '',
      clientInn: '',
      clientPinfl: '',
      opponentType: 'legal',
      opponentName: '',
      opponentInn: '',
      opponentPinfl: ''
    });
    // Clear results
    setResult(null);
  };

  const handleDownloadReport = async () => {
    if (!result?.reportId) return;
    
    try {
      const response = await conflictsAPI.generateReport(result.reportId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `conflict-report-${result.reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('conflictCheck.reportDownloaded'));
    } catch (error) {
      toast.error(t('errors.downloadReportFailed'));
    }
  };

  const handlePrintReport = async () => {
    if (!result?.reportId) return;
    
    try {
      const response = await conflictsAPI.generateReport(result.reportId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Open PDF in new window for printing
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        // Wait for PDF to load before printing
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      }
      
      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000); // 1 minute
      
    } catch (error) {
      toast.error(t('errors.printReportFailed'));
    }
  };

  const getConflictIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="w-6 h-6 text-apple-danger" />;
      case 'medium':
        return <AlertTriangle className="w-6 h-6 text-apple-warning" />;
      case 'low':
        return <Info className="w-6 h-6 text-blue-500" />;
      case 'none':
        return <CheckCircle className="w-6 h-6 text-apple-success" />;
      default:
        return <XCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getConflictColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'border-apple-danger bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'border-apple-warning bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'none':
        return 'border-apple-success bg-green-50 dark:bg-green-900/20';
      default:
        return 'border-gray-300 bg-gray-50 dark:bg-gray-800/20';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
          {t('conflictCheck.title')}
        </h1>
        <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
          {t('conflictCheck.subtitle')}
        </p>
      </div>

      {/* Search Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary flex items-center">
                {clientType === 'legal' ? (
                  <Building className="w-5 h-5 mr-2" />
                ) : (
                  <User className="w-5 h-5 mr-2" />
                )}
                {t('conflictCheck.clientInformation')}
              </h3>
              
              {/* Client Type Toggle - Apple Style */}
              <div className="mb-4">
                <div className="inline-flex rounded-apple bg-gray-100 dark:bg-gray-800 p-1">
                  <button
                    type="button"
                    onClick={() => setValue('clientType', 'legal')}
                    className={`flex items-center px-4 py-2 rounded-apple text-sm font-medium transition-all ${
                      clientType === 'legal'
                        ? 'bg-white dark:bg-gray-700 text-apple-text-primary dark:text-white shadow-sm'
                        : 'text-apple-text-secondary dark:text-gray-400 hover:text-apple-text-primary dark:hover:text-white'
                    }`}
                  >
                    <Building className="w-4 h-4 mr-2" />
                    {t('conflictCheck.legalEntity')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('clientType', 'individual')}
                    className={`flex items-center px-4 py-2 rounded-apple text-sm font-medium transition-all ${
                      clientType === 'individual'
                        ? 'bg-white dark:bg-gray-700 text-apple-text-primary dark:text-white shadow-sm'
                        : 'text-apple-text-secondary dark:text-gray-400 hover:text-apple-text-primary dark:hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4 mr-2" />
                    {t('conflictCheck.individual')}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                  {t('conflictCheck.clientName')}
                </label>
                <input
                  {...register('clientName')}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             focus:outline-none focus:ring-2 focus:ring-apple-accent
                             bg-white dark:bg-gray-900 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-gray-500"
                  placeholder={clientType === 'legal' ? t('conflictCheck.clientNamePlaceholder') : t('conflictCheck.clientNameIndividualPlaceholder')}
                />
              </div>

              {clientType === 'legal' ? (
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('conflictCheck.clientInn')}
                  </label>
                  <input
                    {...register('clientInn')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-gray-900 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-gray-500"
                    placeholder={t('conflictCheck.clientInnPlaceholder')}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('conflictCheck.clientPinfl')}
                  </label>
                  <input
                    {...register('clientPinfl')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-gray-900 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-gray-500"
                    placeholder={t('conflictCheck.clientPinflPlaceholder')}
                  />
                </div>
              )}
            </div>

            {/* Opponent Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary flex items-center">
                {opponentType === 'legal' ? (
                  <Building className="w-5 h-5 mr-2" />
                ) : (
                  <User className="w-5 h-5 mr-2" />
                )}
                {t('conflictCheck.opponentInformation')}
              </h3>
              
              {/* Opponent Type Toggle - Apple Style */}
              <div className="mb-4">
                <div className="inline-flex rounded-apple bg-gray-100 dark:bg-gray-800 p-1">
                  <button
                    type="button"
                    onClick={() => setValue('opponentType', 'legal')}
                    className={`flex items-center px-4 py-2 rounded-apple text-sm font-medium transition-all ${
                      opponentType === 'legal'
                        ? 'bg-white dark:bg-gray-700 text-apple-text-primary dark:text-white shadow-sm'
                        : 'text-apple-text-secondary dark:text-gray-400 hover:text-apple-text-primary dark:hover:text-white'
                    }`}
                  >
                    <Building className="w-4 h-4 mr-2" />
                    {t('conflictCheck.legalEntity')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('opponentType', 'individual')}
                    className={`flex items-center px-4 py-2 rounded-apple text-sm font-medium transition-all ${
                      opponentType === 'individual'
                        ? 'bg-white dark:bg-gray-700 text-apple-text-primary dark:text-white shadow-sm'
                        : 'text-apple-text-secondary dark:text-gray-400 hover:text-apple-text-primary dark:hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4 mr-2" />
                    {t('conflictCheck.individual')}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                  {t('conflictCheck.opponentName')}
                </label>
                <input
                  {...register('opponentName')}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             focus:outline-none focus:ring-2 focus:ring-apple-accent
                             bg-white dark:bg-gray-900 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-gray-500"
                  placeholder={opponentType === 'legal' ? t('conflictCheck.opponentNamePlaceholder') : t('conflictCheck.opponentNameIndividualPlaceholder')}
                />
              </div>

              {opponentType === 'legal' ? (
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('conflictCheck.opponentInn')}
                  </label>
                  <input
                    {...register('opponentInn')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-gray-900 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-gray-500"
                    placeholder={t('conflictCheck.opponentInnPlaceholder')}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('conflictCheck.opponentPinfl')}
                  </label>
                  <input
                    {...register('opponentPinfl')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-gray-900 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-gray-500"
                    placeholder={t('conflictCheck.opponentPinflPlaceholder')}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between">
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-all"
            >
              {t('common.clearFilters')}
            </button>
            <button
              type="submit"
              disabled={searchMutation.isPending}
              className="flex items-center justify-center px-6 py-3 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {searchMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  {t('conflictCheck.searching')}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  {t('conflictCheck.checkButton')}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Card */}
          <div className={`border-2 rounded-apple-lg p-6 ${getConflictColor(result.level)}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start flex-1">
                <div className="mr-4">{getConflictIcon(result.level)}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {result.level === 'none'
                      ? t('conflictCheck.noConflictsFound')
                      : t('conflictCheck.conflictRisk', { level: t(`conflictLevels.${result.level}`) })}
                  </h3>
                  
                  {result.reasons.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {result.reasons.map((reason, index) => (
                        <p key={index} className="text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                          • {translateConflictReason(reason)}
                        </p>
                      ))}
                    </div>
                  )}

                  {result.recommendations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                      <h4 className="font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                        {t('conflictCheck.recommendations')}:
                      </h4>
                      <div className="space-y-1">
                        {result.recommendations.map((rec, index) => (
                          <p key={index} className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                            {translateRecommendation(rec)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={handleDownloadReport}
                  className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple transition-colors"
                  title={t('conflictCheck.downloadReport')}
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrintReport}
                  className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple transition-colors"
                  title={t('conflictCheck.printReport')}
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Conflicting Cases */}
          {result.detailedCases && result.detailedCases.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-apple-lg shadow-apple p-6">
              <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                {t('conflictCheck.conflictingCases')}
              </h3>
              <div className="space-y-3">
                {result.detailedCases.map((case_) => (
                  <Link
                    key={case_.id}
                    to={`/cases/${case_.id}`}
                    className="block p-4 border border-gray-200 dark:border-gray-600 rounded-apple 
                               bg-white dark:bg-gray-700 
                               hover:border-apple-accent hover:shadow-apple-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="text-sm text-apple-text-secondary dark:text-gray-300">
                            #{case_.case_number || case_.id}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full">
                            {t(`cases.${case_.case_type}`)}
                          </span>
                        </div>
                        <h4 className="font-medium text-apple-text-primary dark:text-white">
                          {case_.client_name}
                        </h4>
                        {case_.opponent_name && (
                          <p className="text-sm text-apple-text-secondary dark:text-gray-300">
                            {t('cases.vs')} {case_.opponent_name}
                          </p>
                        )}
                      </div>
                      <Briefcase className="w-5 h-5 text-apple-text-secondary dark:text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ConflictCheck;