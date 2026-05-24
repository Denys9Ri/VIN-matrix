import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
