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
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Sidebar fixed. На десктопі місце під нього резервуємо через padding, а не margin + w-full. */}
      <Sidebar isOpen={isMobileMenuOpen} closeMenu={() => setIsMobileMenuOpen(false)} />

      {/*
        ВАЖЛИВО:
        Раніше тут було md:ml-64 + w-full. Це давало ширину 100% плюс margin зліва,
        тому сторінки візуально їхали вправо на компʼютері.
        Тепер основний контейнер займає реальну ширину екрана, а місце під меню
        резервується через md:pl-64. Контент усередині сторінок центрується коректно.
      */}
      <div className="min-h-screen w-full md:pl-64 flex flex-col transition-all duration-300">
        <Header toggleMenu={toggleMobileMenu} />

        <main className="flex-1 w-full min-w-0 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
