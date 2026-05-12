import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Briefcase, LineChart, Settings, Users, Search, X } from 'lucide-react';
import axios from 'axios';

const Sidebar = ({ isOpen, closeMenu }) => {
  const [role, setRole] = useState('mechanic'); 
  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";

  useEffect(() => {
    const fetchUserRole = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      try {
        const response = await axios.get(`${API_BASE}/api/settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRole(response.data.role); 
      } catch (error) {
        console.error("Помилка перевірки ролі", error);
      }
    };

    fetchUserRole();
  }, []);

  const allMenuItems = [
    { name: 'Панель', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Пошук запчастин', icon: <Search size={20} />, path: '/search' },
    { name: 'Візити', icon: <CarFront size={20} />, path: '/visits' },
    { name: 'Склад', icon: <Briefcase size={20} />, path: '/inventory' },
    { name: 'Аналітика', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Клієнти', icon: <Users size={20} />, path: '/clients' },
    { name: 'Налаштування', icon: <Settings size={20} />, path: '/settings' },
  ];

  const menuItems = role === 'owner' 
    ? allMenuItems 
    : allMenuItems.filter(item => ['Візити', 'Налаштування'].includes(item.name));

  return (
    <>
      {/* ТЕМНИЙ ФОН НА МОБІЛЬНОМУ (Закриває меню по кліку поза ним) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMenu}
        />
      )}

      {/* САМЕ МЕНЮ: 
        На десктопі (md:translate-x-0) воно завжди на місці.
        На мобільному ховається за лівий екран (-translate-x-full) і виїжджає при isOpen.
      */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 shadow-2xl md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-16 flex items-center justify-between px-6 text-white border-b border-slate-800">
          <div className="font-bold text-xl">
            <span className="font-black tracking-tighter text-blue-500">VIN</span>
            <span className="italic text-white">-matrix</span>
          </div>
          {/* Кнопка закриття меню (тільки для мобільних) */}
          <button onClick={closeMenu} className="md:hidden p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 overflow-y-auto px-3">
          <ul className="space-y-1.5">
            {menuItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  onClick={closeMenu} // Автоматично закриваємо меню при кліку на телефоні
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
