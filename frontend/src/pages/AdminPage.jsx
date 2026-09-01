import { useEffect, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { adminService } from '../services/api';
import Layout from '../components/Layout';

const documentTypes = [
  { key: 'devis', label: 'Devis', date: 'date_devis', endpoint: 'devis', file: 'Devis' },
  { key: 'factures', label: 'Facture', date: 'date_facture', endpoint: 'factures', file: 'Facture' },
  { key: 'bonsCommande', label: 'Bon de commande', date: 'date_commande', endpoint: 'bons-commande', file: 'BonCommande' },
  { key: 'bonsVersement', label: 'Bon de versement', date: 'date_versement', endpoint: 'bons-versement', file: 'BonVersement' }
];

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (key.includes('date') || key === 'created_at') return new Date(value).toLocaleDateString('fr-FR');
  if (key.includes('montant')) return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA`;
  return String(value);
};

export default function AdminPage() {
  const [overview, setOverview] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.overview()
      .then((response) => setOverview(response.data))
      .catch((requestError) => setError(requestError?.message || 'Accès administrateur refusé'));
  }, []);

  const selectedUser = overview?.users.find((user) => user.id === selectedUserId);

  const openPdf = async (documentType, documentId, download, fileName) => {
    const previewWindow = download ? null : window.open('', '_blank');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/${documentType.endpoint}/${documentId}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('PDF indisponible');
      const url = window.URL.createObjectURL(await response.blob());
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${documentType.file}_${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (previewWindow) {
        previewWindow.location.href = url;
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      previewWindow?.close();
      console.error('Erreur PDF:', requestError);
      alert('Impossible de charger le PDF');
    }
  };

  const userDocuments = selectedUserId && overview
    ? documentTypes.flatMap((documentType) => (overview[documentType.key] || [])
      .filter((document) => document.user_id === selectedUserId)
      .map((document) => ({ ...document, documentType })))
      .sort((a, b) => new Date(b[a.documentType.date] || b.created_at) - new Date(a[a.documentType.date] || a.created_at))
    : [];

  return (
    <Layout>
      <div className="container-base space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
          <p className="mt-1 text-gray-600">Utilisateurs et documents de la plateforme</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {!overview && !error && <p className="text-gray-600">Chargement...</p>}
        {overview && <section className="card overflow-x-auto">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Utilisateurs ({overview.users.length})</h2>
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mb-5 w-full max-w-xl rounded-lg border border-gray-300 px-4 py-3 text-gray-700">
            <option value="">Choisir un utilisateur pour voir ses documents</option>
            {overview.users.map((user) => <option key={user.id} value={user.id}>{user.prenom} {user.nom} - {user.email}</option>)}
          </select>
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b bg-gray-50"><tr><th className="px-4 py-3 text-left font-semibold text-gray-700">Nom</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Rôle</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Inscrit le</th></tr></thead>
            <tbody>{overview.users.map((user) => <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className={`cursor-pointer border-b hover:bg-blue-50 ${user.id === selectedUserId ? 'bg-blue-50' : ''}`}><td className="px-4 py-3 text-gray-700">{user.prenom} {user.nom}</td><td className="px-4 py-3 text-gray-700">{user.email}</td><td className="px-4 py-3 text-gray-700">{user.role}</td><td className="px-4 py-3 text-gray-700">{formatValue('created_at', user.created_at)}</td></tr>)}</tbody>
          </table>
        </section>}
        {overview && selectedUserId && <section className="card overflow-x-auto">
          <h2 className="mb-1 text-xl font-bold text-gray-900">Documents de {selectedUser?.prenom} {selectedUser?.nom}</h2>
          <p className="mb-4 text-sm text-gray-600">{selectedUser?.email} · {userDocuments.length} document(s)</p>
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-gray-50"><tr><th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Numéro</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Client / fournisseur</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Montant</th><th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th><th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th></tr></thead>
            <tbody>{userDocuments.map((document) => <tr key={`${document.documentType.key}-${document.id}`} className="border-b hover:bg-gray-50"><td className="px-4 py-3 text-gray-700">{document.documentType.label}</td><td className="px-4 py-3 font-medium text-gray-900">{document.numero}</td><td className="px-4 py-3 text-gray-700">{document.client || [document.client_prenom, document.client_nom].filter(Boolean).join(' ') || document.fournisseur || [document.beneficiaire_prenom, document.beneficiaire_nom].filter(Boolean).join(' ') || '-'}</td><td className="px-4 py-3 text-gray-700">{formatValue(document.montant_ht ? 'montant_ht' : 'montant', document.montant_ht || document.total_global || document.montant)}</td><td className="px-4 py-3 text-gray-700">{formatValue(document.documentType.date, document[document.documentType.date] || document.created_at)}</td><td className="px-4 py-3"><div className="flex justify-center gap-2"><button onClick={() => openPdf(document.documentType, document.id, false, document.numero)} className="rounded p-2 text-blue-600 hover:bg-blue-50" title="Visualiser le PDF"><Eye size={18} /></button><button onClick={() => openPdf(document.documentType, document.id, true, document.numero)} className="rounded p-2 text-green-600 hover:bg-green-50" title="Télécharger le PDF"><Download size={18} /></button></div></td></tr>)}</tbody>
          </table>
          {userDocuments.length === 0 && <p className="py-8 text-center text-gray-600">Aucun document créé par cet utilisateur.</p>}
        </section>}
      </div>
    </Layout>
  );
}