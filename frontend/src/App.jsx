import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingRoute from './pages/LandingFinalStyled';
import api from './api/axios';
import GoogleAnalytics from './components/analytics/GoogleAnalytics';
import SupportModeBanner from './components/support/SupportModeBanner';

const DemoTour = lazy(() => import('./pages/LandingFinalStyled').then((module) => ({ default: module.DemoTour })));
const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const DashboardOnboarding = lazy(() => import('./pages/DashboardOnboarding'));
const UniversalSearch = lazy(() => import('./pages/UniversalSearch'));
const Inventory = lazy(() => import('./pages/InventoryStage6'));
const Settings = lazy(() => import('./pages/Settings'));
const Billing = lazy(() => import('./pages/Billing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const DocumentSettings = lazy(() => import('./pages/DocumentSettings'));
const ServicesSettings = lazy(() => import('./pages/ServicesSettings'));
const DictionarySettings = lazy(() => import('./pages/DictionarySettings'));
const DeliverySettings = lazy(() => import('./pages/DeliverySettingsPro'));
const Login = lazy(() => import('./pages/Login'));
const RegisterOnboarding = lazy(() => import('./pages/RegisterOnboarding'));
const Visits = lazy(() => import('./pages/Visits'));
const StoreOrders = lazy(() => import('./pages/StoreOrders'));
const ClientsCRM = lazy(() => import('./pages/ClientsCRMStage5'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ActivityJournal = lazy(() => import('./pages/ActivityJournal'));
const Agent = lazy(() => import('./pages/Agent'));
const DataExchange = lazy(() => import('./pages/DataExchange'));
const PartnerClients = lazy(() => import('./pages/PartnerClients'));
const Partners = lazy(() => import('./pages/Partners'));
const Complexes = lazy(() => import('./pages/Complexes'));
const SupplierOrders = lazy(() => import('./pages/SupplierOrders'));
const AttentionAction = lazy(() => import('./pages/AttentionAction'));
const LandingLeads = lazy(() => import('./pages/LandingLeads'));
const SolutionSeoPage = lazy(() => import('./pages/SolutionSeoPage'));
const VisitCrmBridge = lazy(() => import('./components/visits/VisitCrmBridge'));
const VisitDeepLinkBridge = lazy(() => import('./components/visits/VisitDeepLinkBridge'));
const ActivityDock = lazy(() => import('./components/activity/ActivityDock'));
const DocumentDock = lazy(() => import('./components/documents/DocumentDock'));

const allowedWhenBlocked = ['/settings', '/billing', '/onboarding'];
const allowedDuringOnboarding = ['/onboarding', '/settings/delivery'];

const PageLoader = () => <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Завантаження…</div>;

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const supportMode = localStorage.getItem('support_mode') === 'true';
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
        setOnboardingRequired(onboardingRes.status === 'fulfilled' && onboardingRes.value.data?.onboarding_required === true);
      } catch {
        setAccessAllowed(true);
        setOnboardingRequired(false);
      } finally {
        setChecking(false);
      }
    };
    checkAccess();
  }, [token, location.pathname]);

  if (location.pathname === '/') return token ? <Navigate to="/app" replace /> : <LandingRoute />;
  if (!token) return <Navigate to="/login" replace />;
  if (checking) return <PageLoader />;

  const isAllowedRoute = allowedWhenBlocked.some((path) => location.pathname === path || location.pathname.startsWith(path + '/'));
  const isBlockedClient = accessAllowed === false && role === 'client';
  if (!supportMode && isBlockedClient && !isAllowedRoute) return <Navigate to="/billing" replace state={{ billingStatus }} />;

  const isOnboardingRoute = allowedDuringOnboarding.some((path) => location.pathname === path || location.pathname.startsWith(path + '/'));
  if (!supportMode && onboardingRequired && !isOnboardingRoute) return <Navigate to="/onboarding" replace />;
  return <><SupportModeBanner />{children}</>;
};

function LegacyLandingRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', search: location.search, hash: location.hash }} replace />;
}

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

  if (!businessType) return <PageLoader />;

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

  if (!businessType) return <PageLoader />;
  return <><ClientsCRM mode={businessType} /><ActivityDock /></>;
}

function App() {
  return (
    <BrowserRouter>
      <GoogleAnalytics />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/landing" element={<LegacyLandingRedirect />} />
          <Route path="/demo" element={<DemoTour />} />
          <Route path="/crm-dlya-sto" element={<SolutionSeoPage slug="crm-dlya-sto" />} />
          <Route path="/programma-dlya-avtoservisu" element={<SolutionSeoPage slug="programma-dlya-avtoservisu" />} />
          <Route path="/programma-dlya-shynomontazhu" element={<SolutionSeoPage slug="programma-dlya-shynomontazhu" />} />
          <Route path="/oblik-avtozapchastyn" element={<SolutionSeoPage slug="oblik-avtozapchastyn" />} />
          <Route path="/sklad-ta-zakupky-avtozapchastyn" element={<SolutionSeoPage slug="sklad-ta-zakupky-avtozapchastyn" />} />
          <Route path="/naryad-zamovlennya-sto" element={<SolutionSeoPage slug="naryad-zamovlennya-sto" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterOnboarding />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/app" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<DashboardOnboarding />} />
          </Route>
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<DashboardOnboarding />} />
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
            <Route path="agent" element={<Agent />} />
            <Route path="journal" element={<ActivityJournal />} />
            <Route path="data" element={<DataExchange />} />
            <Route path="partner-clients" element={<PartnerClients />} />
            <Route path="partners" element={<Partners />} />
            <Route path="complexes" element={<Complexes />} />
            <Route path="sales-leads" element={<LandingLeads />} />
            <Route path="crm" element={<CRMByBusinessType />} />
            <Route path="crm/clients" element={<CRMByBusinessType />} />
            <Route path="crm/:tab" element={<CRMByBusinessType />} />
            <Route path="crm/supplier-orders" element={<SupplierOrders />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
