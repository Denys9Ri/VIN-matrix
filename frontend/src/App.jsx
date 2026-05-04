import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard'; // <--- Імпортуємо сторінку

// Тимчасова заглушка для інших сторінок
const Placeholder = ({ title }) => <h1 className="text-2xl font-bold text-slate-800">{title}</h1>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Замінили заглушку на реальний Dashboard */}
          <Route index element={<Dashboard />} />
          <Route path="visits" element={<Placeholder title="Active Visits" />} />
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
