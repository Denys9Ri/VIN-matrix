import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import UniversalSearch from './pages/UniversalSearch';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';

// Тимчасова заглушка для сторінок, які ми ще не зверстали
const Placeholder = ({ title }) => <h1 className="text-2xl font-bold text-slate-800">{title}</h1>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<UniversalSearch />} />
          <Route path="visits" element={<Placeholder title="Active Visits" />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="inventory" element={<Placeholder title="Inventory" />} />
          <Route path="analytics" element={<Placeholder title="Analytics" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
          <Route path="clients" element={<Placeholder title="Clients" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
