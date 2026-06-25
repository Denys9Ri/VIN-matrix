import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Package, Search, ShoppingCart, Wrench } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const activeClass = 'text-blue-700';
const inactiveClass = 'text-slate-500';
const excludedPrefixes = ['/onboarding', '/login', '/register', '/attention'];

export default function MobileActionDock({ onOpenMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [businessType, setBusinessType] = useState('sto');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/settings/')
      .then((response) => {
        if (!cancelled) setBusinessType(response.data?.company?.business_type || 'sto');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const path = location.pathname;
    if (excludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
    const params = new URLSearchParams(location.search);
    return !(path === '/visits' && params.has('visit_id'));
  }, [location.pathname, location.search]);

  if (!visible) return null;

  const workLabel = businessType === 'store' ? 'Замовлення' : 'Візити';
  const WorkIcon = businessType === 'store' ? ShoppingCart : Wrench;
  const path = location.pathname;
  const primaryPaths = ['/visits', '/search', '/inventory'];
  const items = [
    { key: 'work', label: workLabel, icon: WorkIcon, onClick: () => navigate('/visits'), active: path === '/visits' },
    { key: 'search', label: 'Пошук', icon: Search, onClick: () => navigate('/search'), active: path === '/search' },
    { key: 'inventory', label: 'Склад', icon: Package, onClick: () => navigate('/inventory'), active: path === '/inventory' },
    { key: 'more', label: 'Ще', icon: Menu, onClick: onOpenMenu, active: !primaryPaths.includes(path) },
  ];

  return (
    <nav aria-label="Швидка мобільна навігація" className="vm-mobile-action-dock fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return <button key={item.key} type="button" onClick={item.onClick} className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black uppercase transition ${item.active ? 'bg-blue-50 text-blue-700' : inactiveClass}`} aria-current={item.active ? 'page' : undefined}>
            <Icon size={19} strokeWidth={item.active ? 2.6 : 2.1} className={item.active ? activeClass : ''} />
            <span className="max-w-full truncate">{item.label}</span>
          </button>;
        })}
      </div>
    </nav>
  );
}
