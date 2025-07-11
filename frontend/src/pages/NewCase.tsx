import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Building,
  User,
  Users,
  Hash,
  FileText,
  AlertTriangle,
  Briefcase,
  X,
  Phone
} from 'lucide-react';
import { casesAPI, usersAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface CaseFormData {
  caseNumber: string;
  clientName: string;
  clientType: 'legal' | 'individual';
  clientInn: string;
  clientPinfl: string;
  opponentName: string;
  opponentType: 'legal' | 'individual';
  opponentInn: string;
  opponentPinfl: string;
  caseType: 'litigation' | 'contract' | 'consultation' | 'other';
  description: string;
  lawyersAssigned: number[]; // Changed from lawyerAssigned to lawyersAssigned array
  contactPersons: { name: string; phone: string }[]; // New field for contact persons
  relatedCompanies: { name: string; inn?: string }[];
  relatedIndividuals: { name: string; pinfl?: string }[]; // New field
  founders: { name: string; inn?: string; pinfl?: string; type?: 'legal' | 'individual' }[];
  directors: { name: string; pinfl?: string }[];
  beneficiaries: { name: string }[];
}

interface Lawyer {
  id: number;
  full_name: string;
  position?: string;
}

const NewCase: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [selectedLawyers, setSelectedLawyers] = useState<number[]>([]);
  const [showLawyerDropdown, setShowLawyerDropdown] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger
  } = useForm<CaseFormData>({
    defaultValues: {
      caseType: 'litigation',
      clientType: 'legal',
      opponentType: 'legal',
      lawyersAssigned: [],
      contactPersons: [{ name: '', phone: '' }], // Initialize with one empty contact person
      relatedCompanies: [],
      relatedIndividuals: [], // New field
      founders: [],
      directors: [],
      beneficiaries: [],
    },
  });

  const clientType = watch('clientType');
  const opponentType = watch('opponentType');

  const { fields: contactPersonsFields, append: appendContactPerson, remove: removeContactPerson } = 
    useFieldArray({ control, name: 'contactPersons' });

  const { fields: relatedCompaniesFields, append: appendCompany, remove: removeCompany } = 
    useFieldArray({ control, name: 'relatedCompanies' });
  
  const { fields: relatedIndividualsFields, append: appendIndividual, remove: removeIndividual } = 
    useFieldArray({ control, name: 'relatedIndividuals' }); // New field array
  
  const { fields: foundersFields, append: appendFounder, remove: removeFounder, update: updateFounder } = 
    useFieldArray({ control, name: 'founders' });
  
  const { fields: directorsFields, append: appendDirector, remove: removeDirector } = 
    useFieldArray({ control, name: 'directors' });
  
  const { fields: beneficiariesFields, append: appendBeneficiary, remove: removeBeneficiary } = 
    useFieldArray({ control, name: 'beneficiaries' });

  // Fetch lawyers for assignment
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll();
      return response.data.filter((user: any) => user.is_active);
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: casesAPI.create,
    onSuccess: (response) => {
      const conflictLevel = response.data.conflictCheck?.level;
      
      if (conflictLevel && conflictLevel !== 'none') {
        setShowConflictWarning(true);
        toast.error(`${t('newCase.conflictDetected')}: ${t(`conflictLevels.${conflictLevel}`)}`, {
          duration: 6000,
        });
      } else {
        toast.success(t('newCase.caseCreated'));
      }
      
      // Invalidate cases query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      
      // Navigate immediately to cases list
      navigate('/cases');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.createCaseFailed'));
    },
  });

  const onSubmit = async (data: CaseFormData) => {
    // Validate contact persons
    const hasValidContactPerson = data.contactPersons.some(
      cp => cp.name.trim() !== '' && cp.phone.trim() !== ''
    );

    if (!hasValidContactPerson) {
      toast.error(t('errors.contactPersonRequired'));
      return;
    }

    // Filter out empty contact persons before submitting
    const filteredData = {
      ...data,
      contactPersons: data.contactPersons.filter(cp => cp.name.trim() !== '' && cp.phone.trim() !== ''),
      lawyersAssigned: selectedLawyers,
    };

    createCaseMutation.mutate(filteredData);
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

  const selectedLawyerObjects = users?.filter((user: Lawyer) => 
    selectedLawyers.includes(user.id)
  ) || [];

  const handleFounderTypeChange = (index: number, type: 'legal' | 'individual') => {
    const currentFounder = foundersFields[index];
    updateFounder(index, {
      ...currentFounder,
      type,
      // Clear opposite field when switching type
      inn: type === 'legal' ? currentFounder.inn : undefined,
      pinfl: type === 'individual' ? currentFounder.pinfl : undefined
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <button
          onClick={() => navigate('/cases')}
          className="flex items-center text-apple-accent hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('newCase.backToCases')}
        </button>
        <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
          {t('newCase.title')}
        </h1>
        <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
          {t('newCase.subtitle')}
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        variants={itemVariants}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Basic Information */}
        <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
          <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
            {t('newCase.basicInformation')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Case Number */}
            <div>
              <label className="flex items-center text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                <Hash className="w-4 h-4 mr-2" />
                {t('newCase.caseNumber')}
              </label>
              <input
                {...register('caseNumber')}
                type="text"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                           focus:outline-none focus:ring-2 focus:ring-apple-accent
                           bg-white dark:bg-apple-dark-bg 
                           text-apple-text-primary dark:text-apple-dark-text-primary
                           placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                placeholder={t('newCase.caseNumberPlaceholder')}
              />
            </div>

            {/* Case Type */}
            <div>
              <label className="flex items-center text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                <Briefcase className="w-4 h-4 mr-2" />
                {t('newCase.caseType')}
              </label>
              <select
                {...register('caseType')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
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

            {/* Client Section */}
            <div className="md:col-span-2">
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                  {t('newCase.clientInformation')}
                </h3>
              </div>
            </div>

            {/* Client Type Toggle */}
            <div className="md:col-span-2">
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setValue('clientType', 'legal');
                    setValue('clientPinfl', '');
                  }}
                  className={`flex items-center px-4 py-2 rounded-apple transition-colors ${
                    clientType === 'legal' 
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
                    setValue('clientType', 'individual');
                    setValue('clientInn', '');
                  }}
                  className={`flex items-center px-4 py-2 rounded-apple transition-colors ${
                    clientType === 'individual' 
                      ? 'bg-apple-accent text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <User className="w-4 h-4 mr-2" />
                  {t('caseDetails.individual')}
                </button>
              </div>
            </div>

            {/* Client Name */}
            <div>
              <label className="flex items-center text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                <Building className="w-4 h-4 mr-2" />
                {t('newCase.clientName')} *
              </label>
              <input
                {...register('clientName', { required: t('newCase.clientNameRequired') })}
                type="text"
                className={`w-full px-4 py-2 border ${
                  errors.clientName ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                  bg-white dark:bg-apple-dark-bg 
                  text-apple-text-primary dark:text-apple-dark-text-primary
                  placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                placeholder={clientType === 'legal' ? t('newCase.clientNamePlaceholder') : t('newCase.clientNameIndividualPlaceholder')}
              />
              {errors.clientName && (
                <p className="mt-1 text-sm text-apple-danger">{errors.clientName.message}</p>
              )}
            </div>

            {/* Client INN or PINFL */}
            <div>
              {clientType === 'legal' ? (
                <>
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2 block">
                    {t('newCase.clientInn')} *
                  </label>
                  <input
                    {...register('clientInn', { 
                      required: clientType === 'legal' ? t('errors.clientInnRequired') : false 
                    })}
                    type="text"
                    className={`w-full px-4 py-2 border ${
                      errors.clientInn ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                    } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                      bg-white dark:bg-apple-dark-bg 
                      text-apple-text-primary dark:text-apple-dark-text-primary
                      placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                    placeholder={t('newCase.clientInnPlaceholder')}
                  />
                  {errors.clientInn && (
                    <p className="mt-1 text-sm text-apple-danger">{errors.clientInn.message}</p>
                  )}
                </>
              ) : (
                <>
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2 block">
                    {t('caseDetails.pinfl')} *
                  </label>
                  <input
                    {...register('clientPinfl', { 
                      required: clientType === 'individual' ? t('errors.clientPinflRequired') : false 
                    })}
                    type="text"
                    className={`w-full px-4 py-2 border ${
                      errors.clientPinfl ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                    } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                      bg-white dark:bg-apple-dark-bg 
                      text-apple-text-primary dark:text-apple-dark-text-primary
                      placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                    placeholder={t('newCase.clientPinflPlaceholder')}
                  />
                  {errors.clientPinfl && (
                    <p className="mt-1 text-sm text-apple-danger">{errors.clientPinfl.message}</p>
                  )}
                </>
              )}
            </div>

            {/* Opponent Section */}
            <div className="md:col-span-2">
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h3 className="text-lg font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                  {t('newCase.opponentInformation')}
                </h3>
              </div>
            </div>

            {/* Opponent Type Toggle */}
            <div className="md:col-span-2">
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setValue('opponentType', 'legal');
                    setValue('opponentPinfl', '');
                  }}
                  className={`flex items-center px-4 py-2 rounded-apple transition-colors ${
                    opponentType === 'legal' 
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
                    setValue('opponentType', 'individual');
                    setValue('opponentInn', '');
                  }}
                  className={`flex items-center px-4 py-2 rounded-apple transition-colors ${
                    opponentType === 'individual' 
                      ? 'bg-apple-accent text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <User className="w-4 h-4 mr-2" />
                  {t('caseDetails.individual')}
                </button>
              </div>
            </div>

            {/* Opponent Name */}
            <div>
              <label className="flex items-center text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                <Building className="w-4 h-4 mr-2" />
                {t('newCase.opponentName')}
              </label>
              <input
                {...register('opponentName')}
                type="text"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                           focus:outline-none focus:ring-2 focus:ring-apple-accent
                           bg-white dark:bg-apple-dark-bg 
                           text-apple-text-primary dark:text-apple-dark-text-primary
                           placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                placeholder={opponentType === 'legal' ? t('newCase.opponentNamePlaceholder') : t('newCase.opponentNameIndividualPlaceholder')}
              />
            </div>

            {/* Opponent INN or PINFL */}
            <div>
              {opponentType === 'legal' ? (
                <>
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2 block">
                    {t('newCase.opponentInn')}
                  </label>
                  <input
                    {...register('opponentInn')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-apple-dark-bg 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                    placeholder={t('newCase.opponentInnPlaceholder')}
                  />
                </>
              ) : (
                <>
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2 block">
                    {t('caseDetails.pinfl')}
                  </label>
                  <input
                    {...register('opponentPinfl')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-apple-dark-bg 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                    placeholder={t('newCase.opponentPinflPlaceholder')}
                  />
                </>
              )}
            </div>

            {/* Lawyers Assignment - Multi-select */}
            <div className="md:col-span-2">
              <label className="flex items-center text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                <Users className="w-4 h-4 mr-2" />
                {t('newCase.assignLawyers')}
              </label>
              
              <div className="relative">
                {/* Selected lawyers display */}
                <div className="min-h-[42px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                             bg-white dark:bg-apple-dark-bg cursor-pointer"
                     onClick={() => setShowLawyerDropdown(!showLawyerDropdown)}>
                  {selectedLawyerObjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedLawyerObjects.map((lawyer: Lawyer) => (
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
                    {users?.map((user: Lawyer) => (
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

            {/* Description */}
            <div className="md:col-span-2">
              <label className="flex items-center text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                <FileText className="w-4 h-4 mr-2" />
                {t('newCase.description')}
              </label>
              <textarea
                {...register('description')}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                           focus:outline-none focus:ring-2 focus:ring-apple-accent
                           bg-white dark:bg-apple-dark-bg 
                           text-apple-text-primary dark:text-apple-dark-text-primary
                           placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                placeholder={t('newCase.descriptionPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Related Entities */}
        <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6">
          <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
            {t('newCase.relatedEntities')}
          </h2>

          {/* Contact Persons - REQUIRED */}
          <div className="mb-6 p-4 border-2 border-apple-accent rounded-apple">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('newCase.contactPersons')} <span className="text-apple-danger">*</span>
              </label>
              <button
                type="button"
                onClick={() => appendContactPerson({ name: '', phone: '' })}
                className="flex items-center text-sm text-apple-accent hover:text-blue-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('newCase.addContactPerson')}
              </button>
            </div>
            <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">
              {t('newCase.contactPersonsRequired')}
            </p>
            {contactPersonsFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input
                  {...register(`contactPersons.${index}.name` as const, {
                    validate: (value) => {
                      const phone = watch(`contactPersons.${index}.phone`);
                      if (phone && phone.trim() !== '' && (!value || value.trim() === '')) {
                        return t('newCase.contactNameRequired');
                      }
                      return true;
                    }
                  })}
                  placeholder={t('newCase.contactNamePlaceholder')}
                  className={`flex-1 px-3 py-2 border ${
                    errors.contactPersons?.[index]?.name ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                  } rounded-apple text-sm
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                />
                <input
                  {...register(`contactPersons.${index}.phone` as const, {
                    validate: (value) => {
                      const name = watch(`contactPersons.${index}.name`);
                      if (name && name.trim() !== '' && (!value || value.trim() === '')) {
                        return t('newCase.phoneRequired');
                      }
                      return true;
                    }
                  })}
                  placeholder={t('newCase.phonePlaceholder')}
                  className={`w-36 px-3 py-2 border ${
                    errors.contactPersons?.[index]?.phone ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                  } rounded-apple text-sm
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (contactPersonsFields.length > 1) {
                      removeContactPerson(index);
                    } else {
                      toast.error(t('newCase.atLeastOneContactRequired'));
                    }
                  }}
                  className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                  disabled={contactPersonsFields.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Related Companies */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('newCase.relatedCompanies')}
              </label>
              <button
                type="button"
                onClick={() => appendCompany({ name: '', inn: '' })}
                className="flex items-center text-sm text-apple-accent hover:text-blue-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('newCase.addCompany')}
              </button>
            </div>
            {relatedCompaniesFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input
                  {...register(`relatedCompanies.${index}.name` as const)}
                  placeholder={t('newCase.companyNamePlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                />
                <input
                  {...register(`relatedCompanies.${index}.inn` as const)}
                  placeholder={t('newCase.innOptionalPlaceholder')}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                />
                <button
                  type="button"
                  onClick={() => removeCompany(index)}
                  className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Related Individuals - Always shown */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('newCase.relatedIndividuals')}
              </label>
              <button
                type="button"
                onClick={() => appendIndividual({ name: '', pinfl: '' })}
                className="flex items-center text-sm text-apple-accent hover:text-blue-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('newCase.addIndividual')}
              </button>
            </div>
            {relatedIndividualsFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input
                  {...register(`relatedIndividuals.${index}.name` as const)}
                  placeholder={t('newCase.individualNamePlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                />
                <input
                  {...register(`relatedIndividuals.${index}.pinfl` as const)}
                  placeholder={t('caseDetails.pinfl')}
                  className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                             bg-white dark:bg-apple-dark-bg 
                             text-apple-text-primary dark:text-apple-dark-text-primary
                             placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                />
                <button
                  type="button"
                  onClick={() => removeIndividual(index)}
                  className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Only show Founders, Directors, Beneficiaries for legal entities */}
          {clientType === 'legal' && (
            <>
              {/* Founders */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                    {t('newCase.founders')}
                  </label>
                  <button
                    type="button"
                    onClick={() => appendFounder({ name: '', type: 'legal', inn: '' })}
                    className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('newCase.addFounder')}
                  </button>
                </div>
                {foundersFields.map((field, index) => (
                  <div key={field.id} className="space-y-2 mb-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleFounderTypeChange(index, 'legal')}
                        className={`flex items-center px-3 py-1 text-sm rounded-apple transition-colors ${
                          field.type === 'legal' 
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
                          field.type === 'individual' 
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
                        {...register(`founders.${index}.name` as const)}
                        placeholder={t('newCase.founderNamePlaceholder')}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary
                                   placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                      />
                      {field.type === 'legal' ? (
                        <input
                          {...register(`founders.${index}.inn` as const)}
                          placeholder={t('newCase.innOptionalPlaceholder')}
                          className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                                     bg-white dark:bg-apple-dark-bg 
                                     text-apple-text-primary dark:text-apple-dark-text-primary
                                     placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                        />
                      ) : (
                        <input
                          {...register(`founders.${index}.pinfl` as const)}
                          placeholder={t('caseDetails.pinfl')}
                          className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                                     bg-white dark:bg-apple-dark-bg 
                                     text-apple-text-primary dark:text-apple-dark-text-primary
                                     placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeFounder(index)}
                        className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Directors */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                    {t('newCase.directors')}
                  </label>
                  <button
                    type="button"
                    onClick={() => appendDirector({ name: '', pinfl: '' })}
                    className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('newCase.addDirector')}
                  </button>
                </div>
                {directorsFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 mb-2">
                    <input
                      {...register(`directors.${index}.name` as const)}
                      placeholder={t('newCase.directorNamePlaceholder')}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary
                                 placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                    />
                    <input
                      {...register(`directors.${index}.pinfl` as const)}
                      placeholder={t('caseDetails.pinfl')}
                      className="w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary
                                 placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => removeDirector(index)}
                      className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Beneficiaries */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                    {t('newCase.beneficiaries')}
                  </label>
                  <button
                    type="button"
                    onClick={() => appendBeneficiary({ name: '' })}
                    className="flex items-center text-sm text-apple-accent hover:text-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('newCase.addBeneficiary')}
                  </button>
                </div>
                {beneficiariesFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 mb-2">
                    <input
                      {...register(`beneficiaries.${index}.name` as const)}
                      placeholder={t('caseDetails.beneficiaryName')}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary
                                 placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => removeBeneficiary(index)}
                      className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Conflict Warning */}
        {showConflictWarning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-apple-lg p-4"
          >
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-apple-danger mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-semibold text-apple-danger">
                  {t('newCase.conflictDetected')}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {t('newCase.conflictWarning')}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/cases')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-apple-text-primary dark:text-apple-dark-text-primary 
                       rounded-apple hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={createCaseMutation.isPending}
            className="flex items-center px-6 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 
                       transition-colors disabled:opacity-50"
          >
            {createCaseMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('newCase.creating')}
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {t('newCase.createCase')}
              </>
            )}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

export default NewCase;