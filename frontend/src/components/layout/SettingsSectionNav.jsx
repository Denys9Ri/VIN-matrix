import React from 'react';
import { Bell, Bot, Settings2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const SettingsSectionNav = () => {
  const location = useLocation();
  const visible = location.pathname === '/settings'
    || location.pathname === '/settings/ai-agent'
    || location.pathname === '/settings/notifications';

  if (!visible) return null;

  const itemClass = ({ isActive }) =>
    `inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
      isActive
        ? 'bg-slate-900 text-white shadow-sm'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="px-3 pt-3 md:px-6">
      <div className="mx-auto flex max-w-[1680px] items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <NavLink to="/settings" end className={itemClass}>
          <Settings2 size={16} />
          Основні налаштування
        </NavLink>
        <NavLink to="/settings/notifications" className={itemClass}>
          <Bell size={16} />
          Сповіщення
        </NavLink>
        <NavLink to="/settings/ai-agent" className={itemClass}>
          <Bot size={16} />
          AI Agent
        </NavLink>
      </div>
    </div>
  );
};

export default SettingsSectionNav;
