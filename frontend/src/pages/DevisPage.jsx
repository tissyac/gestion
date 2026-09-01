/**
 * Page Dévis
 * ==========
 * Gestion complète des devis avec:
 * - Informations client
 * - Articles avec calculs automatiques
 * - TVA optionnelle
 * - Totaux calculés automatiquement
 */

import React, { useState } from 'react';
import { Plus, Trash2, Copy, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { devisService } from '../services/api';

// Informations fixes de l'entreprise
const COMPANY_INFO = {
  name: 'SARA DECOREX',
  address: 'VILLAGE IRYAHEN COMMUNE TALA HAMZA WILAYA DE BEJAIA',
  phone: '034 18 12 92',
  mobile: '0770 16 01 91',
  email: 'sara.decorex@gmail.com'
};

const PAYMENT_TERMS = {
  advance: 50,
  onDelivery: 45,
  afterInstallation: 5
};

const DELIVERY_TERMS = {
  minDays: 15,
  maxDays: 60
};

const QUOTE_VALIDITY = {
  days: 30
};

const TVA_OPTIONS = [
  { label: 'Sans TVA', value: 0 },
  { label: 'TVA 9%', value: 9 },
  { label: 'TVA 19%', value: 19 }
];

export default function DevisPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    numero: `DEV-${Date.now()}`,
    date_devis: new Date().toISOString().slice(0, 10),
    client_nom: '',
    client_prenom: '',
    client_adresse: '',
    client_telephone: '',
    client_email: '',
    articles: [{ designation: '', unite: 'pièce', quantite: 1, prix_unitaire: 0 }],
    tva: 0
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successDevisId, setSuccessDevisId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Calcule le total HT
  const calculateHT = () => {
    return formData.articles.reduce((sum, article) => 
      sum + (parseFloat(article.quantite) || 0) * (parseFloat(article.prix_unitaire) || 0), 
      0
    );
  };

  const montantHT = calculateHT();
  const montantTVA = formData.tva > 0 ? (montantHT * formData.tva / 100) : 0;
  const montantTTC = montantHT + montantTVA;

  // Gère les changements dans le formulaire client
  const handleClientChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Gère les changements d'articles
  const handleArticleChange = (index, field, value) => {
    const newArticles = [...formData.articles];
    newArticles[index] = { ...newArticles[index], [field]: value };
    setFormData(prev => ({
      ...prev,
      articles: newArticles
    }));
  };

  // Ajoute une nouvelle ligne d'article
  const addArticle = () => {
    setFormData(prev => ({
      ...prev,
      articles: [...prev.articles, { designation: '', unite: 'pièce', quantite: 1, prix_unitaire: 0 }]
    }));
  };

  // Supprime une ligne d'article
  const removeArticle = (index) => {
    if (formData.articles.length > 1) {
      setFormData(prev => ({
        ...prev,
        articles: prev.articles.filter((_, i) => i !== index)
      }));
    }
  };

  // Soumet le formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setSuccessDevisId(null);

    try {
      // Validations
      if (!formData.client_nom.trim() || !formData.client_prenom.trim()) {
        throw new Error('Les informations client sont requises');
      }

      if (formData.articles.length === 0 || formData.articles.some(a => !a.designation.trim())) {
        throw new Error('Au moins un article avec une désignation est requis');
      }

      // Prépare les données pour l'API
      const devisData = {
        ...formData,
        articles: formData.articles.map(a => ({
          designation: a.designation,
          unite: a.unite,
          quantite: parseFloat(a.quantite) || 0,
          prix_unitaire: parseFloat(a.prix_unitaire) || 0
        }))
      };

      // Crée le devis
      const response = await devisService.create(devisData);

      setSuccessMessage('Devis créé avec succès !');
      setSuccessDevisId(response.data?.id);
    } catch (error) {
      const serverMessage = error?.message || error?.data?.message || error?.error || (typeof error === 'string' ? error : null);
      console.error('Erreur création devis:', error);
      setErrorMessage(serverMessage || 'Erreur lors de la création du devis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container-base">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Devis</h1>
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 font-semibold mb-4">{successMessage}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/devis-list')}
                className="btn-primary"
              >
                📋 Voir tous mes devis
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage('');
                  setSuccessDevisId(null);
                  setFormData({
                    numero: `DEV-${Date.now()}`,
                    date_devis: new Date().toISOString().slice(0, 10),
                    client_nom: '',
                    client_prenom: '',
                    client_adresse: '',
                    client_telephone: '',
                    client_email: '',
                    articles: [{ designation: '', unite: 'pièce', quantite: 1, prix_unitaire: 0 }],
                    tva: 0
                  });
                }}
                className="btn-secondary"
              >
                ✏️ Créer un autre devis
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Entête avec informations de l'entreprise */}
          <div className="card border-2 border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{COMPANY_INFO.name}</h2>
                <p className="text-sm text-gray-600">{COMPANY_INFO.address}</p>
                <p className="text-sm text-gray-600">Tél: {COMPANY_INFO.phone} | Mobile: {COMPANY_INFO.mobile}</p>
                <p className="text-sm text-gray-600">{COMPANY_INFO.email}</p>
              </div>
              <div className="text-right space-y-3">
                <p className="text-lg font-bold text-blue-600">DEVIS N° {formData.numero}</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date du devis
                  </label>
                  <input
                    type="date"
                    name="date_devis"
                    value={formData.date_devis}
                    onChange={handleClientChange}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section Client */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-blue-500">
              Informations Client
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="client_nom"
                  value={formData.client_nom}
                  onChange={handleClientChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="client_prenom"
                  value={formData.client_prenom}
                  onChange={handleClientChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse
                </label>
                <input
                  type="text"
                  name="client_adresse"
                  value={formData.client_adresse}
                  onChange={handleClientChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="client_telephone"
                  value={formData.client_telephone}
                  onChange={handleClientChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="client_email"
                  value={formData.client_email}
                  onChange={handleClientChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section Articles */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-blue-500">
              Articles
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12">N°</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Désignation</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">Unité</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">Quantité</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-32">Prix Unitaire (DA)</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-32">Total (DA)</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-12">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.articles.map((article, index) => {
                    const total = (parseFloat(article.quantite) || 0) * (parseFloat(article.prix_unitaire) || 0);
                    return (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium">{index + 1}</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Ex: Consultation architecte"
                            value={article.designation}
                            onChange={(e) => handleArticleChange(index, 'designation', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            required
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select aria-label="Unité" value={article.unite || 'pièce'} onChange={(e) => handleArticleChange(index, 'unite', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                            <option value="pièce">Pièce</option>
                            <option value="m²">m²</option>
                            <option value="ml">ml</option>
                            <option value="kg">kg</option>
                            <option value="heure">Heure</option>
                            <option value="forfait">Forfait</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            aria-label="Quantité"
                            value={article.quantite}
                            onChange={(e) => handleArticleChange(index, 'quantite', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={article.prix_unitaire}
                            onChange={(e) => handleArticleChange(index, 'prix_unitaire', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {total.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeArticle(index)}
                            disabled={formData.articles.length === 1}
                            className="text-red-500 hover:text-red-700 disabled:text-gray-300 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addArticle}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={20} /> Ajouter un article
            </button>
          </div>

          {/* Section Totaux */}
          <div className="grid grid-cols-2 gap-8">
            {/* TVA Selector */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Taxe (TVA)</h3>
              <div className="space-y-2">
                {TVA_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-blue-50" >
                    <input
                      type="radio"
                      name="tva"
                      value={option.value}
                      checked={formData.tva === option.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, tva: parseInt(e.target.value) }))}
                      className="mr-3"
                    />
                    <span className="font-medium text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="card border-2 border-blue-500 bg-blue-50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Totaux</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-medium text-gray-700">Montant H.T :</span>
                  <span className="font-bold text-gray-900">{montantHT.toFixed(2).replace('.', ',')} DA</span>
                </div>

                {formData.tva > 0 && (
                  <div className="flex justify-between items-center text-lg border-t border-blue-200 pt-3">
                    <span className="font-medium text-gray-700">Montant TVA ({formData.tva}%) :</span>
                    <span className="font-bold text-gray-900">{montantTVA.toFixed(2).replace('.', ',')} DA</span>
                  </div>
                )}

                {formData.tva > 0 && (
                  <div className="flex justify-between items-center text-xl bg-white border-2 border-blue-500 rounded-lg p-3 mt-4">
                    <span className="font-bold text-blue-600">Montant T.T.C :</span>
                    <span className="font-bold text-blue-600 text-2xl">{montantTTC.toFixed(2).replace('.', ',')} DA</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Conditions Fixes */}
          <div className="card bg-gray-50 border border-gray-300">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Conditions du Devis</h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Délai de livraison :</span> {DELIVERY_TERMS.minDays} à {DELIVERY_TERMS.maxDays} jours après le versement
              </p>
              <p>
                <span className="font-semibold">Modalité de paiement :</span>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>{PAYMENT_TERMS.advance}% à la commande</li>
                <li>{PAYMENT_TERMS.onDelivery}% le jour de livraison</li>
                <li>{PAYMENT_TERMS.afterInstallation}% après l'installation et le contrôle</li>
              </ul>
              <p>
                <span className="font-semibold">Durée du devis :</span> Valable {QUOTE_VALIDITY.days} jours après l'obtention du devis
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
            >
              <FileText size={20} />
              {loading ? 'Création en cours...' : 'Créer le Devis'}
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Copy size={20} />
              Générer PDF
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
