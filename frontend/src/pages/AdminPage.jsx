import { useEffect, useState } from 'react';
import { adminService } from '../services/api';
import Layout from '../components/Layout';

const sections = [
  ['users', 'Utilisateurs', ['email', 'nom', 'prenom', 'role', 'created_at']],
  ['devis', 'Devis', ['numero', 'client_nom', 'client_prenom', 'montant_ht', 'date_devis', 'user_email']],
  ['factures', 'Factures', ['numero', 'client', 'montant', 'date_facture', 'user_email']],
  ['bonsCommande', 'Bons de commande', ['numero', 'fournisseur', 'montant', 'date_commande', 'user_email']],
  ['bonsVersement', 'Bons de versement', ['numero', 'montant', 'date_versement', 'user_email']]
];

const labels = {
  email: 'Email', nom: 'Nom', prenom: 'Prénom', role: 'Rôle', created_at: 'Créé le',
  numero: 'Numéro', client_nom: 'Nom client', client_prenom: 'Prénom client', montant_ht: 'Montant HT',
  client: 'Client', montant: 'Montant', fournisseur: 'Fournisseur', date_devis: 'Date',
  date_facture: 'Date', date_commande: 'Date', date_versement: 'Date', user_email: 'Compte'
};

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (key.includes('date') || key === 'created_at') return new Date(value).toLocaleDateString('fr-FR');
  if (key.includes('montant')) return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA`;
  return String(value);
};

export default function AdminPage() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.overview()
      .then((response) => setOverview(response.data))
      .catch((requestError) => setError(requestError?.message || 'Accès administrateur refusé'));
  }, []);

  return (
    <Layout>
      <div className="container-base space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
          <p className="mt-1 text-gray-600">Utilisateurs et documents de la plateforme</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {!overview && !error && <p className="text-gray-600">Chargement...</p>}
        {overview && sections.map(([key, title, columns]) => (
          <section key={key} className="card overflow-x-auto">
            <h2 className="mb-4 text-xl font-bold text-gray-900">{title} ({overview[key]?.length || 0})</h2>
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b bg-gray-50"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-left font-semibold text-gray-700">{labels[column]}</th>)}</tr></thead>
              <tbody>{(overview[key] || []).map((item, index) => <tr key={item.id || index} className="border-b hover:bg-gray-50">{columns.map((column) => <td key={column} className="px-4 py-3 text-gray-700">{formatValue(column, item[column])}</td>)}</tr>)}</tbody>
            </table>
          </section>
        ))}
      </div>
    </Layout>
  );
}