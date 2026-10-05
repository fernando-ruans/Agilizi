import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { Loading } from './components/Loading';

import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import SuppliersPage from './pages/SuppliersPage';
import ServicesPage from './pages/ServicesPage';
import BudgetsPage from './pages/BudgetsPage';
import OrdersPage from './pages/OrdersPage';
import CashPage from './pages/CashPage';
import ExpensesPage from './pages/ExpensesPage';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/fornecedores" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
      <Route path="/servicos" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
      <Route path="/orcamentos" element={<ProtectedRoute><BudgetsPage /></ProtectedRoute>} />
      <Route path="/ordens-servico" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/caixa" element={<ProtectedRoute><CashPage /></ProtectedRoute>} />
      <Route path="/despesas" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
      <Route path="/produtos" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
      <Route path="/vendas" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* 404 */}
      <Route path="/404" element={<ProtectedRoute><NotFoundPage /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
