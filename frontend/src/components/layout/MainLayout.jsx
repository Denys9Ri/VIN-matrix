import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileActionDock from './MobileActionDock';
import MobileTablePolish from './MobileTablePolish';
import SettingsProfileModalPolish from './SettingsProfileModalPolish';
import '../../styles/settings-profile-modal.css';

const DesktopLayoutCompatibility = () => (
  <style>{`
    @media (min-width: 768px) {
      .vm-main-layout [class~="md:pl-72"] { padding-left: 2rem; }
      .vm-main-layout [class~="max-w-[1680px]"] .sticky.top-2.z-20 { top: 5rem; }
    }

    @media (min-width: 1280px) {
      .vm-main-layout [class~="xl:sticky"][class~="xl:top-6"] { top: 5rem; }
    }

    @media (min-width: 1280px) and (max-width: 1535px) {
      .vm-main-layout [class~="max-w-[1600px]"] > [class~="grid-cols-1"][class~="gap-4"][class~="xl:grid-cols-4"],
      .vm-main-layout [class~="max-w-[1600px]"] > [class~="grid-cols-1"][class~="gap-4"][class~="xl:grid-cols-5"] {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .vm-main-layout [class~="2xl:grid-cols-[320px_minmax(0,1fr)]"] {
        grid-template-columns: 280px minmax(0, 1fr);
      }
    }

    @media (min-width: 1536px) {
      .vm-main-layout [class~="max-w-[1600px]"] > [class~="grid-cols-1"][class~="gap-4"][class~="xl:grid-cols-5"] {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    @media (min-width: 1800px) {
      .vm-main-layout [class~="max-w-[1600px]"] > [class~="grid-cols-1"][class~="gap-4"][class~="xl:grid-cols-5"] {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }
  `}</style>
);

const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="vm-main-layout min-h-screen bg-slate-50 overflow-x-hidden">
      <DesktopLayoutCompatibility />
      <SettingsProfileModalPolish />
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