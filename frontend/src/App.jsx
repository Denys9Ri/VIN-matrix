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
import StoreOrders from './pages/StoreOrders';
import ClientsCRM from './pages/ClientsCRM';
import Analytics from './pages/Analytics';
import ActivityJournal from './pages/ActivityJournal';
import PartnerClients from './pages/PartnerClients';
import Partners from './pages/Partners';
import Complexes from './pages/Complexes';
import CRM from './pages/CRM';
import SupplierOrders from './pages/SupplierOrders';
import AttentionAction from './pages/AttentionAction';
import VisitCrmBridge from './components/visits/VisitCrmBridge';
import VisitDeepLinkBridge from './components/visits/VisitDeepLinkBridge';
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
      if (!token) { setChecking(false); return; }
      try {
        const res = await api.get('/api/settings/');
        const data = res.data || {};
        setRole(data.actual_role || data.account_role || data.role || null);
        setAccessAllowed(data.access_allowed !== false);
      } catch (error) {
        setAccessAllowed(true);
      } finally {
        setChecking(false);
      }
    };
    checkAccess();
  }, [token, location.pathname]);

  if (!token) return <Navigate to="/login" replace />;
  if (checking) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Перевірка доступу...</div>;

  const isAllowedRoute = allowedWhenBlocked.some((path) => location.pathname === path || location.pathname.startsWith(path + '/'));
  if (accessAllowed === false && role === 'client' && !isAllowedRoute) return <Navigate to="/settings" replace />;
  return children;
};

function VisitsWithCrm() {
  const location = useLocation();
  const [businessType, setBusinessType] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/settings/')
      .then((res) => { if (!cancelled) setBusinessType(res.data?.company?.business_type || 'sto'); })
      .catch(() => { if (!cancelled) setBusinessType('sto'); });
    return () => { cancelled = true; };
  }, []);

  if (!businessType) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Завантаження режиму...</div>;

  if (businessType === 'store') {
    const params = new URLSearchParams(location.search);
    if (params.get('visit_id') && params.get('open') !== 'board') return <AttentionAction />;
    return <StoreOrders />;
  }

  return <><Visits /><VisitDeepLinkBridge /><VisitCrmBridge /></>;
}

function CRMByBusinessType() {
  const [businessType, setBusinessType] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/settings/')
      .then((res) => { if (!cancelled) setBusinessType(res.data?.company?.business_type || 'sto'); })
      .catch(() => { if (!cancelled) setBusinessType('sto'); });
    return () => { cancelled = true; };
  }, []);

  if (!businessType) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Завантаження CRM...</div>;
  if (businessType === 'store') return <ClientsCRM />;
  return <CRM />;
}

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
          <Route path="visits" element={<VisitsWithCrm />} /> 
          <Route path="attention" element={<AttentionAction />} />
          <Route path="clients" element={<ClientsCRM />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="activity" element={<ActivityJournal />} />
          <Route path="journal" element={<ActivityJournal />} />
          <Route path="partner-clients" element={<PartnerClients />} />
          <Route path="partners" element={<Partners />} />
          <Route path="complexes" element={<Complexes />} />
          <Route path="crm" element={<CRMByBusinessType />} />
          <Route path="crm/clients" element={<CRMByBusinessType />} />
          <Route path="crm/:tab" element={<CRMByBusinessType />} />
          <Route path="crm/supplier-orders" element={<SupplierOrders />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;