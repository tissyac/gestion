/**
 * Service API - Client HTTP
 * ===========================
 * 
 * Gère les requêtes vers le backend
 * - Authentification
 * - Interceptors
 * - Gestion des erreurs
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000;

// Crée l'instance axios
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
});

// Interceptor pour ajouter le token JWT
apiClient.interceptors.request.use(
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

// Interceptor pour les erreurs
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré - déconnexion
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// ===== AUTHENTIFICATION =====

export const authService = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  getCurrentUser: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

// ===== DEVIS =====

export const devisService = {
  list: (page = 1, limit = 20) => apiClient.get(`/devis?page=${page}&limit=${limit}`),
  get: (id) => apiClient.get(`/devis/${id}`),
  create: (data) => apiClient.post('/devis', data),
  update: (id, data) => apiClient.put(`/devis/${id}`, data),
  delete: (id) => apiClient.delete(`/devis/${id}`),
  generatePDF: (id) => apiClient.get(`/devis/${id}/pdf`),
};

// ===== FACTURES =====

export const factureService = {
  list: (page = 1, limit = 20) => apiClient.get(`/factures?page=${page}&limit=${limit}`),
  get: (id) => apiClient.get(`/factures/${id}`),
  create: (data) => apiClient.post('/factures', data),
  update: (id, data) => apiClient.put(`/factures/${id}`, data),
  delete: (id) => apiClient.delete(`/factures/${id}`),
  generatePDF: (id) => apiClient.get(`/factures/${id}/pdf`),
};

// ===== BONS DE COMMANDE =====

export const bonCommandeService = {
  list: (page = 1, limit = 20) => apiClient.get(`/bons-commande?page=${page}&limit=${limit}`),
  get: (id) => apiClient.get(`/bons-commande/${id}`),
  create: (data) => apiClient.post('/bons-commande', data),
  update: (id, data) => apiClient.put(`/bons-commande/${id}`, data),
  delete: (id) => apiClient.delete(`/bons-commande/${id}`),
  generatePDF: (id) => apiClient.get(`/bons-commande/${id}/pdf`),
};

// ===== BONS DE VERSEMENT =====

export const bonVersionmentService = {
  list: (page = 1, limit = 20) => apiClient.get(`/bons-versement?page=${page}&limit=${limit}`),
  get: (id) => apiClient.get(`/bons-versement/${id}`),
  create: (data) => apiClient.post('/bons-versement', data),
  update: (id, data) => apiClient.put(`/bons-versement/${id}`, data),
  delete: (id) => apiClient.delete(`/bons-versement/${id}`),
  generatePDF: (id) => apiClient.get(`/bons-versement/${id}/pdf`, { responseType: 'blob' }),
};

export const adminService = {
  overview: () => apiClient.get('/admin/overview')
};

export default apiClient;
