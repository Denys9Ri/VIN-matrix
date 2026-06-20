import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import UniversalSearch from './pages/UniversalSearch';
import Inventory from './pages/InventoryStage6';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Onboarding from './pages/Onboarding';
import DocumentSettings from './pages/DocumentSettings';
import ServicesSettings from './pages/ServicesSettings';
import DictionarySettings from './pages/DictionarySettings';
import DeliverySettings from './pages/DeliverySettings';
import Login from './pages/Login';
import RegisterOnboarding from './pages/RegisterOnboarding';
import Visits from './pages/Visits';
import StoreOrders from './pages/StoreOrders';
import ClientsCRM from './pages/ClientsCRMStage5';
import Analytics from './pages/Analytics';
import ActivityJournal from './pages/ActivityJournal';
import DataExchange from './pages/DataExchange';
import PartnerClients from './pages/PartnerClients';
import Partners from './pages/Partners';
import Complexes from './pages/Complexes';
import CRM from './pages/CRM';
import SupplierOrders from './pages/SupplierOrders';
import AttentionAction from './pages/AttentionAction';
import VisitCrmBridge from './components/visits/VisitCrmBridge';
import VisitDeepLinkBridge from './components/visits/VisitDeepLinkBridge';
import ActivityDock from './components/activity/ActivityDock';
import DocumentDock from './components/documents/DocumentDock';
import api from './api/axios';

const allowedWhenBlocked = ['/settings', '/billing', '/onboarding'];
const allowedDuringOnboarding = ['/onboarding', '/settings/delivery'];

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [role, setRole] = useState(null);
  const [billingStatus, setBillingStatus] = useState(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) { setChecking(false); return; }
      try {
        const [settingsRes, onboardingRes] = await Promise.allSettled([
          api.get('/api/settings/'),
          api.get('/api/onboarding/'),
        ]);
        if (settingsRes.status === 'fulfilled') {
          const data = settingsRes.value.data || {};
          const billing = data.billing || {};
          setRole(data.actual_role || data.account_role || data.role || null);
          setBillingStatus(billing.billing_status || billing.status || data.billing_status || null);
          setAccessAllowed(data.access_allowed !== false);
        } else {
          setAccessAllowed(true);
        }
        if (onboardingRes.status === 'fulfilled') {
          setOnboardingRequired(onboardingRes.value.data?.onboarding_required === true);
        } else {
          setOnboardingRequired(false);
        }
      } catch {
        setAccessAllowed(true);
        setOnboardingRequired(false);
      } finally {
        setChecking(false);
      }
    };
    checkAccess();
  }, [token, location.pathname]);

  if (!token) return <Navigate to="/login" replace />;
  if (checking) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Готуємо робочий простір...</div>;

  const isAllowedRoute = allowedWhenBlocked.some((path) => location.pathname === path || location.pathname.startsWith(path + '/'));
  const isBlockedClient = accessAllowed === false && role === 'client';
  if (isBlockedClient && !isAllowedRoute) return <Navigate to="/billing" replace state={{ billingStatus }} />;

  const isOnboardingRoute = allowedDuringOnboarding.some((path) => location.pathname === path || location.pathname.startsWith(path + '/'));
  if (onboardingRequired && !isOnboardingRoute) return <Navigate to="/onboarding" replace />;
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
    return <><StoreOrders /><ActivityDock /><DocumentDock /></>;
  }

  return <><Visits /><VisitDeepLinkBridge /><VisitCrmBridge /><ActivityDock /><DocumentDock /></>;
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
  return <><ClientsCRM mode={businessType} /><ActivityDock /></>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterOnboarding />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<UniversalSearch />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/services" element={<ServicesSettings />} />
          <Route path="settings/documents" element={<DocumentSettings />} />
          <Route path="settings/dictionaries" element={<DictionarySettings />} />
          <Route path="settings/delivery" element={<DeliverySettings />} />
          <Route path="visits" element={<VisitsWithCrm />} />
          <Route path="attention" element={<AttentionAction />} />
          <Route path="clients" element={<><ClientsCRM /><ActivityDock /></>} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="activity" element={<ActivityJournal />} />
          <Route path="journal" element={<ActivityJournal />} />
          <Route path="data" element={<DataExchange />} />
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