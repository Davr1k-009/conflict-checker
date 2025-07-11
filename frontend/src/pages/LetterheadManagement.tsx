import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Trash2,
  Download,
  FileImage,
  Calendar,
  User,
  Eye
} from 'lucide-react';
import { letterheadAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Letterhead {
  id: number;
  name: string;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  is_active: boolean;
  uploaded_by_name: string;
  uploaded_at: string;
}

const LetterheadManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [letterheadName, setLetterheadName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: letterheads, isLoading } = useQuery<Letterhead[]>({
    queryKey: ['letterheads'],
    queryFn: async () => {
      const response = await letterheadAPI.getAll();
      return response.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => 
      letterheadAPI.upload(file, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letterheads'] });
      toast.success(t('letterhead.uploadSuccess'));
      setShowUploadModal(false);
      setSelectedFile(null);
      setLetterheadName('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.uploadFailed'));
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: (id: number) => letterheadAPI.setActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letterheads'] });
      toast.success(t('letterhead.activateSuccess'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.updateFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => letterheadAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letterheads'] });
      toast.success(t('letterhead.deleteSuccess'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.deleteFailed'));
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview URL for image
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !letterheadName.trim()) {
      toast.error(t('letterhead.fillAllFields'));
      return;
    }
    uploadMutation.mutate({ file: selectedFile, name: letterheadName });
  };

  const handleDownload = async (letterhead: Letterhead) => {
    try {
      const response = await letterheadAPI.download(letterhead.id);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', letterhead.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t('errors.downloadFailed'));
    }
  };

  const handlePreview = (letterhead: Letterhead) => {
    const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';
    const url = `${baseUrl}/${letterhead.file_path}`;
    window.open(url, '_blank');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('letterhead.title')}
          </h1>
          <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
            {t('letterhead.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors"
        >
          <Upload className="w-5 h-5 mr-2" />
          {t('letterhead.uploadNew')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent"></div>
        </div>
      ) : letterheads && letterheads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {letterheads.map((letterhead) => (
            <motion.div
              key={letterhead.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6 relative ${
                letterhead.is_active ? 'ring-2 ring-apple-accent' : ''
              }`}
            >
              {letterhead.is_active && (
                <div className="absolute top-2 right-2 bg-apple-accent text-white text-xs px-2 py-1 rounded-full">
                  {t('letterhead.active')}
                </div>
              )}
              
              <div className="flex items-center mb-4">
                <FileImage className="w-10 h-10 text-apple-text-secondary dark:text-apple-dark-text-secondary mr-3" />
                <div className="flex-1">
                  <h3 className="font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                    {letterhead.name}
                  </h3>
                  <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    {formatFileSize(letterhead.file_size)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary mb-4">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  {letterhead.uploaded_by_name}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {format(new Date(letterhead.uploaded_at), 'MMM d, yyyy')}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePreview(letterhead)}
                    className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                    title={t('common.preview')}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(letterhead)}
                    className="p-2 text-apple-accent hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                    title={t('common.download')}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(letterhead.id)}
                    disabled={letterhead.is_active}
                    className="p-2 text-apple-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-apple transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={letterhead.is_active ? t('letterhead.cannotDeleteActive') : t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {!letterhead.is_active && (
                  <button
                    onClick={() => setActiveMutation.mutate(letterhead.id)}
                    className="px-3 py-1 text-sm bg-apple-surface dark:bg-apple-dark-bg text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-gray-200 dark:hover:bg-gray-700 rounded-apple transition-colors"
                  >
                    {t('letterhead.setActive')}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-12 text-center">
          <FileImage className="w-16 h-16 text-apple-text-secondary dark:text-apple-dark-text-secondary mx-auto mb-4" />
          <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary">
            {t('letterhead.noLetterheads')}
          </p>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg p-6 w-full max-w-md"
            >
              <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                {t('letterhead.uploadNew')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('letterhead.name')}
                  </label>
                  <input
                    type="text"
                    value={letterheadName}
                    onChange={(e) => setLetterheadName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-gray-900 
                               text-apple-text-primary dark:text-apple-dark-text-primary"
                    placeholder={t('letterhead.namePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('letterhead.file')}
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-apple p-6 text-center">
                    {selectedFile ? (
                      <div>
                        {previewUrl && (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-h-32 mx-auto mb-4"
                          />
                        )}
                        <p className="text-sm text-apple-text-primary dark:text-apple-dark-text-primary">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <FileImage className="w-12 h-12 text-apple-text-secondary dark:text-apple-dark-text-secondary mx-auto mb-2" />
                        <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                          {t('letterhead.dragDropOrClick')}
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                      id="letterhead-upload"
                    />
                    <label
                      htmlFor="letterhead-upload"
                      className="mt-4 inline-block px-4 py-2 bg-apple-surface dark:bg-apple-dark-bg text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-gray-200 dark:hover:bg-gray-700 rounded-apple cursor-pointer transition-colors"
                    >
                      {t('letterhead.selectFile')}
                    </label>
                  </div>
                  <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
                    {t('letterhead.allowedFormats')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setLetterheadName('');
                    setPreviewUrl(null);
                  }}
                  className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !letterheadName.trim() || uploadMutation.isPending}
                  className="px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {uploadMutation.isPending ? t('common.uploading') : t('common.upload')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LetterheadManagement;