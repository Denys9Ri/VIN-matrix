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
import PlatformClientsAdmin from './pages/PlatformClientsAdmin';

// Захисник роутів: якщо немає токена, викидає на /login
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// Заглушки для порожніх сторінок
const Placeholder = ({ title }) => <h1 className="text-2xl font-bold text-slate-800">{title}</h1>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ВІДКРИТІ СТОРІНКИ */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> 
        
        {/* ЗАХИЩЕНІ СТОРІНКИ (тільки після входу) */}
        <Route path="/" element={ <ProtectedRoute><MainLayout /></ProtectedRoute> }>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<UniversalSearch />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="visits" element={<Visits />} /> 
          <Route path="clients" element={<PlatformClientsAdmin />} />
          <Route path="analytics" element={<Analytics />} /> {/* <--- ЗАМІНИЛИ ЗАГЛУШКУ АНАЛІТИКИ */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
