import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Mail,
  Shield,
  Key,
  Calendar,
  CheckCircle,
  AlertCircle,
  Lock,
  Save,
  AlertTriangle,
  Settings,
  Edit2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, usersAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AccountForm {
  username: string;
  email: string;
}

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    watch,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>();

  const {
    register: registerAccount,
    handleSubmit: handleSubmitAccount,
    reset: resetAccount,
    formState: { errors: accountErrors },
  } = useForm<AccountForm>({
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
    },
  });

  const newPassword = watch('newPassword');

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authAPI.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success(t('profile.passwordChanged'));
      setShowPasswordForm(false);
      resetPassword();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('profile.failedToChangePassword'));
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: AccountForm) => usersAPI.updateProfile(data),
    onSuccess: () => {
      toast.success(t('profile.accountUpdated'));
      setShowAccountForm(false);
      resetAccount();
      // Refresh user data in auth context
      refreshUser();
      // Invalidate any related queries
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('profile.failedToUpdateAccount'));
    },
  });

  const onSubmitPassword = (data: PasswordForm) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const onSubmitAccount = (data: AccountForm) => {
    updateProfileMutation.mutate(data);
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

  if (!user) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-display font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
          {t('profile.title')}
        </h1>
        <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
          {t('profile.subtitle')}
        </p>
      </motion.div>

      {/* User Information Card */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
      >
        <div className="flex items-start space-x-6">
          <div className="w-24 h-24 bg-apple-accent rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-12 h-12 text-white" />
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
              {user.fullName}
            </h2>
            
            <div className="space-y-2">
              <div className="flex items-center text-apple-text-secondary dark:text-apple-dark-text-secondary">
                <Mail className="w-4 h-4 mr-2" />
                <span>{user.email}</span>
              </div>
              
              <div className="flex items-center text-apple-text-secondary dark:text-apple-dark-text-secondary">
                <User className="w-4 h-4 mr-2" />
                <span>@{user.username}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <Shield className="w-4 h-4 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {t(`users.${user.role}`)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Permissions Card */}
      {user.role !== 'admin' && (
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
        >
          <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
            {t('profile.permissions')}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
              <div className={`mb-2 ${user.permissions.create ? 'text-apple-success' : 'text-apple-text-secondary dark:text-apple-dark-text-secondary'}`}>
                {user.permissions.create ? (
                  <CheckCircle className="w-8 h-8 mx-auto" />
                ) : (
                  <AlertCircle className="w-8 h-8 mx-auto" />
                )}
              </div>
              <p className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('common.create')}
              </p>
              <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
                {user.permissions.create ? t('profile.allowed') : t('profile.notAllowed')}
              </p>
            </div>
            
            <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
              <div className={`mb-2 ${user.permissions.edit ? 'text-apple-success' : 'text-apple-text-secondary dark:text-apple-dark-text-secondary'}`}>
                {user.permissions.edit ? (
                  <CheckCircle className="w-8 h-8 mx-auto" />
                ) : (
                  <AlertCircle className="w-8 h-8 mx-auto" />
                )}
              </div>
              <p className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('common.edit')}
              </p>
              <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
                {user.permissions.edit ? t('profile.allowed') : t('profile.notAllowed')}
              </p>
            </div>
            
            <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
              <div className={`mb-2 ${user.permissions.delete ? 'text-apple-success' : 'text-apple-text-secondary dark:text-apple-dark-text-secondary'}`}>
                {user.permissions.delete ? (
                  <CheckCircle className="w-8 h-8 mx-auto" />
                ) : (
                  <AlertCircle className="w-8 h-8 mx-auto" />
                )}
              </div>
              <p className="text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary">
                {t('common.delete')}
              </p>
              <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
                {user.permissions.delete ? t('profile.allowed') : t('profile.notAllowed')}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Account Settings - Only for admins */}
      {user.role === 'admin' && (
        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
        >
          <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
            {t('profile.accountSettings')}
          </h3>
          
          {!showAccountForm ? (
            <button
              onClick={() => setShowAccountForm(true)}
              className="flex items-center px-4 py-2 bg-apple-surface dark:bg-apple-dark-bg text-apple-text-primary dark:text-apple-dark-text-primary rounded-apple hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              {t('profile.editAccountInfo')}
            </button>
          ) : (
            <form onSubmit={handleSubmitAccount(onSubmitAccount)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                  {t('auth.username')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                  <input
                    {...registerAccount('username', { 
                      required: t('users.usernameRequired'),
                      minLength: {
                        value: 3,
                        message: t('users.usernameMinLength'),
                      },
                    })}
                    type="text"
                    className={`w-full pl-10 pr-4 py-2 border ${
                      accountErrors.username ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                    } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                      bg-white dark:bg-apple-dark-bg 
                      text-apple-text-primary dark:text-apple-dark-text-primary
                      placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                  />
                </div>
                {accountErrors.username && (
                  <p className="mt-1 text-sm text-apple-danger">{accountErrors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                  <input
                    {...registerAccount('email', {
                      required: t('users.emailRequired'),
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: t('users.invalidEmail'),
                      },
                    })}
                    type="email"
                    className={`w-full pl-10 pr-4 py-2 border ${
                      accountErrors.email ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                    } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                      bg-white dark:bg-apple-dark-bg 
                      text-apple-text-primary dark:text-apple-dark-text-primary
                      placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                  />
                </div>
                {accountErrors.email && (
                  <p className="mt-1 text-sm text-apple-danger">{accountErrors.email.message}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {t('profile.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      {t('common.save')}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountForm(false);
                    resetAccount({
                      username: user.username,
                      email: user.email,
                    });
                  }}
                  className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      )}

      {/* Security Settings */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
      >
        <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
          {t('profile.securitySettings')}
        </h3>
        
        {!showPasswordForm ? (
          <button
            onClick={() => setShowPasswordForm(true)}
            className="flex items-center px-4 py-2 bg-apple-surface dark:bg-apple-dark-bg text-apple-text-primary dark:text-apple-dark-text-primary rounded-apple hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <Key className="w-5 h-5 mr-2" />
            {t('profile.changePassword')}
          </button>
        ) : (
          <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                {t('profile.currentPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                <input
                  {...registerPassword('currentPassword', { required: t('profile.currentPasswordRequired') })}
                  type="password"
                  className={`w-full pl-10 pr-4 py-2 border ${
                    passwordErrors.currentPassword ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                  } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                    bg-white dark:bg-apple-dark-bg 
                    text-apple-text-primary dark:text-apple-dark-text-primary
                    placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                  placeholder={t('profile.currentPasswordPlaceholder')}
                />
              </div>
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-sm text-apple-danger">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                {t('profile.newPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                <input
                  {...registerPassword('newPassword', {
                    required: t('profile.newPasswordRequired'),
                    minLength: {
                      value: 6,
                      message: t('profile.passwordMinLength'),
                    },
                  })}
                  type="password"
                  className={`w-full pl-10 pr-4 py-2 border ${
                    passwordErrors.newPassword ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                  } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                    bg-white dark:bg-apple-dark-bg 
                    text-apple-text-primary dark:text-apple-dark-text-primary
                    placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                  placeholder={t('profile.newPasswordPlaceholder')}
                />
              </div>
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-apple-danger">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                {t('profile.confirmNewPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                <input
                  {...registerPassword('confirmPassword', {
                    required: t('profile.confirmPasswordRequired'),
                    validate: (value) => value === newPassword || t('profile.passwordsDoNotMatch'),
                  })}
                  type="password"
                  className={`w-full pl-10 pr-4 py-2 border ${
                    passwordErrors.confirmPassword ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'
                  } rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-accent
                    bg-white dark:bg-apple-dark-bg 
                    text-apple-text-primary dark:text-apple-dark-text-primary
                    placeholder-apple-text-secondary dark:placeholder-apple-dark-text-secondary`}
                  placeholder={t('profile.confirmPasswordPlaceholder')}
                />
              </div>
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-sm text-apple-danger">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="flex items-center px-4 py-2 bg-apple-accent text-white rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t('profile.saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {t('profile.savePassword')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  resetPassword();
                }}
                className="px-4 py-2 text-apple-text-primary dark:text-apple-dark-text-primary hover:bg-apple-surface dark:hover:bg-apple-dark-bg rounded-apple transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* Activity Summary */}
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple p-6"
      >
        <h3 className="text-lg font-semibold text-apple-text-primary dark:text-apple-dark-text-primary mb-4">
          {t('profile.quickStats')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
            <Calendar className="w-8 h-8 text-apple-accent mx-auto mb-2" />
            <p className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">-</p>
            <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
              {t('profile.casesCreated')}
            </p>
          </div>
          <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
            <AlertTriangle className="w-8 h-8 text-apple-warning mx-auto mb-2" />
            <p className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">-</p>
            <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
              {t('profile.conflictsChecked')}
            </p>
          </div>
          <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
            <CheckCircle className="w-8 h-8 text-apple-success mx-auto mb-2" />
            <p className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">-</p>
            <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
              {t('profile.casesResolved')}
            </p>
          </div>
          <div className="text-center p-4 bg-apple-surface dark:bg-apple-dark-bg rounded-apple">
            <User className="w-8 h-8 text-apple-text-secondary dark:text-apple-dark-text-secondary mx-auto mb-2" />
            <p className="text-2xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
              {t('users.active')}
            </p>
            <p className="text-xs text-apple-text-secondary dark:text-apple-dark-text-secondary mt-1">
              {t('profile.accountStatus')}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Profile;