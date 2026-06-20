import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileActionDock from './MobileActionDock';
import MobileTablePolish from './MobileTablePolish';

const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar isOpen={isMobileMenuOpen} closeMenu={() => setIsMobileMenuOpen(false)} />
      <div className="min-h-screen w-full md:pl-64 flex flex-col transition-all duration-300">
        <Header />
        <main className="flex-1 w-full min-w-0 relative pb-[76px] md:pb-0">
          <Outlet />
        </main>
      </div>
      <MobileTablePolish />
      <MobileActionDock onOpenMenu={() => setIsMobileMenuOpen(true)} />
    </div>
  );
};

export default MainLayout;