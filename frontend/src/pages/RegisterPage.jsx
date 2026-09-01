/**
 * Page d'Inscription
 * ====================
 * 
 * Permet à l'utilisateur de créer un compte
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';
import FormInput from '../components/FormInput';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import { COMPANY_BRAND } from '../config/company';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [errors, setErrors] = useState({});
  const { register, isLoading, error } = useAuthStore();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (formData.password !== formData.passwordConfirm) {
      setErrors({ passwordConfirm: 'Les mots de passe ne correspondent pas' });
      return;
    }

    const success = await register(formData);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <img src={COMPANY_BRAND.logoUrl} alt={COMPANY_BRAND.name} className="mx-auto mb-4 h-24 w-44 object-contain" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">{COMPANY_BRAND.name}</h1>
        <h2 className="text-xl font-semibold text-gray-900 text-center">Inscription</h2>
        <p className="text-gray-600 text-center mb-8">Créer un nouveau compte</p>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Nom"
            id="nom"
            name="nom"
            placeholder="Votre nom"
            value={formData.nom}
            onChange={handleChange}
            required
            disabled={isLoading}
          />

          <FormInput
            label="Prénom"
            id="prenom"
            name="prenom"
            placeholder="Votre prénom"
            value={formData.prenom}
            onChange={handleChange}
            required
            disabled={isLoading}
          />

          <FormInput
            label="Email"
            id="email"
            name="email"
            type="email"
            placeholder="votre@email.com"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading}
          />

          <FormInput
            label="Mot de passe"
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isLoading}
          />

          <FormInput
            label="Confirmer le mot de passe"
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            placeholder="••••••••"
            value={formData.passwordConfirm}
            onChange={handleChange}
            error={errors.passwordConfirm}
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
              Créer un compte
            </button>
          )}
        </form>

        <p className="text-center text-gray-600 mt-6">
          Déjà inscrit ?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Connexion
          </a>
        </p>
      </div>
    </div>
  );
}
