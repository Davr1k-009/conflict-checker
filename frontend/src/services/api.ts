import axios from 'axios';
import i18n from '../i18n';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const { token } = response.data;
          localStorage.setItem('token', token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (userData: any) => api.post('/users', userData),
  update: (userId: number, userData: any) => api.put(`/users/${userId}`, userData),
  resetPassword: (userId: number, newPassword: string) =>
    api.post(`/users/${userId}/reset-password`, { newPassword }),
  delete: (userId: number) => api.delete(`/users/${userId}`),
  getActivity: (userId: number) => api.get(`/users/${userId}/activity`),
  updateProfile: (data: any) => api.put('/users/profile', data),
};

// Cases API
export const casesAPI = {
  getAll: (params?: any) => api.get('/cases', { params }),
  getById: (id: number) => api.get(`/cases/${id}`),
  create: (caseData: any) => api.post('/cases', caseData),
  update: (id: number, caseData: any) => api.put(`/cases/${id}`, caseData),
  delete: (id: number) => api.delete(`/cases/${id}`),
  getLawyers: (id: number) => api.get(`/cases/${id}/lawyers`),
  assignLawyer: (id: number, lawyerId: number) => 
    api.post(`/cases/${id}/lawyers`, { lawyerId }),
  removeLawyer: (id: number, lawyerId: number) => 
    api.delete(`/cases/${id}/lawyers/${lawyerId}`),
};

// Documents API with entity documents methods
export const documentsAPI = {
  upload: (caseId: number, file: File) => {
    const formData = new FormData();
    formData.append('document', file);
    return api.post(`/documents/upload/${caseId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Entity documents methods
  uploadEntityFile: (caseId: number, formData: FormData) => 
    api.post(`/entity-documents/upload/${caseId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  getEntityDocuments: (caseId: number) => 
    api.get(`/entity-documents/case/${caseId}`),
  
  downloadEntityFile: (documentId: number) => 
    api.get(`/entity-documents/download/${documentId}`, { responseType: 'blob' }),
  
  deleteEntityFile: (documentId: number) => 
    api.delete(`/entity-documents/${documentId}`),
  
  // Regular document methods
  download: (documentId: number) => 
    api.get(`/documents/download/${documentId}`, { responseType: 'blob' }),
  
  delete: (documentId: number) => 
    api.delete(`/documents/${documentId}`),
};

// Conflicts API
export const conflictsAPI = {
  check: (caseId: number) => api.post(`/conflicts/check/${caseId}`),
  search: (searchData: any) => api.post('/conflicts/search', searchData),
  getHistory: (caseId: number) => api.get(`/conflicts/history/${caseId}`),
  generateReport: (reportId: number) => {
    // Get current language from i18n
    const currentLanguage = i18n.language || 'en';
    return api.get(`/conflicts/report/${reportId}?lang=${currentLanguage}`, { responseType: 'blob' });
  },
};

// Letterhead API
export const letterheadAPI = {
  upload: (file: File, name: string) => {
    const formData = new FormData();
    formData.append('letterhead', file);
    formData.append('name', name);
    return api.post('/letterheads/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getActive: () => api.get('/letterheads/active'),
  getAll: () => api.get('/letterheads'),
  setActive: (id: number) => api.put(`/letterheads/${id}/activate`),
  delete: (id: number) => api.delete(`/letterheads/${id}`),
  download: (id: number) => 
    api.get(`/letterheads/download/${id}`, { responseType: 'blob' }),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Backups API
export const backupsAPI = {
  getStatus: () => api.get('/backups/status'),
  list: () => api.get('/backups'),
  create: () => api.post('/backups/create'),
  download: (filename: string) => api.get(`/backups/download/${filename}`, { responseType: 'blob' }),
  delete: (filename: string) => api.delete(`/backups/${filename}`),
  restore: (formData: FormData) => api.post('/backups/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export default api;