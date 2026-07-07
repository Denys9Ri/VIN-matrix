import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bot,
  Boxes,
  CreditCard,
  History,
  LayoutDashboard,
  LineChart,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import api from '../../api/axios';

const Sidebar = ({ isOpen, closeMenu }) => {
  const [role, setRole] = useState('client');
  const [businessType, setBusinessType] = useState('sto');
  const [canManagePartners, setCanManagePartners] = useState(false);
  const [canManageAccounts, setCanManageAccounts] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchUserRole = async () => {
      try {
        const response = await api.get('/api/settings/');

        if (cancelled) return;

        const data = response.data || {};

        setRole(data.actual_role || data.account_role || data.role || 'client');
        setBusinessType(data.company?.business_type || 'sto');
        setCanManagePartners(data.permissions?.can_manage_partners === true);
        setCanManageAccounts(data.permissions?.can_manage_accounts === true);
        setAccessAllowed(data.access_allowed !== false);
      } catch (error) {
        console.error('Помилка перевірки', error);
      }
    };

    fetchUserRole();

    return () => {
      cancelled = true;
    };
  }, []);

  const isStore = businessType === 'store';
  const workLabel = isStore ? 'Замовлення' : 'Візити';
  const WorkIcon = isStore ? ShoppingCart : Wrench;

  const workItems = [
    { name: workLabel, icon: <WorkIcon size={20} />, path: '/visits' },
    { name: 'Пошук запчастин', icon: <Search size={20} />, path: '/search' },
    { name: 'Клієнти', icon: <Users size={20} />, path: '/clients' },
    { name: 'Склад', icon: <Package size={20} />, path: '/inventory' },
  ];

  const goodsAndServicesItems = [
    ...(!isStore
      ? [
          {
            name: 'Пакети послуг',
            icon: <Boxes size={20} />,
            path: '/complexes',
          },
        ]
      : []),
    ...(!isStore
      ? [
          {
            name: 'Закупівлі',
            icon: <ShoppingCart size={20} />,
            path: '/crm/supplier-orders',
          },
        ]
      : []),
  ];

  const controlItems = [
    { name: 'Панель', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Аналітика', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Журнал дій', icon: <History size={20} />, path: '/activity' },
    { name: 'AI Agent', icon: <Bot size={20} />, path: '/agent' },
  ];

  const accessItems = [
    ...(accessAllowed && canManageAccounts
      ? [
          {
            name: 'Акаунти',
            icon: <UserCheck size={20} />,
            path: '/partner-clients',
          },
        ]
      : []),
    ...(accessAllowed && canManagePartners
      ? [
          {
            name: 'Партнери',
            icon: <ShieldCheck size={20} />,
            path: '/partners',
          },
        ]
      : []),
  ];

  const systemItems = [
    { name: 'Тариф', icon: <CreditCard size={20} />, path: '/billing' },
    {
      name: 'Налаштування',
      icon: <Settings size={20} />,
      path: '/settings',
    },
  ];

  const sections = accessAllowed
    ? [
        { title: 'Щоденна робота', items: workItems },
        { title: 'Товари та послуги', items: goodsAndServicesItems },
        { title: 'Контроль', items: controlItems },
        { title: 'Керування доступами', items: accessItems },
        { title: 'Система', items: systemItems },
      ]
    : [{ title: 'Доступ до системи', items: systemItems }];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={closeMenu}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-300 shadow-2xl transition-transform duration-300 ease-in-out md:translate-x-0 md:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6 text-white">
          <div className="text-xl font-bold">
            <span className="font-black tracking-tighter text-blue-500">
              VIN
            </span>
            <span className="italic text-white">-matrix</span>
          </div>

          <button
            onClick={closeMenu}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Закрити меню"
          >
            <X size={24} />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-5"
          aria-label="Головна навігація"
        >
          <div className="space-y-5">
            {sections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <section key={section.title}>
                  <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {section.title}
                  </p>

                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          end={item.path === '/'}
                          onClick={closeMenu}
                          className={({ isActive }) =>
                            `flex min-h-[46px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`
                          }
                        >
                          {item.icon}
                          <span className="min-w-0 truncate">
                            {item.name}
                          </span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>

          {!accessAllowed && (
            <div className="mx-1 mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold leading-relaxed text-rose-200">
              Немає доступу через відсутність оплати. Відкрийте “Тариф”, щоб
              створити заявку на оплату.
            </div>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
