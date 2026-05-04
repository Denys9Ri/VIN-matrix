import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Фіксоване бокове меню */}
      <Sidebar />
      
      {/* Основний контент */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        
        {/* Сюди будуть підвантажуватися самі сторінки (Dashboard, Search) */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
