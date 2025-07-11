import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Upload,
  Trash2,
  HardDrive,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Database,
  Calendar,
  FileArchive
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { backupsAPI } from '../services/api';

interface Backup {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  modifiedAt: string;
}

interface BackupStatus {
  totalBackups: number;
  lastBackup: Backup | null;
  totalSize: number;
  autoBackupEnabled: boolean;
  nextScheduledBackup: string;
}

const Backups: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);

  // Fetch backup status
  const { data: status } = useQuery<BackupStatus>({
    queryKey: ['backupStatus'],
    queryFn: async () => {
      const response = await backupsAPI.getStatus();
      return response.data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch backups list
  const { data: backups = [], isLoading } = useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await backupsAPI.list();
      return response.data;
    }
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: backupsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
      toast.success(t('backups.createSuccess'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('backups.createError'));
    }
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) => backupsAPI.delete(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
      toast.success(t('backups.deleteSuccess'));
      setBackupToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('backups.deleteError'));
    }
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('backup', file);
      return backupsAPI.restore(formData);
    },
    onSuccess: () => {
      toast.success(t('backups.restoreSuccess'));
      setShowRestoreModal(false);
      setSelectedFile(null);
      // Reload the page after successful restore
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('backups.restoreError'));
    }
  });

  const handleDownload = async (filename: string) => {
    try {
      const response = await backupsAPI.download(filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t('backups.downloadError'));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/zip') {
      setSelectedFile(file);
    } else {
      toast.error(t('backups.invalidFile'));
    }
  };

  const handleRestore = () => {
    if (selectedFile) {
      restoreBackupMutation.mutate(selectedFile);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
          {t('backups.title')}
        </h1>
        <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
          {t('backups.subtitle')}
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Database className="w-8 h-8 text-apple-accent" />
            <span className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {status?.totalBackups || 0}
            </span>
          </div>
          <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
            {t('backups.totalBackups')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <HardDrive className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {formatFileSize(status?.totalSize || 0)}
            </span>
          </div>
          <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
            {t('backups.totalSize')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-orange-500" />
            <span className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
              {status?.lastBackup
                ? format(new Date(status.lastBackup.createdAt), 'MMM d, h:mm a')
                : t('backups.never')}
            </span>
          </div>
          <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
            {t('backups.lastBackup')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Calendar className="w-8 h-8 text-purple-500" />
            <span className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
              {status?.nextScheduledBackup
                ? format(new Date(status.nextScheduledBackup), 'MMM d, h:mm a')
                : t('backups.notScheduled')}
            </span>
          </div>
          <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
            {t('backups.nextBackup')}
          </p>
        </motion.div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => createBackupMutation.mutate()}
          disabled={createBackupMutation.isPending}
          className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {createBackupMutation.isPending ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              {t('backups.creating')}
            </>
          ) : (
            <>
              <Database className="w-5 h-5 mr-2" />
              {t('backups.createBackup')}
            </>
          )}
        </button>

        <button
          onClick={() => setShowRestoreModal(true)}
          className="flex items-center px-4 py-2 bg-green-500 text-white rounded-apple hover:bg-green-600 transition-colors"
        >
          <Upload className="w-5 h-5 mr-2" />
          {t('backups.restoreBackup')}
        </button>
      </div>

      {/* Backups List */}
      <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('backups.availableBackups')}
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent mx-auto"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-6 text-center">
            <FileArchive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary">
              {t('backups.noBackups')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {backups.map((backup) => (
              <div key={backup.filename} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <FileArchive className="w-10 h-10 text-apple-accent" />
                    <div>
                      <h3 className="font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                        {backup.filename}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                        <span>{backup.sizeFormatted}</span>
                        <span>•</span>
                        <span>{format(new Date(backup.createdAt), 'MMM d, yyyy h:mm a')}</span>
                        {backup.filename.includes('weekly') && (
                          <>
                            <span>•</span>
                            <span className="text-purple-600 dark:text-purple-400">{t('backups.weekly')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownload(backup.filename)}
                      className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-surface rounded-apple transition-colors"
                      title={t('backups.download')}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setBackupToDelete(backup.filename)}
                      className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple transition-colors"
                      title={t('backups.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Modal */}
      {showRestoreModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => {
            setShowRestoreModal(false);
            setSelectedFile(null);
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg p-6 w-full max-w-md"
          >
            <h2 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              {t('backups.restoreBackup')}
            </h2>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-apple p-4 mb-4">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('backups.restoreWarning')}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                {t('backups.selectFile')}
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                           focus:outline-none focus:ring-2 focus:ring-apple-accent
                           bg-white dark:bg-apple-dark-bg 
                           text-apple-text-primary dark:text-apple-dark-text-primary"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                  {t('backups.selected')}: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRestore}
                disabled={!selectedFile || restoreBackupMutation.isPending}
                className="px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {restoreBackupMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
                    {t('backups.restoring')}
                  </>
                ) : (
                  t('backups.restore')
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {backupToDelete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setBackupToDelete(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg p-6 w-full max-w-md"
          >
            <h2 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
              {t('backups.confirmDelete')}
            </h2>
            <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary mb-6">
              {t('backups.deleteConfirmation', { filename: backupToDelete })}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setBackupToDelete(null)}
                className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteBackupMutation.mutate(backupToDelete)}
                disabled={deleteBackupMutation.isPending}
                className="px-4 py-2 bg-apple-danger text-white rounded-apple hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteBackupMutation.isPending ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Backups;