/**
 * Page Bons de Versement
 * ======================
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { bonVersionmentService } from '../services/api';

const COMPANY_INFO = {
  name: 'SARA DECOREX',
  address: 'VILLAGE IRYAHEN COMMUNE TALA HAMZA WILAYA DE BEJAIA',
  phone: '034 18 12 92',
  mobile: '0770 16 01 91',
  email: 'sara.decorex@gmail.com'
};

const TVA_OPTIONS = [
  { label: 'Sans TVA', value: 0 },
  { label: 'TVA 9%', value: 9 },
  { label: 'TVA 19%', value: 19 }
];

export default function BonVersionmentPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    numero: `BV-${Date.now()}`,
    date_versement: new Date().toISOString().slice(0, 10),
    emetteur_nom: '',
    emetteur_prenom: '',
    emetteur_adresse: '',
    emetteur_telephone: '',
    emetteur_email: '',
    montant_a_verser: '',
    reste_a_payer: '',
    articles: [{ designation: '', unite: 'pièce', quantite: 1, prix_unitaire: 0 }],
    tva: 0
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const calculateHT = () => {
    return formData.articles.reduce((sum, article) =>
      sum + (parseFloat(article.quantite) || 0) * (parseFloat(article.prix_unitaire) || 0),
      0
    );
  };

  const montantHT = calculateHT();
  const montantTVA = formData.tva > 0 ? (montantHT * formData.tva / 100) : 0;
  const montantTTC = montantHT + montantTVA;
  const montantVerse = parseFloat(formData.montant_a_verser) || 0;
  const resteAPayer = Math.max(0, montantTTC - montantVerse);

  const handleClientChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArticleChange = (index, field, value) => {
    const newArticles = [...formData.articles];
    newArticles[index] = { ...newArticles[index], [field]: value };
    setFormData((prev) => ({ ...prev, articles: newArticles }));
  };

  const addArticle = () => {
    setFormData((prev) => ({ ...prev, articles: [...prev.articles, { designation: '', unite: 'pièce', quantite: 1, prix_unitaire: 0 }] }));
  };

  const removeArticle = (index) => {
    if (formData.articles.length > 1) {
      setFormData((prev) => ({ ...prev, articles: prev.articles.filter((_, i) => i !== index) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!formData.emetteur_nom.trim() || !formData.emetteur_prenom.trim()) {
        throw new Error('Les informations de la personne qui verse sont requises');
      }

      if (formData.articles.length === 0 || formData.articles.some((article) => !article.designation.trim())) {
        throw new Error('Au moins un article avec une désignation est requis');
      }

      const response = await bonVersionmentService.create({
        ...formData,
        montant: montantHT,
        total_global: montantTTC,
        montant_tva: montantTVA,
        montant_a_verser: montantVerse,
        reste_a_payer: resteAPayer,
        montant_verse: montantVerse,
        beneficiaire: `${formData.emetteur_prenom} ${formData.emetteur_nom}`,
        beneficiaire_nom: formData.emetteur_nom.trim(),
        beneficiaire_prenom: formData.emetteur_prenom.trim(),
        beneficiaire_adresse: formData.emetteur_adresse.trim(),
        beneficiaire_telephone: formData.emetteur_telephone.trim(),
        beneficiaire_email: formData.emetteur_email.trim(),
        articles: formData.articles.map((article) => ({
          designation: article.designation,
          unite: article.unite,
          quantite: parseFloat(article.quantite) || 0,
          prix_unitaire: parseFloat(article.prix_unitaire) || 0
        })),
        tva: parseInt(formData.tva, 10) || 0
      });

      setSuccessMessage(response?.message || 'Bon de versement créé avec succès !');
      setFormData({
        numero: `BV-${Date.now()}`,
        date_versement: new Date().toISOString().slice(0, 10),
        emetteur_nom: '',
        emetteur_prenom: '',
        emetteur_adresse: '',
        emetteur_telephone: '',
        emetteur_email: '',
        montant_a_verser: '',
        reste_a_payer: '',
        articles: [{ designation: '', unite: 'pièce', quantite: 1, prix_unitaire: 0 }],
        tva: 0
      });
    } catch (error) {
      const serverMessage = error?.message || error?.data?.message || error?.error || 'Erreur lors de la création du bon de versement';
      setErrorMessage(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container-base">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bon de versement</h1>
          <button type="button" onClick={() => navigate('/bons-versement-list')} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition">
            Voir mes bons de versement
          </button>
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
              <button type="button" onClick={() => navigate('/bons-versement')} className="btn-primary">
                🔄 Créer un autre bon de versement
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="card border-2 border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{COMPANY_INFO.name}</h2>
                <p className="text-sm text-gray-600">{COMPANY_INFO.address}</p>
                <p className="text-sm text-gray-600">Tél: {COMPANY_INFO.phone} | Mobile: {COMPANY_INFO.mobile}</p>
                <p className="text-sm text-gray-600">{COMPANY_INFO.email}</p>
              </div>
              <div className="text-right space-y-3">
                <p className="text-lg font-bold text-blue-600">BON DE VERSEMENT N° {formData.numero}</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date de versement</label>
                  <input type="date" name="date_versement" value={formData.date_versement} onChange={handleClientChange} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-blue-500">Informations de la personne qui verse</h3>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4 text-sm text-blue-800">
              Sara Decorex est le bénéficiaire du bon de versement. Remplissez ici les informations de la personne ou de l’entreprise qui effectue le versement.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom <span className="text-red-500">*</span></label>
                <input type="text" name="emetteur_nom" value={formData.emetteur_nom} onChange={handleClientChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prénom <span className="text-red-500">*</span></label>
                <input type="text" name="emetteur_prenom" value={formData.emetteur_prenom} onChange={handleClientChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                <input type="text" name="emetteur_adresse" value={formData.emetteur_adresse} onChange={handleClientChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone <span className="text-red-500">*</span></label>
                <input type="tel" name="emetteur_telephone" value={formData.emetteur_telephone} onChange={handleClientChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" name="emetteur_email" value={formData.emetteur_email} onChange={handleClientChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-blue-500">Articles</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12">N°</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 flex-1">Désignation</th>
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
                          <input type="text" placeholder="Ex: Consultation architecte" value={article.designation} onChange={(e) => handleArticleChange(index, 'designation', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required />
                        </td>
                        <td className="px-4 py-3">
                          <select value={article.unite || 'pièce'} onChange={(e) => handleArticleChange(index, 'unite', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"><option value="pièce">Pièce</option><option value="m²">m²</option><option value="ml">ml</option><option value="kg">kg</option><option value="heure">Heure</option><option value="forfait">Forfait</option></select>
                          <input type="number" step="0.0001" min="0" value={article.quantite} onChange={(e) => handleArticleChange(index, 'quantite', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" step="0.01" min="0" value={article.prix_unitaire} onChange={(e) => handleArticleChange(index, 'prix_unitaire', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{total.toFixed(2).replace('.', ',')}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => removeArticle(index)} disabled={formData.articles.length === 1} className="text-red-500 hover:text-red-700 disabled:text-gray-300 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addArticle} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              <Plus size={20} /> Ajouter un article
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Taxe (TVA)</h3>
              <div className="space-y-2">
                {TVA_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-blue-50">
                    <input type="radio" name="tva" value={option.value} checked={formData.tva === option.value} onChange={(e) => setFormData((prev) => ({ ...prev, tva: parseInt(e.target.value, 10) }))} className="mr-3" />
                    <span className="font-medium text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Totaux</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Montant H.T</span>
                  <span className="font-semibold">{montantHT.toFixed(2).replace('.', ',')} DA</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>TVA</span>
                  <span className="font-semibold">{montantTVA.toFixed(2).replace('.', ',')} DA</span>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-gray-700">Montant à verser</label>
                  <input type="number" step="0.01" min="0" name="montant_a_verser" value={formData.montant_a_verser} onChange={handleClientChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-gray-700">Reste à payer</label>
                  <input type="number" step="0.01" min="0" name="reste_a_payer" value={resteAPayer.toFixed(2)} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
                </div>
                <div className="flex justify-between text-lg font-bold text-blue-600 border-t pt-3">
                  <span>Total TTC</span>
                  <span>{montantTTC.toFixed(2).replace('.', ',')} DA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
              <Plus size={20} />
              {loading ? 'Création en cours...' : 'Créer le bon de versement'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
