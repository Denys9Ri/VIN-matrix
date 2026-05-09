import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Briefcase, LineChart, Settings, Users, Search } from 'lucide-react';
import axios from 'axios';

const Sidebar = () => {
  // За замовчуванням ставимо 'mechanic', щоб до завантаження даних ніхто не бачив зайвого
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
        setRole(response.data.role); // Отримуємо 'owner' або 'mechanic'
      } catch (error) {
        console.error("Помилка перевірки ролі", error);
      }
    };

    fetchUserRole();
  }, []);

  // УСІ можливі пункти меню
  const allMenuItems = [
    { name: 'Панель', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Пошук запчастин', icon: <Search size={20} />, path: '/search' },
    { name: 'Візити', icon: <CarFront size={20} />, path: '/visits' },
    { name: 'Склад', icon: <Briefcase size={20} />, path: '/inventory' },
    { name: 'Аналітика', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Клієнти', icon: <Users size={20} />, path: '/clients' },
    { name: 'Налаштування', icon: <Settings size={20} />, path: '/settings' },
  ];

  // ФІЛЬТРАЦІЯ: Якщо власник — бачить усе. Якщо майстер — тільки Візити та Налаштування.
  const menuItems = role === 'owner' 
    ? allMenuItems 
    : allMenuItems.filter(item => ['Візити', 'Налаштування'].includes(item.name));

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
