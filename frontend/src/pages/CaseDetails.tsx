import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Building,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload,
  Trash2,
  Edit,
  Save,
  X,
  Hash,
  Users,
  Shield,
  Clock,
  MoreVertical,
  RefreshCw,
  UserCheck,
  Eye,
  Paperclip
} from 'lucide-react';
import { casesAPI, documentsAPI, conflictsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import CaseEditForm from '../components/CaseEditForm';

interface EntityDocument {
  id: number;
  entity_type: string;
  entity_index: number;
  entity_name: string;
  entity_inn?: string;
  entity_pinfl?: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by_name: string;
}

interface Lawyer {
  id: number;
  lawyer_id: number;
  lawyer_name: string;
  position?: string;
  email?: string;
  assigned_at: string;
  assigned_by_name: string;
}

interface CaseDetails {
  id: number;
  case_number: string;
  client_name: string;
  client_type?: 'legal' | 'individual';
  client_inn?: string;
  client_pinfl?: string;
  opponent_name?: string;
  opponent_type?: 'legal' | 'individual';
  opponent_inn?: string;
  opponent_pinfl?: string;
  case_type: string;
  description?: string;
  created_by_name: string;
  created_at: string;
  lawyers: Lawyer[]; // Changed from lawyer_name/lawyer_assigned to lawyers array
  related_companies: Array<{ name: string; inn?: string }>;
  founders: Array<{ name: string; inn?: string; pinfl?: string; type?: 'legal' | 'individual' }>;
  directors: Array<{ name: string; pinfl?: string }>;
  beneficiaries: Array<{ name: string }>;
  documents: Array<{
    id: number;
    filename: string;
    original_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
    uploaded_by_name: string;
  }>;
  conflictHistory: Array<{
    id: number;
    conflict_level: string;
    conflict_reason: string;
    conflicting_cases: number[];
    checked_at: string;
    checked_by_name: string;
  }>;
}

const CaseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entityDocuments, setEntityDocuments] = useState<Record<string, EntityDocument[]>>({});

  // Handle ESC key for delete modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDeleteModal) {
        setShowDeleteModal(false);
      }
    };
    
    if (showDeleteModal) {
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [showDeleteModal]);

  const { data: caseDetails, isLoading, error } = useQuery<CaseDetails>({
    queryKey: ['case', id],
    queryFn: async () => {
      const response = await casesAPI.getById(Number(id));
      // Ensure new fields have default values if not present
      return {
        ...response.data,
        client_type: response.data.client_type || 'legal',
        client_pinfl: response.data.client_pinfl || '',
        opponent_type: response.data.opponent_type || 'legal',
        opponent_pinfl: response.data.opponent_pinfl || ''
      };
    },
    enabled: !!id,
  });

  // Fetch entity documents
  const { data: entityDocsData } = useQuery({
    queryKey: ['entityDocuments', id],
    queryFn: async () => {
      const response = await documentsAPI.getEntityDocuments(Number(id));
      return response.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (entityDocsData) {
      setEntityDocuments(entityDocsData);
    }
  }, [entityDocsData]);

  const deleteCaseMutation = useMutation({
    mutationFn: () => casesAPI.delete(Number(id)),
    onSuccess: () => {
      // Invalidate cases list to update it
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success(t('caseDetails.caseDeleted'));
      navigate('/cases');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.deleteCaseFailed'));
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: (file: File) => documentsAPI.upload(Number(id), file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      toast.success(t('caseDetails.documentUploaded'));
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.uploadDocumentFailed'));
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: number) => documentsAPI.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      toast.success(t('caseDetails.documentDeleted'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.deleteDocumentFailed'));
    },
  });

  const deleteEntityDocumentMutation = useMutation({
    mutationFn: (documentId: number) => documentsAPI.deleteEntityFile(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entityDocuments', id] });
      toast.success(t('caseDetails.documentDeleted'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.deleteDocumentFailed'));
    },
  });

  const checkConflictMutation = useMutation({
    mutationFn: () => conflictsAPI.check(Number(id)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      const level = response.data.level;
      if (level === 'none') {
        toast.success(t('conflictCheck.noConflictsFound'));
      } else {
        toast.error(t('conflictCheck.conflictRisk', { level: t(`conflictLevels.${level}`) }));
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.checkConflictsFailed'));
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadDocumentMutation.mutate(file);
    }
  };

  const handleDownloadDocument = async (documentId: number, filename: string) => {
    try {
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${baseUrl}/documents/download/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t('errors.downloadDocumentFailed'));
    }
  };

  const handleDownloadEntityDocument = async (documentId: number, filename: string) => {
    try {
      const response = await documentsAPI.downloadEntityFile(documentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t('errors.downloadDocumentFailed'));
    }
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

  const getEntityDocuments = (entityType: string, entityIndex: number) => {
    const key = `${entityType}_${entityIndex}`;
    return entityDocuments[key] || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent"></div>
      </div>
    );
  }

  if (error || !caseDetails) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-apple-danger mx-auto mb-4" />
        <p className="text-apple-text-primary dark:text-apple-dark-text-primary">
          {t('caseDetails.failedToLoadCase')}
        </p>
        <Link to="/cases" className="text-apple-accent hover:text-blue-600 mt-2 inline-block">
          {t('caseDetails.backToCases')}
        </Link>
      </div>
    );
  }

  const latestConflict = caseDetails.conflictHistory[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={() => navigate('/cases')}
            className="flex items-center text-apple-accent hover:text-blue-600 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('caseDetails.backToCases')}
          </button>
          <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {caseDetails.client_name}
          </h1>
          <div className="flex items-center space-x-4 mt-2">
            <span className="flex items-center text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
              <Hash className="w-4 h-4 mr-1" />
              {caseDetails.case_number || `${t('cases.case')} ${caseDetails.id}`}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCaseTypeColor(
                caseDetails.case_type
              )}`}
            >
              {t(`cases.${caseDetails.case_type}`)}
            </span>
            {latestConflict && (
              <span className="flex items-center">
                {getConflictIcon(latestConflict.conflict_level)}
                <span className="ml-1 text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                  {t(`conflictLevels.${latestConflict.conflict_level}`)} {t('common.conflict')}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => checkConflictMutation.mutate()}
            disabled={checkConflictMutation.isPending}
            className="flex items-center px-4 py-2 bg-apple-surface dark:bg-apple-dark-surface text-apple-text-primary dark:text-apple-dark-text-primary rounded-apple hover:bg-gray-200 dark:hover:bg-apple-dark-bg transition-colors"
          >
            {checkConflictMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-apple-text-primary dark:border-apple-dark-text-primary mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {t('caseDetails.checkConflicts')}
          </button>
          
          {hasPermission('edit') && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple transition-colors"
            >
              <Edit className="w-5 h-5" />
            </button>
          )}
          
          {hasPermission('delete') && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Case Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
            <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
              {t('caseDetails.caseInformation')}
            </h2>
            
            <div className="space-y-4">
              {caseDetails.opponent_name && (
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.opponent')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary">
                    {caseDetails.opponent_name}
                    {caseDetails.opponent_type !== 'individual' && caseDetails.opponent_inn && (
                      <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                        ({t('caseDetails.inn')}: {caseDetails.opponent_inn})
                      </span>
                    )}
                    {caseDetails.opponent_type === 'individual' && caseDetails.opponent_pinfl && (
                      <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                        ({t('caseDetails.pinfl')}: {caseDetails.opponent_pinfl})
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                  {t('caseDetails.assignedLawyers')}
                </label>
                {caseDetails.lawyers && caseDetails.lawyers.length > 0 ? (
                  <div className="space-y-2 mt-1">
                    {caseDetails.lawyers.map((lawyer) => (
                      <div key={lawyer.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                          <div>
                            <span className="text-apple-text-primary dark:text-apple-dark-text-primary">
                              {lawyer.lawyer_name}
                            </span>
                            {lawyer.position && (
                              <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                                - {lawyer.position}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          {format(new Date(lawyer.assigned_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    {t('cases.unassigned')}
                  </p>
                )}
              </div>

              {caseDetails.description && (
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.description')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary whitespace-pre-wrap">
                    {caseDetails.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.createdBy')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary">{caseDetails.created_by_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.createdDate')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary">
                    {format(new Date(caseDetails.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Related Entities - Only show for legal entity clients */}
          {caseDetails.client_type !== 'individual' && (caseDetails.related_companies.length > 0 ||
            caseDetails.founders.length > 0 ||
            caseDetails.directors.length > 0 ||
            caseDetails.beneficiaries.length > 0) && (
            <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
              <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                {t('caseDetails.relatedEntities')}
              </h2>

              <div className="space-y-6">
                {caseDetails.related_companies.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                      {t('caseDetails.relatedCompanies')}
                    </h3>
                    <div className="space-y-3">
                      {caseDetails.related_companies.map((company, index) => {
                        const docs = getEntityDocuments('related_companies', index);
                        return (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-apple p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <Building className="w-4 h-4 mr-2 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                                <span className="text-apple-text-primary dark:text-apple-dark-text-primary">
                                  {company.name}
                                  {company.inn && (
                                    <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                                      ({t('caseDetails.inn')}: {company.inn})
                                    </span>
                                  )}
                                </span>
                              </div>

                            </div>
                            {docs.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {docs.map((doc) => (
                                  <div key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded p-2">
                                    <span className="truncate flex-1 mr-2">{doc.original_name}</span>
                                    <div className="flex items-center space-x-1">
                                      {(doc.mime_type?.includes('pdf') || doc.mime_type?.includes('image')) && (
                                        <button
                                          onClick={() => {
                                            const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';
                                            const filePath = doc.file_path;
                                            const url = `${baseUrl}/${filePath}`;
                                            window.open(url, '_blank');
                                          }}
                                          className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                          title={t('common.preview')}
                                        >
                                          <Eye className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDownloadEntityDocument(doc.id, doc.original_name)}
                                        className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      {hasPermission('delete') && (
                                        <button
                                          onClick={() => deleteEntityDocumentMutation.mutate(doc.id)}
                                          className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {caseDetails.founders.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                      {t('caseDetails.founders')}
                    </h3>
                    <div className="space-y-3">
                      {caseDetails.founders.map((founder, index) => {
                        const docs = getEntityDocuments('founders', index);
                        return (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-apple p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <User className="w-4 h-4 mr-2 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                                <span className="text-apple-text-primary dark:text-apple-dark-text-primary">
                                  {founder.name}
                                  {founder.inn && (
                                    <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                                      ({t('caseDetails.inn')}: {founder.inn})
                                    </span>
                                  )}
                                  {founder.pinfl && (
                                    <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                                      ({t('caseDetails.pinfl')}: {founder.pinfl})
                                    </span>
                                  )}
                                </span>
                              </div>

                            </div>
                            {docs.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {docs.map((doc) => (
                                  <div key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded p-2">
                                    <span className="truncate flex-1 mr-2">{doc.original_name}</span>
                                    <div className="flex items-center space-x-1">
                                      <button
                                        onClick={() => handleDownloadEntityDocument(doc.id, doc.original_name)}
                                        className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      {hasPermission('delete') && (
                                        <button
                                          onClick={() => deleteEntityDocumentMutation.mutate(doc.id)}
                                          className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {caseDetails.directors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                      {t('caseDetails.directors')}
                    </h3>
                    <div className="space-y-3">
                      {caseDetails.directors.map((director, index) => {
                        const docs = getEntityDocuments('directors', index);
                        return (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-apple p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <Shield className="w-4 h-4 mr-2 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                                <span className="text-apple-text-primary dark:text-apple-dark-text-primary">
                                  {director.name}
                                  {director.pinfl && (
                                    <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                                      ({t('caseDetails.pinfl')}: {director.pinfl})
                                    </span>
                                  )}
                                </span>
                              </div>

                            </div>
                            {docs.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {docs.map((doc) => (
                                  <div key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded p-2">
                                    <span className="truncate flex-1 mr-2">{doc.original_name}</span>
                                    <div className="flex items-center space-x-1">
                                      <button
                                        onClick={() => handleDownloadEntityDocument(doc.id, doc.original_name)}
                                        className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      {hasPermission('delete') && (
                                        <button
                                          onClick={() => deleteEntityDocumentMutation.mutate(doc.id)}
                                          className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {caseDetails.beneficiaries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                      {t('caseDetails.beneficiaries')}
                    </h3>
                    <div className="space-y-3">
                      {caseDetails.beneficiaries.map((beneficiary, index) => {
                        const docs = getEntityDocuments('beneficiaries', index);
                        return (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-apple p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <UserCheck className="w-4 h-4 mr-2 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                                <span className="text-apple-text-primary dark:text-apple-dark-text-primary">{beneficiary.name}</span>
                              </div>

                            </div>
                            {docs.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {docs.map((doc) => (
                                  <div key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded p-2">
                                    <span className="truncate flex-1 mr-2">{doc.original_name}</span>
                                    <div className="flex items-center space-x-1">
                                      <button
                                        onClick={() => handleDownloadEntityDocument(doc.id, doc.original_name)}
                                        className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      {hasPermission('delete') && (
                                        <button
                                          onClick={() => deleteEntityDocumentMutation.mutate(doc.id)}
                                          className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info for individual clients */}
          {caseDetails.client_type === 'individual' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-apple-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('newCase.individualClientNote')}
              </p>
            </div>
          )}

          {/* Documents */}
          <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('caseDetails.documents')} ({caseDetails.documents.length})
              </h2>
              {hasPermission('create') && (
                <label className="flex items-center px-3 py-1.5 bg-apple-accent text-white text-sm rounded-apple hover:bg-blue-600 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {t('caseDetails.upload')}
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                  />
                </label>
              )}
            </div>

            {caseDetails.documents.length > 0 ? (
              <div className="space-y-2">
                {caseDetails.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-apple-surface dark:bg-apple-dark-bg rounded-apple hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center flex-1">
                      <FileText className="w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary mr-3" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                          {doc.original_name}
                        </p>
                        <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          {(doc.file_size / 1024).toFixed(2)} KB • {t('common.uploadedBy')}{' '}
                          {doc.uploaded_by_name} {t('common.on')}{' '}
                          {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {(doc.mime_type?.includes('pdf') || doc.mime_type?.includes('image')) && (
                        <button
                          onClick={() => {
                            // Use direct file access instead of API endpoint to avoid auth issues
                            const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';
                            const filePath = doc.file_path || `uploads/${doc.filename}`;
                            const url = `${baseUrl}/${filePath}`;
                            window.open(url, '_blank');
                          }}
                          className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple"
                          title={t('common.preview')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                        className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {hasPermission('delete') && (
                        <button
                          onClick={() => deleteDocumentMutation.mutate(doc.id)}
                          className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-apple-text-secondary dark:text-apple-dark-text-secondary py-8">
                {t('caseDetails.noDocumentsUploaded')}
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Conflict History */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
            <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
              {t('caseDetails.conflictHistory')}
            </h2>

            {caseDetails.conflictHistory.length > 0 ? (
              <div className="space-y-3">
                {caseDetails.conflictHistory.map((check) => (
                  <div
                    key={check.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-apple p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        {getConflictIcon(check.conflict_level)}
                        <span className="ml-2 font-medium text-apple-text-primary dark:text-apple-dark-text-primary capitalize">
                          {t('caseDetails.conflictRisk', { level: t(`conflictLevels.${check.conflict_level}`) })}
                        </span>
                      </div>
                      <Clock className="w-4 h-4 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                    </div>
                    
                    {check.conflict_reason && (
                      <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                        {check.conflict_reason}
                      </p>
                    )}
                    
                    <div className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                      {t('caseDetails.checkedBy', {
                        name: check.checked_by_name,
                        date: format(new Date(check.checked_at), 'MMM d, yyyy h:mm a')
                      })}
                    </div>
                    
                    {check.conflicting_cases.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          {t('caseDetails.conflictsWith', { cases: check.conflicting_cases.join(', ') })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-apple-text-secondary dark:text-apple-dark-text-secondary py-8">
                {t('caseDetails.noConflictChecks')}
              </p>
            )}
          </div>

          {/* Client Information */}
          <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
            <h2 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
              {t('caseDetails.clientInformation')}
            </h2>
            <div className="space-y-3">
              {caseDetails.client_type && (
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.clientType')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary flex items-center">
                    {caseDetails.client_type === 'individual' ? (
                      <>
                        <User className="w-4 h-4 mr-2" />
                        {t('caseDetails.individual')}
                      </>
                    ) : (
                      <>
                        <Building className="w-4 h-4 mr-2" />
                        {t('caseDetails.legalEntity')}
                      </>
                    )}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                  {t('caseDetails.name')}
                </label>
                <p className="text-apple-text-primary dark:text-apple-dark-text-primary">{caseDetails.client_name}</p>
              </div>
              {caseDetails.client_type !== 'individual' && caseDetails.client_inn && (
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.inn')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary">{caseDetails.client_inn}</p>
                </div>
              )}
              {caseDetails.client_type === 'individual' && caseDetails.client_pinfl && (
                <div>
                  <label className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {t('caseDetails.pinfl')}
                  </label>
                  <p className="text-apple-text-primary dark:text-apple-dark-text-primary">{caseDetails.client_pinfl}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Modal */}
      {isEditing && caseDetails && (
        <CaseEditForm 
          caseData={{
            ...caseDetails,
            client_type: caseDetails.client_type || 'legal',
            client_inn: caseDetails.client_inn || '',
            client_pinfl: caseDetails.client_pinfl || '',
            opponent_name: caseDetails.opponent_name || '',
            opponent_type: caseDetails.opponent_type || 'legal',
            opponent_inn: caseDetails.opponent_inn || '',
            opponent_pinfl: caseDetails.opponent_pinfl || '',
            description: caseDetails.description || ''
          }} 
          onClose={() => setIsEditing(false)} 
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg p-6 w-full max-w-md"
            >
              <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                {t('caseDetails.deleteCase')}
              </h2>
              <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary mb-6">
                {t('caseDetails.deleteCaseConfirmation')}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => deleteCaseMutation.mutate()}
                  disabled={deleteCaseMutation.isPending}
                  className="px-4 py-2 bg-apple-danger text-white rounded-apple hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteCaseMutation.isPending ? t('caseDetails.deleting') : t('caseDetails.deleteCase')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaseDetails;