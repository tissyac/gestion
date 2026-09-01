import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { factureService } from '../services/api';
import { ArrowLeft, Eye, FileDown, Trash2, Plus } from 'lucide-react';

export default function FactureListPage() {
  const navigate = useNavigate();
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    const loadFactures = async () => {
      try {
        setLoading(true);
        const response = await factureService.list(page, limit);
        setFactures(response.data || []);
        setTotal(response.pagination?.total || 0);
      } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des factures');
      } finally {
        setLoading(false);
      }
    };

    loadFactures();
  }, [page, limit]);

  const handleDownload = async (factureId, numero) => {
    try {
      setDownloading(factureId);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/factures/${factureId}/pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Erreur de téléchargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Facture_${numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors du téléchargement');
    } finally {
      setDownloading(null);
    }
  };

  const handleView = async (factureId) => {
    const previewWindow = window.open('', '_blank');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/factures/${factureId}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Erreur de visualisation');
      const url = window.URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = url;
    } catch (error) {
      previewWindow?.close();
      console.error('Erreur:', error);
      alert('Erreur lors de la visualisation');
    }
  };

  const handleDelete = async (factureId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return;

    try {
      setDeleting(factureId);
      await factureService.delete(factureId);
      setFactures(factures.filter((f) => f.id !== factureId));
      alert('Facture supprimée');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><div className="text-gray-600">Chargement...</div></div>;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/factures')}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
        title="Retour"
      >
        <ArrowLeft size={18} />
        Retour
      </button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Factures</h1>
          <p className="text-gray-600 mt-1">Gestion de vos factures - {total} au total</p>
        </div>
        <button onClick={() => navigate('/factures')} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
          <Plus size={20} />
          Nouvelle Facture
        </button>
      </div>

      {factures.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">Aucune facture créée</p>
          <button onClick={() => navigate('/factures')} className="mt-4 text-green-600 hover:text-green-700 font-medium">Créer une première facture →</button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Numéro</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Client</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Montant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{f.numero}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{f.client || '-'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{Number(f.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{new Date(f.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex justify-center gap-3">
                      <button onClick={() => handleView(f.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition" title="Visualiser le PDF">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleDownload(f.id, f.numero)} disabled={downloading === f.id} className="p-2 text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50" title="Télécharger PDF">
                        <FileDown size={18} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} disabled={deleting === f.id} className="p-2 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50" title="Supprimer">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 border rounded disabled:opacity-50">← Précédent</button>
          <span className="px-4 py-2">Page {page} sur {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-4 py-2 border rounded disabled:opacity-50">Suivant →</button>
        </div>
      )}
    </div>
  );
}
