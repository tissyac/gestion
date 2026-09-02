import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bonCommandeService } from '../services/api';
import { ArrowLeft, Eye, FileDown, Trash2, Plus } from 'lucide-react';

export default function BonCommandeListPage() {
  const navigate = useNavigate();
  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    const loadBons = async () => {
      try {
        setLoading(true);
        const response = await bonCommandeService.list(page, limit);
        setBons(response.data || []);
        setTotal(response.pagination?.total || 0);
      } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des bons de commande');
      } finally {
        setLoading(false);
      }
    };

    loadBons();
  }, [page, limit]);

  const handleDownload = async (bonId, numero) => {
    try {
      setDownloading(bonId);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/bons-commande/${bonId}/pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Erreur de téléchargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BonCommande_${numero}.pdf`;
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

  const handleView = async (bonId) => {
    const previewWindow = window.open('', '_blank');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/bons-commande/${bonId}/pdf`, {
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

  const handleDelete = async (bonId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce bon de commande ?')) return;

    try {
      setDeleting(bonId);
      await bonCommandeService.delete(bonId);
      setBons(bons.filter((b) => b.id !== bonId));
      alert('Bon de commande supprimé');
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
        onClick={() => navigate('/bons-commande')}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
        title="Retour"
      >
        <ArrowLeft size={18} />
        Retour
      </button>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mes Bons de Commande</h1>
          <p className="text-gray-600 mt-1">Gestion de vos bons de commande - {total} au total</p>
        </div>
        <button onClick={() => navigate('/bons-commande')} className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition">
          <Plus size={20} />
          Nouveau Bon de commande
        </button>
      </div>

      {bons.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">Aucun bon de commande créé</p>
          <button onClick={() => navigate('/bons-commande')} className="mt-4 text-amber-600 hover:text-amber-700 font-medium">Créer un premier bon de commande →</button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full table-fixed text-xs sm:text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-900 sm:px-6">Numéro</th>
                <th className="hidden px-2 py-3 text-left text-sm font-semibold text-gray-900 sm:table-cell sm:px-6">Fournisseur</th>
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-900 sm:px-6">Montant</th>
                <th className="px-2 py-3 text-left text-sm font-semibold text-gray-900 sm:px-6">Date</th>
                <th className="px-2 py-3 text-center text-sm font-semibold text-gray-900 sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bons.map((b) => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-4 text-sm font-medium text-gray-900 sm:px-6">{b.numero}</td>
                  <td className="hidden px-2 py-4 text-sm text-gray-700 sm:table-cell sm:px-6">{b.fournisseur || '-'}</td>
                  <td className="px-2 py-4 text-sm font-semibold text-gray-900 sm:px-6">{Number(b.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</td>
                  <td className="px-2 py-4 text-sm text-gray-700 sm:px-6">{new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-2 py-4 text-sm sm:px-6">
                    <div className="flex justify-center gap-3">
                      <button onClick={() => handleView(b.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition" title="Visualiser le PDF">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleDownload(b.id, b.numero)} disabled={downloading === b.id} className="p-2 text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50" title="Télécharger PDF">
                        <FileDown size={18} />
                      </button>
                      <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id} className="p-2 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50" title="Supprimer">
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
