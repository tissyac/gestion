/**
 * Application React - Point d'entrée
 * ====================================
 * 
 * Configuration des routes
 * Setup du contexte d'authentification
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './context/authStore';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DocumentModulePage from './pages/DocumentModulePage';
import DevisPage from './pages/DevisPage';
import DevisListPage from './pages/DevisListPage';
import FacturePage from './pages/FacturePage';
import FactureListPage from './pages/FactureListPage';
import BonCommandePage from './pages/BonCommandePage';
import BonCommandeListPage from './pages/BonCommandeListPage';
import BonVersionmentPage from './pages/BonVersionmentPage';
import BonVersionmentListPage from './pages/BonVersionmentListPage';
import AdminPage from './pages/AdminPage';

// Composant Route Protégée
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

// Application principale
function App() {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentUser();
    }
  }, [isAuthenticated, fetchCurrentUser]);

  return (
    <Router>
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Routes protégées */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/devis"
          element={
            <ProtectedRoute>
              <DocumentModulePage
                title="Devis"
                description="Gérez vos devis clients depuis une seule page dédiée."
                icon="📝"
                createRoute="/devis/new"
                listRoute="/devis-list"
                createLabel="Nouveau devis"
                listLabel="Mes devis"
                accentClass="from-blue-500 to-blue-700"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/devis/new"
          element={
            <ProtectedRoute>
              <DevisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/devis-list"
          element={
            <ProtectedRoute>
              <DevisListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/factures"
          element={
            <ProtectedRoute>
              <DocumentModulePage
                title="Factures"
                description="Accédez rapidement à la création ou à la consultation de vos factures."
                icon="📄"
                createRoute="/factures/new"
                listRoute="/factures-list"
                createLabel="Nouvelle facture"
                listLabel="Mes factures"
                accentClass="from-green-500 to-green-700"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/factures/new"
          element={
            <ProtectedRoute>
              <FacturePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/factures-list"
          element={
            <ProtectedRoute>
              <FactureListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bons-commande"
          element={
            <ProtectedRoute>
              <DocumentModulePage
                title="Bons de commande"
                description="Choisissez entre créer ou consulter vos bons de commande fournisseurs."
                icon="📦"
                createRoute="/bons-commande/new"
                listRoute="/bons-commande-list"
                createLabel="Nouveau bon de commande"
                listLabel="Mes bons de commande"
                accentClass="from-amber-500 to-orange-600"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bons-commande/new"
          element={
            <ProtectedRoute>
              <BonCommandePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bons-commande-list"
          element={
            <ProtectedRoute>
              <BonCommandeListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bons-versement"
          element={
            <ProtectedRoute>
              <DocumentModulePage
                title="Bons de versement"
                description="Choisissez entre créer ou consulter vos bons de versement."
                icon="💶"
                createRoute="/bons-versement/new"
                listRoute="/bons-versement-list"
                createLabel="Nouveau bon de versement"
                listLabel="Mes bons de versements"
                accentClass="from-purple-500 to-violet-700"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bons-versement/new"
          element={
            <ProtectedRoute>
              <BonVersionmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bons-versement-list"
          element={
            <ProtectedRoute>
              <BonVersionmentListPage />
            </ProtectedRoute>
          }
        />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        {/* Route 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
