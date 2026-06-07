import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Briefcase, LineChart, Settings, Users, Search, X, Package, UserCheck, ShieldCheck, Boxes, History, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';

const Sidebar = ({ isOpen, closeMenu }) => {
  const [role, setRole] = useState('client');
  const [businessType, setBusinessType] = useState('sto');
  const [canManagePartners, setCanManagePartners] = useState(false);
  const [canManageAccounts, setCanManageAccounts] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await api.get('/api/settings/');
        const data = response.data || {};
        const effectiveRole = data.actual_role || data.account_role || data.role || 'client';
        setRole(effectiveRole);
        setBusinessType(data.company?.business_type || 'sto');
        setCanManagePartners(data.permissions?.can_manage_partners === true);
        setCanManageAccounts(data.permissions?.can_manage_accounts === true);
        setAccessAllowed(data.access_allowed !== false);
      } catch (error) {
        console.error('Помилка перевірки', error);
      }
    };
    fetchUserRole();
  }, []);

  const isStore = businessType === 'store';
  const visitsName = isStore ? 'Замовлення' : 'Візити';
  const visitsIcon = isStore ? <Package size={20} /> : <CarFront size={20} />;

  const paidMenuItems = [
    { name: 'Панель', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Пошук запчастин', icon: <Search size={20} />, path: '/search' },
    { name: 'Склад', icon: <Briefcase size={20} />, path: '/inventory' },
    ...(isStore ? [{ name: 'Клієнти', icon: <Users size={20} />, path: '/clients' }] : []),
    { name: 'Аналітика', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Журнал дій', icon: <History size={20} />, path: '/activity' },
    { name: 'Дані', icon: <FileSpreadsheet size={20} />, path: '/data' },
    ...(!isStore ? [{ name: 'CRM', icon: <Users size={20} />, path: '/crm/supplier-orders' }] : []),
    ...(!isStore ? [{ name: 'Комплекси', icon: <Boxes size={20} />, path: '/complexes' }] : []),
  ];

  const menuItems = [
    ...(accessAllowed ? paidMenuItems : []),
    { name: visitsName, icon: visitsIcon, path: '/visits' },
    ...(accessAllowed && role === 'partner' && canManageAccounts ? [{ name: 'Акаунти', icon: <UserCheck size={20} />, path: '/partner-clients' }] : []),
    ...(accessAllowed && canManagePartners ? [{ name: 'Партнери', icon: <ShieldCheck size={20} />, path: '/partners' }] : []),
    { name: 'Налаштування', icon: <Settings size={20} />, path: '/settings' },
  ];

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={closeMenu} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 shadow-2xl md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 text-white border-b border-slate-800">
          <div className="font-bold text-xl"><span className="font-black tracking-tighter text-blue-500">VIN</span><span className="italic text-white">-matrix</span></div>
          <button onClick={closeMenu} className="md:hidden p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><X size={24} /></button>
        </div>
        <nav className="flex-1 py-6 overflow-y-auto px-3">
          <ul className="space-y-1.5">
            {menuItems.map((item) => (
              <li key={item.name}>
                <NavLink to={item.path} onClick={closeMenu} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  {item.icon}<span>{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          {!accessAllowed && <div className="mx-1 mt-5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-bold text-rose-200">Немає доступу через відсутність оплати.</div>}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
