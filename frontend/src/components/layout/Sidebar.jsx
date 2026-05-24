import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Briefcase, LineChart, Settings, Users, Search, X, Package, UserCheck } from 'lucide-react';
import axios from 'axios';

const Sidebar = ({ isOpen, closeMenu }) => {
  const [role, setRole] = useState('mechanic');
  const [businessType, setBusinessType] = useState('sto');
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
        setBusinessType(response.data.company?.business_type || 'sto');
      } catch (error) {
        console.error("Помилка перевірки", error);
      }
    };

    fetchUserRole();
  }, []);

  const visitsName = businessType === 'store' ? 'Замовлення' : 'Візити';
  const visitsIcon = businessType === 'store' ? <Package size={20} /> : <CarFront size={20} />;

  const allMenuItems = [
    { name: 'Панель', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Пошук запчастин', icon: <Search size={20} />, path: '/search' },
    { name: visitsName, icon: visitsIcon, path: '/visits' },
    { name: 'Склад', icon: <Briefcase size={20} />, path: '/inventory' },
    { name: 'Аналітика', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Клієнти', icon: <Users size={20} />, path: '/clients' },
    { name: 'Мої підключені', icon: <UserCheck size={20} />, path: '/partner-clients', roles: ['partner'] },
    { name: 'Налаштування', icon: <Settings size={20} />, path: '/settings' },
  ];

  const fullAccessRoles = ['owner', 'admin', 'partner'];
  const menuItems = fullAccessRoles.includes(role)
    ? allMenuItems.filter((item) => !item.roles || item.roles.includes(role))
    : allMenuItems.filter((item) => [visitsName, 'Пошук запчастин', 'Клієнти', 'Налаштування'].includes(item.name));

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMenu}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 shadow-2xl md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 text-white border-b border-slate-800">
          <div className="font-bold text-xl">
            <span className="font-black tracking-tighter text-blue-500">VIN</span>
            <span className="italic text-white">-matrix</span>
          </div>
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
                  onClick={closeMenu}
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
