import React from 'react';
import { BarChart3, ReceiptText, WalletCards } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const linkClass = ({ isActive }) => `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${
  isActive
    ? 'bg-slate-950 text-white shadow-lg shadow-slate-300/40'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
}`;

export default function FinanceWorkspaceNav({ showExpenses = false }) {
  const location = useLocation();

  const goToExpenses = () => {
    if (location.pathname !== '/analytics') {
      window.location.assign('/analytics#expenses-section');
      return;
    }
    const section = document.getElementById('expenses-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mb-4 rounded-[26px] border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <NavLink to="/analytics" className={linkClass}>
          <BarChart3 size={16} /> Аналітика
        </NavLink>
        <NavLink to="/finance" className={linkClass}>
          <WalletCards size={16} /> Фінанси
        </NavLink>
        {showExpenses && (
          <button
            type="button"
            onClick={goToExpenses}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-rose-700 transition hover:bg-rose-100"
          >
            <ReceiptText size={16} /> Витрати
          </button>
        )}
      </div>
    </div>
  );
}
