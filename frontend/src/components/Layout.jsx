/**
 * Composant Layout Principal
 * ============================
 * 
 * Navbar, sidebar, footer
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuthStore } from '../context/authStore';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 overflow-hidden`}>
        <div className="p-4 border-b border-gray-700">
          <h1 className={`text-xl font-bold ${!sidebarOpen && 'text-center'}`}>
            {sidebarOpen ? 'ERP Commerce' : 'E'}
          </h1>
        </div>

        <nav className="p-4 space-y-2">
          <SidebarLink to="/" label="Tableau de bord" open={sidebarOpen} icon="📊" />
          <SidebarLink to="/devis" label="Devis" open={sidebarOpen} icon="📝" />
          <SidebarLink to="/factures" label="Factures" open={sidebarOpen} icon="📄" />
          <SidebarLink to="/bons-commande" label="Bons de commande" open={sidebarOpen} icon="📦" />
            <SidebarLink to="/bons-versement" label="Bons de versement" open={sidebarOpen} icon="💶" />
            {user?.role === 'ADMIN' && <SidebarLink to="/admin" label="Administration" open={sidebarOpen} icon="🔐" />}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <header className="bg-white shadow">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className="flex items-center gap-4">
              <span className="text-gray-700">{user?.prenom} {user?.nom}</span>
              <button
                onClick={handleLogout}
                className="btn-danger btn-small flex items-center gap-2"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Composant Lien Sidebar
 */
function SidebarLink({ to, label, open, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
      title={!open ? label : ''}
    >
      <span className="text-xl">{icon}</span>
      {open && <span>{label}</span>}
    </Link>
  );
}
