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
import { COMPANY_BRAND } from '../config/company';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebarOnMobile = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      {sidebarOpen && <button type="button" aria-label="Fermer le menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/40 md:hidden" />}
      <div className={`${sidebarOpen ? 'translate-x-0 md:w-64' : '-translate-x-full md:translate-x-0 md:w-20'} fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transition-all duration-300 overflow-hidden md:static md:shrink-0`}>
        <div className="p-4 border-b border-gray-700">
          <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <span className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img src={COMPANY_BRAND.logoUrl} alt={COMPANY_BRAND.name} className="h-full w-full object-cover" />
            </span>
            {sidebarOpen && <div><h1 className="text-lg font-bold leading-tight">{COMPANY_BRAND.name}</h1><p className="text-xs text-gray-400">Gestion commerciale</p></div>}
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <SidebarLink to="/" label="Tableau de bord" open={sidebarOpen} icon="📊" onNavigate={closeSidebarOnMobile} />
          <SidebarLink to="/devis" label="Devis" open={sidebarOpen} icon="📝" onNavigate={closeSidebarOnMobile} />
          <SidebarLink to="/factures" label="Factures" open={sidebarOpen} icon="📄" onNavigate={closeSidebarOnMobile} />
          <SidebarLink to="/bons-commande" label="Bons de commande" open={sidebarOpen} icon="📦" onNavigate={closeSidebarOnMobile} />
          <SidebarLink to="/bons-versement" label="Bons de versement" open={sidebarOpen} icon="💶" onNavigate={closeSidebarOnMobile} />
          {user?.role === 'ADMIN' && <SidebarLink to="/admin" label="Administration" open={sidebarOpen} icon="🔐" onNavigate={closeSidebarOnMobile} />}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <header className="bg-white shadow">
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className="flex items-center gap-4">
              <span className="max-w-[120px] truncate text-sm text-gray-700 sm:max-w-none">{user?.prenom} {user?.nom}</span>
              <button
                onClick={handleLogout}
                className="btn-danger btn-small flex items-center gap-2"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="min-w-0 flex-1 overflow-auto p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Composant Lien Sidebar
 */
function SidebarLink({ to, label, open, icon, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
      title={!open ? label : ''}
    >
      <span className="text-xl">{icon}</span>
      {open && <span>{label}</span>}
    </Link>
  );
}
