import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = () => {
  // Стан для керування мобільним меню
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Передаємо стан і функцію закриття в Sidebar.
        На десктопі він завжди відкритий, на мобільному керується станом.
      */}
      <Sidebar isOpen={isMobileMenuOpen} closeMenu={() => setIsMobileMenuOpen(false)} />
      
      {/* Головний контейнер: на мобільному margin-0 (на весь екран), на десктопі margin-64 (під меню) */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen w-full transition-all duration-300">
        <Header toggleMenu={toggleMobileMenu} />
        
        {/* Прибрали жорсткі відступи ml-16, тепер контент займає всю ширину */}
        <main className="flex-1 w-full relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
