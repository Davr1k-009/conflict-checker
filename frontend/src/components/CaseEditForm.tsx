import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Paperclip, FileText, Download, Building, User, Users, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { casesAPI, documentsAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';

interface RelatedEntity {
  name: string;
  inn?: string;
  pinfl?: string;
  type?: 'legal' | 'individual';
}

interface CaseEditFormProps {
  caseData: {
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
    lawyers?: Array<{ lawyer_id: number; lawyer_name: string }>; // Array of lawyers
    contact_persons?: Array<{ name: string; phone: string }>; // New field for contact persons
    related_companies: Array<{ name: string; inn?: string }>;
    related_individuals?: Array<{ name: string; pinfl?: string }>; // New field
    founders: Array<{ name: string; inn?: string; pinfl?: string; type?: 'legal' | 'individual' }>;
    directors: Array<{ name: string; pinfl?: string }>;
    beneficiaries: Array<{ name: string }>;
  };
  onClose: () => void;
}

type EntityFieldType = 'contact_persons' | 'related_companies' | 'related_individuals' | 'founders' | 'directors' | 'beneficiaries';

interface EntityDocuments {
  [key: string]: Array<{
    id: number;
    filename: string;
    original_name: string;
    file_size: number;
    uploaded_at: string;
    uploaded_by_name: string;
  }>;
}

const CaseEditForm: React.FC<CaseEditFormProps> = ({ caseData, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  // State for lawyer multi-select
  const [selectedLawyers, setSelectedLawyers] = useState<number[]>(
    caseData.lawyers?.map(l => l.lawyer_id) || []
  );
  const [showLawyerDropdown, setShowLawyerDropdown] = useState(false);
  
  interface FormDataType {
    client_name: string;
    client_type: 'legal' | 'individual';
    client_inn: string;
    client_pinfl: string;
    opponent_name: string;
    opponent_type: 'legal' | 'individual';
    opponent_inn: string;
    opponent_pinfl: string;
    case_type: string;
    description: string;
    lawyersAssigned: number[]; // Changed to array
    contact_persons: Array<{ name: string; phone: string }>; // New field
    related_companies: Array<{ name: string; inn?: string }>;
    related_individuals: Array<{ name: string; pinfl?: string }>; // New field
    founders: Array<{ name: string; inn?: string; pinfl?: string; type?: 'legal' | 'individual' }>;
    directors: Array<{ name: string; pinfl?: string }>;
    beneficiaries: Array<{ name: string }>;
  }
  
  const [formData, setFormData] = useState<FormDataType>({
    client_name: caseData.client_name,
    client_type: caseData.client_type || 'legal',
    client_inn: caseData.client_inn || '',
    client_pinfl: caseData.client_pinfl || '',
    opponent_name: caseData.opponent_name || '',
    opponent_type: caseData.opponent_type || 'legal',
    opponent_inn: caseData.opponent_inn || '',
    opponent_pinfl: caseData.opponent_pinfl || '',
    case_type: caseData.case_type,
    description: caseData.description || '',
    lawyersAssigned: selectedLawyers, // Use selected lawyers array
    contact_persons: caseData.contact_persons && caseData.contact_persons.length > 0 
      ? caseData.contact_persons 
      : [{ name: '', phone: '' }], // Initialize with at least one contact person
    related_companies: caseData.related_companies || [],
    related_individuals: caseData.related_individuals || [], // New field
    founders: (caseData.founders || []).map(f => ({
      ...f,
      type: f.type || (f.inn ? 'legal' : f.pinfl ? 'individual' : 'legal')
    })),
    directors: caseData.directors || [],
    beneficiaries: caseData.beneficiaries || []
  });

  const [errors, setErrors] = useState<{
    client_inn?: string;
    client_pinfl?: string;
  }>({});

  // Fetch available lawyers
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll();
      return response.data.filter((user: any) => user.is_active);
    }
  });

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Fetch entity documents
  const { data: entityDocuments = {} } = useQuery<EntityDocuments>({
    queryKey: ['entityDocuments', caseData.id],
    queryFn: async () => {
      const response = await documentsAPI.getEntityDocuments(caseData.id);
      return response.data;
    }
  });

  const updateCaseMutation = useMutation({
    mutationFn: (data: any) => casesAPI.update(caseData.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', String(caseData.id)] });
      toast.success(t('caseDetails.caseUpdated'));
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.updateCaseFailed'));
    },
  });

  const uploadEntityFileMutation = useMutation({
    mutationFn: (params: { 
      file: File; 
      entityType: string; 
      entityIndex: number; 
      entityName: string; 
      entityInn?: string; 
      entityPinfl?: string 
    }) => {
      const formData = new FormData();
      formData.append('document', params.file);
      formData.append('entityType', params.entityType);
      formData.append('entityIndex', params.entityIndex.toString());
      formData.append('entityName', params.entityName);
      if (params.entityInn) formData.append('entityInn', params.entityInn);
      if (params.entityPinfl) formData.append('entityPinfl', params.entityPinfl);
      
      return documentsAPI.uploadEntityFile(caseData.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entityDocuments', caseData.id] });
      toast.success(t('caseDetails.documentUploaded'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.uploadDocumentFailed'));
    },
  });

  const deleteEntityFileMutation = useMutation({
    mutationFn: (documentId: number) => documentsAPI.deleteEntityFile(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entityDocuments', caseData.id] });
      toast.success(t('caseDetails.documentDeleted'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.deleteDocumentFailed'));
    },
  });

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    // Validate INN for legal entities
    if (formData.client_type === 'legal' && !formData.client_inn.trim()) {
      newErrors.client_inn = t('errors.clientInnRequired');
    }
    
    // Validate PINFL for individuals
    if (formData.client_type === 'individual' && !formData.client_pinfl.trim()) {
      newErrors.client_pinfl = t('errors.clientPinflRequired');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate INN/PINFL
    if (!validateForm()) {
      return;
    }
    
    // Validate contact persons
    const hasValidContactPerson = formData.contact_persons.some(
      cp => cp.name.trim() !== '' && cp.phone.trim() !== ''
    );

    if (!hasValidContactPerson) {
      toast.error(t('errors.contactPersonRequired'));
      return;
    }

    // Filter out empty contact persons before submitting
    const filteredData = {
      ...formData,
      contact_persons: formData.contact_persons.filter(cp => cp.name.trim() !== '' && cp.phone.trim() !== ''),
      lawyersAssigned: selectedLawyers
    };

    updateCaseMutation.mutate(filteredData);
  };
  
  const toggleLawyer = (lawyerId: number) => {
    setSelectedLawyers(prev => 
      prev.includes(lawyerId) 
        ? prev.filter(id => id !== lawyerId)
        : [...prev, lawyerId]
    );
  };

  const removeLawyer = (lawyerId: number) => {
    setSelectedLawyers(prev => prev.filter(id => id !== lawyerId));
  };

  const selectedLawyerObjects = users?.filter((user: any) => 
    selectedLawyers.includes(user.id)
  ) || [];

  const handleAddEntity = (field: EntityFieldType) => {
    const newEntity = field === 'contact_persons'
      ? { name: '', phone: '' }
      : field === 'directors' || field === 'related_individuals'
      ? { name: '', pinfl: '' }
      : field === 'related_companies'
        ? { name: '', inn: '' }
        : field === 'founders'
          ? { name: '', type: 'legal' as const, inn: '' }
          : { name: '' };
    
    setFormData({
      ...formData,
      [field]: [...formData[field], newEntity] as any
    });
  };

  const handleRemoveEntity = (field: EntityFieldType, index: number) => {
    if (field === 'contact_persons' && formData.contact_persons.length === 1) {
      toast.error(t('newCase.atLeastOneContactRequired'));
      return;
    }
    
    setFormData({
      ...formData,
      [field]: formData[field].filter((_, i) => i !== index)
    });
  };

  const handleEntityChange = (field: EntityFieldType, index: number, key: string, value: string) => {
    const updated = [...formData[field]] as any[];
    updated[index] = { ...updated[index], [key]: value };
    setFormData({ ...formData, [field]: updated });
  };

  const handleFounderTypeChange = (index: number, type: 'legal' | 'individual') => {
    const updated = [...formData.founders];
    updated[index] = { 
      ...updated[index], 
      type,
      // Clear opposite field when switching type
      inn: type === 'legal' ? updated[index].inn : undefined,
      pinfl: type === 'individual' ? updated[index].pinfl : undefined
    };
    setFormData({ ...formData, founders: updated });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, entityType: EntityFieldType, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const entity = formData[entityType][index] as any;
    if (!entity.name) {
      toast.error(t('errors.entityNameRequired'));
      return;
    }

    uploadEntityFileMutation.mutate({
      file,
      entityType,
      entityIndex: index,
      entityName: entity.name,
      entityInn: entity.inn,
      entityPinfl: entity.pinfl
    });

    // Clear the input
    e.target.value = '';
  };

  const getEntityDocuments = (entityType: EntityFieldType, index: number) => {
    const key = `${entityType}_${index}`;
    return entityDocuments[key] || [];
  };

  const handleDownloadDocument = async (documentId: number, filename: string) => {
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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('caseDetails.editCase')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                {t('caseDetails.basicInformation')}
              </h3>
              
              {/* Client Section */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                  {t('newCase.clientInformation')}
                </h4>
                
                {/* Client Type Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, client_type: 'legal', client_pinfl: '' });
                      setErrors({});
                    }}
                    className={`flex items-center px-3 py-1.5 rounded-apple transition-colors ${
                      formData.client_type === 'legal' 
                        ? 'bg-apple-accent text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Building className="w-4 h-4 mr-2" />
                    {t('caseDetails.legalEntity')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, client_type: 'individual', client_inn: '' });
                      setErrors({});
                    }}
                    className={`flex items-center px-3 py-1.5 rounded-apple transition-colors ${
                      formData.client_type === 'individual' 
                        ? 'bg-apple-accent text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <User className="w-4 h-4 mr-2" />
                    {t('caseDetails.individual')}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                      {t('caseDetails.clientName')} *
                    </label>
                    <input
                      type="text"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent 
                               bg-white dark:bg-apple-dark-bg 
                               text-apple-text-primary dark:text-apple-dark-text-primary"
                      required
                    />
                  </div>
                  <div>
                    {formData.client_type === 'legal' ? (
                      <>
                        <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                          {t('caseDetails.clientInn')} *
                        </label>
                        <input
                          type="text"
                          value={formData.client_inn}
                          onChange={(e) => {
                            setFormData({ ...formData, client_inn: e.target.value });
                            if (errors.client_inn) setErrors({ ...errors, client_inn: undefined });
                          }}
                          className={`w-full px-3 py-2 border ${
                            errors.client_inn ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                          } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent 
                            bg-white dark:bg-apple-dark-bg 
                            text-apple-text-primary dark:text-apple-dark-text-primary`}
                        />
                        {errors.client_inn && (
                          <p className="mt-1 text-sm text-apple-danger">{errors.client_inn}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                          {t('caseDetails.pinfl')} *
                        </label>
                        <input
                          type="text"
                          value={formData.client_pinfl}
                          onChange={(e) => {
                            setFormData({ ...formData, client_pinfl: e.target.value });
                            if (errors.client_pinfl) setErrors({ ...errors, client_pinfl: undefined });
                          }}
                          className={`w-full px-3 py-2 border ${
                            errors.client_pinfl ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                          } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent 
                            bg-white dark:bg-apple-dark-bg 
                            text-apple-text-primary dark:text-apple-dark-text-primary`}
                        />
                        {errors.client_pinfl && (
                          <p className="mt-1 text-sm text-apple-danger">{errors.client_pinfl}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Opponent Section */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                  {t('newCase.opponentInformation')}
                </h4>
                
                {/* Opponent Type Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, opponent_type: 'legal', opponent_pinfl: '' });
                    }}
                    className={`flex items-center px-3 py-1.5 rounded-apple transition-colors ${
                      formData.opponent_type === 'legal' 
                        ? 'bg-apple-accent text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Building className="w-4 h-4 mr-2" />
                    {t('caseDetails.legalEntity')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, opponent_type: 'individual', opponent_inn: '' });
                    }}
                    className={`flex items-center px-3 py-1.5 rounded-apple transition-colors ${
                      formData.opponent_type === 'individual' 
                        ? 'bg-apple-accent text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <User className="w-4 h-4 mr-2" />
                    {t('caseDetails.individual')}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                      {t('caseDetails.opponentName')}
                    </label>
                    <input
                      type="text"
                      value={formData.opponent_name}
                      onChange={(e) => setFormData({ ...formData, opponent_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent 
                               bg-white dark:bg-apple-dark-bg 
                               text-apple-text-primary dark:text-apple-dark-text-primary"
                    />
                  </div>
                  <div>
                    {formData.opponent_type === 'legal' ? (
                      <>
                        <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                          {t('caseDetails.opponentInn')}
                        </label>
                        <input
                          type="text"
                          value={formData.opponent_inn}
                          onChange={(e) => setFormData({ ...formData, opponent_inn: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                   focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary"
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                          {t('caseDetails.pinfl')}
                        </label>
                        <input
                          type="text"
                          value={formData.opponent_pinfl}
                          onChange={(e) => setFormData({ ...formData, opponent_pinfl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                   focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                    {t('caseDetails.caseType')}
                  </label>
                  <select
                    value={formData.case_type}
                    onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             focus:outline-none focus:ring-2 focus:ring-apple-accent 
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary"
                  >
                    <option value="litigation">{t('cases.litigation')}</option>
                    <option value="contract">{t('cases.contract')}</option>
                    <option value="consultation">{t('cases.consultation')}</option>
                    <option value="other">{t('cases.other')}</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                  {t('caseDetails.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                           focus:outline-none focus:ring-2 focus:ring-apple-accent 
                           bg-white dark:bg-apple-dark-bg 
                           text-apple-text-primary dark:text-apple-dark-text-primary"
                />
              </div>
              
              {/* Lawyers Assignment - Multi-select */}
              <div className="mt-4">
                <label className="flex items-center text-sm font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary mb-1">
                  <Users className="w-4 h-4 mr-2" />
                  {t('caseDetails.assignedLawyers')}
                </label>
                
                <div className="relative">
                  {/* Selected lawyers display */}
                  <div className="min-h-[42px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               bg-white dark:bg-apple-dark-bg cursor-pointer"
                       onClick={() => setShowLawyerDropdown(!showLawyerDropdown)}>
                    {selectedLawyerObjects.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedLawyerObjects.map((lawyer: any) => (
                          <span key={lawyer.id} 
                                className="inline-flex items-center px-2 py-1 bg-apple-accent text-white rounded-full text-sm">
                            {lawyer.full_name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLawyer(lawyer.id);
                              }}
                              className="ml-1 hover:text-gray-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-apple-text-secondary dark:text-apple-dark-text-secondary">
                        {t('newCase.selectLawyers')}
                      </span>
                    )}
                  </div>

                  {/* Dropdown */}
                  {showLawyerDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-apple-dark-bg border border-gray-300 dark:border-gray-600 rounded-apple shadow-lg max-h-60 overflow-auto">
                      {users?.map((user: any) => (
                        <div
                          key={user.id}
                          onClick={() => toggleLawyer(user.id)}
                          className={`px-4 py-2 cursor-pointer hover:bg-apple-surface dark:hover:bg-apple-dark-surface
                                      ${selectedLawyers.includes(user.id) ? 'bg-apple-surface dark:bg-apple-dark-surface' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-apple-text-primary dark:text-apple-dark-text-primary">
                                {user.full_name}
                              </span>
                              {user.position && (
                                <span className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary ml-2">
                                  - {user.position}
                                </span>
                              )}
                            </div>
                            {selectedLawyers.includes(user.id) && (
                              <div className="w-5 h-5 bg-apple-accent rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Click outside to close dropdown */}
                {showLawyerDropdown && (
                  <div className="fixed inset-0 z-0" onClick={() => setShowLawyerDropdown(false)} />
                )}
              </div>
            </div>

            {/* Related Entities */}
            {/* Contact Persons - REQUIRED */}
            <div className="p-4 border-2 border-apple-accent rounded-apple">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                  {t('caseDetails.contactPersons')} <span className="text-apple-danger">*</span>
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddEntity('contact_persons')}
                  className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('common.add')}
                </button>
              </div>
              <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">
                {t('newCase.contactPersonsRequired')}
              </p>
              <div className="space-y-3">
                {formData.contact_persons.map((person, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => handleEntityChange('contact_persons', index, 'name', e.target.value)}
                        placeholder={t('caseDetails.contactName')}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                        required
                      />
                      <input
                        type="text"
                        value={person.phone || ''}
                        onChange={(e) => handleEntityChange('contact_persons', index, 'phone', e.target.value)}
                        placeholder={t('caseDetails.phone')}
                        className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                        required
                      />
                      <label className="flex items-center p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple cursor-pointer">
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'contact_persons', index)}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntity('contact_persons', index)}
                        className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                        disabled={formData.contact_persons.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Attached files */}
                    {getEntityDocuments('contact_persons', index).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {getEntityDocuments('contact_persons', index).map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-gray-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{doc.original_name}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                                className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteEntityFileMutation.mutate(doc.id)}
                                className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Related Companies */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                  {t('caseDetails.relatedCompanies')}
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddEntity('related_companies')}
                  className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('common.add')}
                </button>
              </div>
              <div className="space-y-3">
                {formData.related_companies.map((company, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={company.name}
                        onChange={(e) => handleEntityChange('related_companies', index, 'name', e.target.value)}
                        placeholder={t('caseDetails.companyName')}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                      <input
                        type="text"
                        value={company.inn || ''}
                        onChange={(e) => handleEntityChange('related_companies', index, 'inn', e.target.value)}
                        placeholder={t('caseDetails.inn')}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                      <label className="flex items-center p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple cursor-pointer">
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'related_companies', index)}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntity('related_companies', index)}
                        className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Attached files */}
                    {getEntityDocuments('related_companies', index).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {getEntityDocuments('related_companies', index).map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-gray-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{doc.original_name}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                                className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteEntityFileMutation.mutate(doc.id)}
                                className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Related Individuals - Always shown */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                  {t('caseDetails.relatedIndividuals')}
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddEntity('related_individuals')}
                  className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('common.add')}
                </button>
              </div>
              <div className="space-y-3">
                {formData.related_individuals.map((individual, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={individual.name}
                        onChange={(e) => handleEntityChange('related_individuals', index, 'name', e.target.value)}
                        placeholder={t('caseDetails.individualName')}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                      <input
                        type="text"
                        value={individual.pinfl || ''}
                        onChange={(e) => handleEntityChange('related_individuals', index, 'pinfl', e.target.value)}
                        placeholder={t('caseDetails.pinfl')}
                        className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                      <label className="flex items-center p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple cursor-pointer">
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'related_individuals', index)}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntity('related_individuals', index)}
                        className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Attached files */}
                    {getEntityDocuments('related_individuals', index).length > 0 && (
                      <div className="pl-4 space-y-1">
                        {getEntityDocuments('related_individuals', index).map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-gray-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{doc.original_name}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                                className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteEntityFileMutation.mutate(doc.id)}
                                className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Only show Founders, Directors, Beneficiaries for legal entities */}
            {formData.client_type !== 'individual' ? (
              <>
                {/* Founders */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                      {t('caseDetails.founders')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddEntity('founders')}
                      className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('common.add')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.founders.map((founder, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => handleFounderTypeChange(index, 'legal')}
                            className={`flex items-center px-3 py-1 text-sm rounded-apple transition-colors ${
                              founder.type === 'legal' 
                                ? 'bg-apple-accent text-white' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Building className="w-3 h-3 mr-1" />
                            {t('caseDetails.legalEntity')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFounderTypeChange(index, 'individual')}
                            className={`flex items-center px-3 py-1 text-sm rounded-apple transition-colors ${
                              founder.type === 'individual' 
                                ? 'bg-apple-accent text-white' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <User className="w-3 h-3 mr-1" />
                            {t('caseDetails.individual')}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={founder.name}
                            onChange={(e) => handleEntityChange('founders', index, 'name', e.target.value)}
                            placeholder={t('caseDetails.founderName')}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                     focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                     bg-white dark:bg-apple-dark-bg 
                                     text-apple-text-primary dark:text-apple-dark-text-primary"
                          />
                          {founder.type === 'legal' ? (
                            <input
                              type="text"
                              value={founder.inn || ''}
                              onChange={(e) => handleEntityChange('founders', index, 'inn', e.target.value)}
                              placeholder={t('caseDetails.inn')}
                              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                       focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                       bg-white dark:bg-apple-dark-bg 
                                       text-apple-text-primary dark:text-apple-dark-text-primary"
                            />
                          ) : (
                            <input
                              type="text"
                              value={founder.pinfl || ''}
                              onChange={(e) => handleEntityChange('founders', index, 'pinfl', e.target.value)}
                              placeholder={t('caseDetails.pinfl')}
                              className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                       focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                       bg-white dark:bg-apple-dark-bg 
                                       text-apple-text-primary dark:text-apple-dark-text-primary"
                            />
                          )}
                          <label className="flex items-center p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple cursor-pointer">
                            <Paperclip className="w-4 h-4" />
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload(e, 'founders', index)}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveEntity('founders', index)}
                            className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Attached files */}
                        {getEntityDocuments('founders', index).length > 0 && (
                          <div className="pl-4 space-y-1">
                            {getEntityDocuments('founders', index).map((doc: any) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="flex items-center">
                                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{doc.original_name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                                    className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteEntityFileMutation.mutate(doc.id)}
                                    className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Directors */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                      {t('caseDetails.directors')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddEntity('directors')}
                      className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('common.add')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.directors.map((director, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={director.name}
                            onChange={(e) => handleEntityChange('directors', index, 'name', e.target.value)}
                            placeholder={t('caseDetails.directorName')}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                     focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                     bg-white dark:bg-apple-dark-bg 
                                     text-apple-text-primary dark:text-apple-dark-text-primary"
                          />
                          <input
                            type="text"
                            value={director.pinfl || ''}
                            onChange={(e) => handleEntityChange('directors', index, 'pinfl', e.target.value)}
                            placeholder={t('caseDetails.pinfl')}
                            className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                     focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                     bg-white dark:bg-apple-dark-bg 
                                     text-apple-text-primary dark:text-apple-dark-text-primary"
                          />
                          <label className="flex items-center p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple cursor-pointer">
                            <Paperclip className="w-4 h-4" />
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload(e, 'directors', index)}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveEntity('directors', index)}
                            className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Attached files */}
                        {getEntityDocuments('directors', index).length > 0 && (
                          <div className="pl-4 space-y-1">
                            {getEntityDocuments('directors', index).map((doc: any) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="flex items-center">
                                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{doc.original_name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                                    className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteEntityFileMutation.mutate(doc.id)}
                                    className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beneficiaries */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                      {t('caseDetails.beneficiaries')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddEntity('beneficiaries')}
                      className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('common.add')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.beneficiaries.map((beneficiary, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={beneficiary.name}
                            onChange={(e) => handleEntityChange('beneficiaries', index, 'name', e.target.value)}
                            placeholder={t('caseDetails.beneficiaryName')}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                                     focus:outline-none focus:ring-2 focus:ring-apple-accent 
                                     bg-white dark:bg-apple-dark-bg 
                                     text-apple-text-primary dark:text-apple-dark-text-primary"
                          />
                          <label className="flex items-center p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple cursor-pointer">
                            <Paperclip className="w-4 h-4" />
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload(e, 'beneficiaries', index)}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveEntity('beneficiaries', index)}
                            className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Attached files */}
                        {getEntityDocuments('beneficiaries', index).length > 0 && (
                          <div className="pl-4 space-y-1">
                            {getEntityDocuments('beneficiaries', index).map((doc: any) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="flex items-center">
                                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{doc.original_name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDocument(doc.id, doc.original_name)}
                                    className="p-1 text-apple-accent hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteEntityFileMutation.mutate(doc.id)}
                                    className="p-1 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-apple p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('newCase.individualClientNote')}
                </p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={updateCaseMutation.isPending}
              className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {updateCaseMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseEditForm;