import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Shield, User, Lock, AlertCircle, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface LoginForm {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');

    try {
      await login(data.username, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-apple-surface to-white dark:from-apple-dark-surface dark:to-apple-dark-bg flex items-center justify-center p-4 transition-colors">
      {/* Language Selector - positioned in top right */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center space-x-2 bg-white/80 dark:bg-apple-dark-surface/80 backdrop-blur-md rounded-apple px-3 py-2">
          <Globe className="w-4 h-4 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
          <button
            onClick={() => changeLanguage('en')}
            className={`text-sm font-medium transition-colors ${
              i18n.language === 'en' 
                ? 'text-apple-accent' 
                : 'text-apple-text-secondary dark:text-apple-dark-text-secondary hover:text-apple-text-primary dark:hover:text-apple-dark-text-primary'
            }`}
          >
            EN
          </button>
          <span className="text-apple-text-secondary dark:text-apple-dark-text-secondary">|</span>
          <button
            onClick={() => changeLanguage('ru')}
            className={`text-sm font-medium transition-colors ${
              i18n.language === 'ru' 
                ? 'text-apple-accent' 
                : 'text-apple-text-secondary dark:text-apple-dark-text-secondary hover:text-apple-text-primary dark:hover:text-apple-dark-text-primary'
            }`}
          >
            RU
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-apple-accent rounded-apple-lg mb-4"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-apple-text-primary dark:text-apple-dark-text-primary">
            {t('auth.loginTitle')}
          </h1>
          <p className="text-body text-apple-text-secondary dark:text-apple-dark-text-secondary mt-2">
            {t('auth.loginSubtitle')}
          </p>
        </div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white dark:bg-apple-dark-surface rounded-apple-lg shadow-apple-lg p-8"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-apple text-apple-danger"
              >
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                {t('auth.username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                </div>
                <input
                  {...register('username', { required: t('auth.usernameRequired') })}
                  type="text"
                  className={`
                    block w-full pl-10 pr-3 py-3 
                    border ${errors.username ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'}
                    rounded-apple text-apple-text-primary dark:text-apple-dark-text-primary
                    bg-white dark:bg-apple-dark-bg
                    focus:outline-none focus:ring-2 focus:ring-apple-accent focus:border-transparent
                    transition-all duration-200
                  `}
                  placeholder={t('auth.username')}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-apple-danger">{errors.username.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-apple-text-primary dark:text-apple-dark-text-primary mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-apple-text-secondary dark:text-apple-dark-text-secondary" />
                </div>
                <input
                  {...register('password', { required: t('auth.passwordRequired') })}
                  type="password"
                  className={`
                    block w-full pl-10 pr-3 py-3 
                    border ${errors.password ? 'border-apple-danger' : 'border-gray-300 dark:border-gray-600'}
                    rounded-apple text-apple-text-primary dark:text-apple-dark-text-primary
                    bg-white dark:bg-apple-dark-bg
                    focus:outline-none focus:ring-2 focus:ring-apple-accent focus:border-transparent
                    transition-all duration-200
                  `}
                  placeholder={t('auth.password')}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-apple-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className={`
                w-full py-3 px-4 
                bg-apple-accent text-white 
                rounded-apple font-medium
                hover:bg-blue-600 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-apple-accent
                transition-all duration-200
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t('auth.loggingIn')}
                </span>
              ) : (
                t('auth.loginButton')
              )}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;