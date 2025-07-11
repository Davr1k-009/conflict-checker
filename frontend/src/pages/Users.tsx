import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  User,
  Mail,
  Shield,
  Calendar,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  AlertTriangle,
  Users as UsersIcon
} from 'lucide-react';
import { usersAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: number;
  full_name: string;
  position: string;
  role: 'admin' | 'user' | 'viewer';
  email: string;
  username: string;
  is_active: boolean;
  permissions: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageUsers: boolean;
  };
  created_at: string;
  created_by_name: string;
}

interface UserFormData {
  fullName: string;
  position: string;
  role: 'admin' | 'user' | 'viewer';
  email: string;
  username: string;
  password: string;
  permissions: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageUsers: boolean;
  };
}

// Helper function to format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll();
      return response.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    defaultValues: {
      role: 'user',
      permissions: {
        create: false,
        edit: false,
        delete: false,
        manageUsers: false,
      },
    },
  });

  const watchRole = watch('role');

  const createUserMutation = useMutation({
    mutationFn: usersAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.userCreated'));
      setShowCreateModal(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.createUserFailed'));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.userUpdated'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.updateUserFailed'));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usersAPI.resetPassword(id, password),
    onSuccess: () => {
      toast.success(t('users.passwordReset'));
      setShowResetPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.resetPasswordFailed'));
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => usersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.userDeleted'));
      setShowDeleteConfirmModal(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('errors.deleteUserFailed'));
    },
  });

  const onCreateUser = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const toggleUserStatus = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.is_active },
    });
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'user':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400';
    }
  };

  // Count active admins
  const activeAdminCount = users?.filter(u => u.role === 'admin' && u.is_active).length || 0;

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDeleteConfirmModal) {
          setShowDeleteConfirmModal(false);
          setSelectedUser(null);
        } else if (showResetPasswordModal) {
          setShowResetPasswordModal(false);
          setSelectedUser(null);
          setNewPassword('');
        } else if (showCreateModal) {
          setShowCreateModal(false);
          reset();
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showCreateModal, showResetPasswordModal, showDeleteConfirmModal, reset]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('users.title')}
          </h1>
          <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
            {t('users.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('users.addUser')}
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-accent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-apple-surface dark:bg-apple-dark-bg">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('users.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('users.roleAndPermissions')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('users.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('users.created')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-apple-text-secondary dark:text-apple-dark-text-secondary uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {users?.map((user) => {
                  const isCurrentUser = user.id === currentUser?.id;
                  const isLastAdmin = user.role === 'admin' && activeAdminCount <= 1;
                  const canDelete = !isCurrentUser && !(isLastAdmin && user.is_active);

                  return (
                    <tr key={user.id} className="hover:bg-apple-surface dark:hover:bg-apple-dark-bg transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-apple-accent rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                              {user.full_name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary">
                                  ({t('users.you')})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                              @{user.username} • {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                              user.role
                            )}`}
                          >
                            <Shield className="w-3 h-3 mr-1" />
                            {t(`users.${user.role}`)}
                          </span>
                          {user.role !== 'admin' && (
                            <div className="flex items-center flex-wrap gap-2 text-xs">
                              {user.permissions.create && (
                                <span className="text-green-600 dark:text-green-400">{t('common.create')}</span>
                              )}
                              {user.permissions.edit && (
                                <span className="text-blue-600 dark:text-blue-400">{t('common.edit')}</span>
                              )}
                              {user.permissions.delete && (
                                <span className="text-red-600 dark:text-red-400">{t('common.delete')}</span>
                              )}
                              {user.permissions.manageUsers && (
                                <span className="text-purple-600 dark:text-purple-400 flex items-center">
                                  <UsersIcon className="w-3 h-3 mr-0.5" />
                                  {t('users.manageUsers')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleUserStatus(user)}
                          disabled={isCurrentUser}
                          className={`flex items-center ${
                            user.is_active ? 'text-apple-success' : 'text-apple-danger'
                          } ${isCurrentUser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {user.is_active ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {t('users.active')}
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              {t('users.inactive')}
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary">
                        <div>
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {formatDate(user.created_at)}
                        </div>
                        <div className="text-xs mt-1">{t('users.by')} {user.created_by_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowResetPasswordModal(true);
                          }}
                          className="text-apple-accent hover:text-blue-600"
                          title={t('users.resetPassword')}
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={!canDelete}
                          className={`${
                            canDelete 
                              ? 'text-apple-danger hover:text-red-700' 
                              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          }`}
                          title={
                            isCurrentUser 
                              ? t('users.cannotDeleteSelf') 
                              : isLastAdmin 
                              ? t('users.cannotDeleteLastAdmin') 
                              : t('users.deleteUser')
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-apple-dark-surface rounded-apple-lg w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-base font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
                  {t('users.createNewUser')}
                </h2>
              </div>

              <div className="px-5 py-3">
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-0.5">
                      {t('users.fullName')}
                    </label>
                    <input
                      {...register('fullName', { required: t('users.fullNameRequired') })}
                      className="w-full px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                    />
                    {errors.fullName && (
                      <p className="mt-0.5 text-xs text-apple-danger">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-0.5">
                        {t('users.position')}
                      </label>
                      <input
                        {...register('position')}
                        className="w-full px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-apple 
                                   focus:outline-none focus:ring-2 focus:ring-apple-accent
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-0.5">
                        {t('users.role')}
                      </label>
                      <select
                        {...register('role')}
                        className="w-full px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-apple 
                                   focus:outline-none focus:ring-2 focus:ring-apple-accent
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary"
                      >
                        <option value="user">{t('users.user')}</option>
                        <option value="viewer">{t('users.viewer')}</option>
                        <option value="admin">{t('users.admin')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-0.5">
                      {t('auth.email')}
                    </label>
                    <input
                      {...register('email', {
                        required: t('users.emailRequired'),
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: t('users.invalidEmail'),
                        },
                      })}
                      type="email"
                      className="w-full px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-apple 
                                 focus:outline-none focus:ring-2 focus:ring-apple-accent
                                 bg-white dark:bg-apple-dark-bg 
                                 text-apple-text-primary dark:text-apple-dark-text-primary"
                    />
                    {errors.email && (
                      <p className="mt-0.5 text-xs text-apple-danger">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-0.5">
                        {t('auth.username')}
                      </label>
                      <input
                        {...register('username', {
                          required: t('users.usernameRequired'),
                          minLength: {
                            value: 3,
                            message: t('users.usernameMinLength'),
                          },
                        })}
                        className="w-full px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-apple 
                                   focus:outline-none focus:ring-2 focus:ring-apple-accent
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                      {errors.username && (
                        <p className="mt-0.5 text-xs text-apple-danger">{errors.username.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-0.5">
                        {t('auth.password')}
                      </label>
                      <input
                        {...register('password', {
                          required: t('users.passwordRequired'),
                          minLength: {
                            value: 6,
                            message: t('users.passwordMinLength'),
                          },
                        })}
                        type="password"
                        className="w-full px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-apple 
                                   focus:outline-none focus:ring-2 focus:ring-apple-accent
                                   bg-white dark:bg-apple-dark-bg 
                                   text-apple-text-primary dark:text-apple-dark-text-primary"
                      />
                      {errors.password && (
                        <p className="mt-0.5 text-xs text-apple-danger">{errors.password.message}</p>
                      )}
                    </div>
                  </div>

                  {watchRole !== 'admin' && (
                    <div>
                      <label className="block text-xs font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-1">
                        {t('users.permissions')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center">
                          <input
                            {...register('permissions.create')}
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600 text-apple-accent focus:ring-apple-accent h-3 w-3"
                          />
                          <span className="ml-1.5 text-xs text-apple-text-primary dark:text-apple-dark-text-primary">
                            {t('common.create')}
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...register('permissions.edit')}
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600 text-apple-accent focus:ring-apple-accent h-3 w-3"
                          />
                          <span className="ml-1.5 text-xs text-apple-text-primary dark:text-apple-dark-text-primary">
                            {t('common.edit')}
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...register('permissions.delete')}
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600 text-apple-accent focus:ring-apple-accent h-3 w-3"
                          />
                          <span className="ml-1.5 text-xs text-apple-text-primary dark:text-apple-dark-text-primary">
                            {t('common.delete')}
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...register('permissions.manageUsers')}
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600 text-apple-accent focus:ring-apple-accent h-3 w-3"
                          />
                          <span className="ml-1.5 text-xs text-apple-text-primary dark:text-apple-dark-text-primary flex items-center">
                            <UsersIcon className="w-3 h-3 mr-0.5" />
                            {t('users.manageUsers')}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-apple-dark-bg/50">
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      reset();
                    }}
                    className="px-3 py-1.5 text-xs text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSubmit(onCreateUser)}
                    disabled={createUserMutation.isPending}
                    className="px-3 py-1.5 text-xs bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {createUserMutation.isPending ? t('common.creating') : t('users.createUser')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {showResetPasswordModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowResetPasswordModal(false);
              setSelectedUser(null);
              setNewPassword('');
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-6 w-full max-w-md"
            >
              <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
                {t('users.resetPassword')}
              </h2>
              <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary mb-4">
                {t('users.resetPasswordFor', { name: selectedUser.full_name })}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                    {t('users.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple 
                               focus:outline-none focus:ring-2 focus:ring-apple-accent
                               bg-white dark:bg-apple-dark-bg 
                               text-apple-text-primary dark:text-apple-dark-text-primary
                               placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary"
                    placeholder={t('users.newPasswordPlaceholder')}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setSelectedUser(null);
                      setNewPassword('');
                    }}
                    className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      if (newPassword.length >= 6) {
                        resetPasswordMutation.mutate({
                          id: selectedUser.id,
                          password: newPassword,
                        });
                      } else {
                        toast.error(t('users.passwordMinLength'));
                      }
                    }}
                    disabled={resetPasswordMutation.isPending || newPassword.length < 6}
                    className="px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {resetPasswordMutation.isPending ? t('users.resetting') : t('users.resetPassword')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirmModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowDeleteConfirmModal(false);
              setSelectedUser(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-apple-dark-surface rounded-apple-lg p-6 w-full max-w-md"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-4">
                  <AlertTriangle className="w-6 h-6 text-apple-danger" />
                </div>
                <h2 className="text-title font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
                  {t('users.confirmDelete')}
                </h2>
              </div>

              <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary mb-6">
                {t('users.deleteWarning', { name: selectedUser.full_name })}
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmDeleteUser}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 bg-apple-danger text-white rounded-apple hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteUserMutation.isPending ? t('users.deleting') : t('users.deleteUser')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;