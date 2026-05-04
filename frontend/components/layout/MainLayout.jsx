import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Фіксоване бокове меню */}
      <Sidebar />
      
      {/* Основний контент (Зсунутий вправо на ширину меню - 64=16rem=256px) */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        
        {/* Сюди будуть підвантажуватися самі сторінки */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
