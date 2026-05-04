import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import UniversalSearch from './pages/UniversalSearch';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Login from './pages/Login';

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
        <Route path="/login" element={<Login />} />
        
        {/* Всі сторінки всередині цього блоку ЗАХИЩЕНІ */}
        <Route path="/" element={ <ProtectedRoute><MainLayout /></ProtectedRoute> }>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<UniversalSearch />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="visits" element={<Placeholder title="Active Visits" />} />
          <Route path="analytics" element={<Placeholder title="Analytics" />} />
          <Route path="clients" element={<Placeholder title="Clients" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
