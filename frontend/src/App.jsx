import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';

// Тимчасові заглушки для сторінок, поки ми їх не зверстаємо
const DashboardPlaceholder = () => <h1 className="text-2xl font-bold text-slate-800">Dashboard (Головна)</h1>;
const VisitsPlaceholder = () => <h1 className="text-2xl font-bold text-slate-800">Active Visits (Візити)</h1>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Всі маршрути всередині MainLayout будуть мати меню та шапку */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPlaceholder />} />
          <Route path="visits" element={<VisitsPlaceholder />} />
          <Route path="inventory" element={<div>Inventory</div>} />
          <Route path="analytics" element={<div>Analytics</div>} />
          <Route path="settings" element={<div>Settings</div>} />
          <Route path="clients" element={<div>Clients</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
