/**
 * Store d'authentification (Zustand)
 * ===================================
 * 
 * Gère l'état global d'authentification
 * - Login/Logout
 * - Utilisateur courant
 * - Token JWT
 */

import { create } from 'zustand';
import { authService } from '../services/api';

export const useAuthStore = create((set) => ({
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,

  // Connexion
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(email, password);
      const { token, user } = response;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, token, isLoading: false });
      return true;
    } catch (error) {
      const errorMsg = error?.message || error?.data?.message || error?.response?.data?.message || (typeof error === 'string' ? error : 'Erreur de connexion');
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  // Inscription
  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(data);
      const { token, user } = response;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, token, isLoading: false });
      return true;
    } catch (error) {
      const errorMsg = error?.message || error?.data?.message || error?.response?.data?.message || (typeof error === 'string' ? error : 'Erreur lors de l\'inscription');
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  // Déconnexion
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  // Récupère l'utilisateur courant
  fetchCurrentUser: async () => {
    try {
      const response = await authService.getCurrentUser();
      set({ user: response.user });
      return response.user;
    } catch (error) {
      console.error('Erreur récupération utilisateur:', error);
      return null;
    }
  },

  // Vérifie si l'utilisateur est authentifié
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
}));
