import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import UniversalSearch from './pages/UniversalSearch';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Visits from './pages/Visits';
import Analytics from './pages/Analytics';
import Clients from './pages/Clients';
import PartnerClients from './pages/PartnerClients';
import Partners from './pages/Partners';
import api from './api/axios';

const allowedWhenBlocked = ['/visits', '/settings'];

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        const res = await api.get('/api/settings/');
        const data = res.data || {};
        setRole(data.role || null);
        setAccessAllowed(data.access_allowed !== false);
      } catch (error) {
        setAccessAllowed(true);
      } finally {
        setChecking(false);
      }
    };
    checkAccess();
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Перевірка доступу...</div>;
  }

  const isAllowedRoute = allowedWhenBlocked.some((path) => location.pathname === path || location.pathname.startsWith(path + '/'));

  if (accessAllowed === false && role === 'client' && !isAllowedRoute) {
    return <Navigate to="/settings" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> 
        
        <Route path="/" element={ <ProtectedRoute><MainLayout /></ProtectedRoute> }>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<UniversalSearch />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="visits" element={<Visits />} /> 
          <Route path="clients" element={<Clients />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="partner-clients" element={<PartnerClients />} />
          <Route path="partners" element={<Partners />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
