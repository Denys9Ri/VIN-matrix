import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Briefcase, LineChart, Settings, Users, Search } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Панель', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Пошук запчастин', icon: <Search size={20} />, path: '/search' },
    { name: 'Візити', icon: <CarFront size={20} />, path: '/visits' },
    { name: 'Склад', icon: <Briefcase size={20} />, path: '/inventory' },
    { name: 'Аналітика', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Клієнти', icon: <Users size={20} />, path: '/clients' },
    { name: 'Налаштування', icon: <Settings size={20} />, path: '/settings' },
  ];

  return (
    <div className="w-20 md:w-64 h-screen bg-slate-900 text-slate-300 flex flex-col fixed left-0 top-0 z-50">
      <div className="h-16 flex items-center px-4 md:px-6 text-white font-bold text-lg md:text-xl border-b border-slate-800">
        <span className="hidden md:inline font-black tracking-tighter text-blue-500">VIN</span>
        <span className="hidden md:inline italic text-white">-matrix</span>
        <span className="md:hidden">VM</span>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 md:px-6 py-3 transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white border-r-4 border-white shadow-lg' 
                      : 'hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span className="hidden md:inline font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
