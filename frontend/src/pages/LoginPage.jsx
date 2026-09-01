/**
 * Page de Connexion
 * ===================
 * 
 * Permet à l'utilisateur de se connecter
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';
import FormInput from '../components/FormInput';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import { COMPANY_BRAND } from '../config/company';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="mx-auto mb-4 h-24 w-56 overflow-hidden rounded-lg bg-white">
          <img src={COMPANY_BRAND.logoUrl} alt={COMPANY_BRAND.name} className="h-full w-full object-cover" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{COMPANY_BRAND.name}</h1>
        <p className="text-gray-600 text-center mb-8">Gestion commerciale</p>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormInput
            label="Email"
            id="email"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <FormInput
            label="Mot de passe"
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          {isLoading ? (
            <Loading />
          ) : (
            <button
              type="submit"
              className="w-full btn-primary"
            >
              Connexion
            </button>
          )}
        </form>

        <p className="text-center text-gray-600 mt-6">
          Pas de compte ?{' '}
          <a href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
            Inscription
          </a>
        </p>
      </div>
    </div>
  );
}
