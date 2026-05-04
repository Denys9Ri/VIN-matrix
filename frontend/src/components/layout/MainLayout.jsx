import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <Sidebar />
      {/* ml-20 для вузького меню на мобілці, ml-64 для широкого на десктопі */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300">
        <Header />
        <main className="flex-1 p-4 md:p-6 ml-16 md:ml-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default MainLayout;
