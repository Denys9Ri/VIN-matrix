import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, LogOut, Menu, Search, Settings, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const roleLabel = {
  admin: 'Адміністратор',
  partner: 'Партнер',
  client: 'Клієнт',
  mechanic: 'Майстер',
};

const getInitials = (fullName, username) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return String(username || 'U').slice(0, 2).toUpperCase();
};

const copyToClipboard = async (value) => {
  if (!value) return;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const Header = ({ toggleMenu }) => {
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState(null);
  const [partnerStats, setPartnerStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const navigate = useNavigate();

  const role = profile?.actual_role || profile?.account_role || profile?.role || 'client';
  const user = profile?.user || {};
  const fullName = user.first_name || user.username || 'Користувач';
  const userCode = profile?.user_code || profile?.client_code_display || null;
  const initials = useMemo(() => getInitials(fullName, user.username), [fullName, user.username]);

  const handleQuickSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      const value = encodeURIComponent(query.trim());
      navigate('/search?q=' + value);
      setQuery('');
    }
  };

  const loadProfile = async () => {
    try {
      const res = await api.get('/api/settings/');
      const data = res.data || {};
      setProfile(data);
      const effectiveRole = data.actual_role || data.account_role || data.role;
      if (effectiveRole === 'partner') {
        try {
          const statsRes = await api.get('/api/platform-clients/stats/');
          setPartnerStats(statsRes.data || null);
        } catch (e) {}
      }
      if (effectiveRole === 'client' && data.subscription_warning) {
        const key = `subscriptionToastLastShown:${data.user_code || data.client_code_display || 'client'}`;
        const last = Number(localStorage.getItem(key) || 0);
        const threeHours = 3 * 60 * 60 * 1000;
        if (!last || Date.now() - last > threeHours) {
          setToastVisible(true);
          localStorage.setItem(key, String(Date.now()));
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const copyCode = async () => {
    await copyToClipboard(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const statusText = profile?.subscription_label || (profile?.access_allowed === false ? 'Немає доступу' : 'Активний');
  const statusDanger = profile?.access_allowed === false || profile?.subscription_warning;

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm w-full">
        <div className="flex items-center gap-2 md:gap-3 flex-1">
          <button onClick={toggleMenu} className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Menu size={24} />
          </button>

          <div className="relative w-full max-w-[160px] sm:max-w-[200px] md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Артикул..."
              className="w-full pl-8 pr-3 py-1.5 md:py-2 bg-slate-100 border border-slate-200 rounded-full text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-700 uppercase placeholder:normal-case placeholder:font-medium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleQuickSearch}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 ml-2 shrink-0 relative">
          {userCode && (
            <button onClick={copyCode} className="hidden sm:flex items-center gap-2 border-l pl-4 border-slate-200 hover:opacity-80 transition-opacity" title="Скопіювати код">
              <span className="text-[10px] font-black uppercase text-slate-400">Ваш код:</span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm shadow-blue-200">{userCode}</span>
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-400" />}
            </button>
          )}

          <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-black ${statusDanger ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {statusText}
          </span>

          <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shrink-0 shadow-md shadow-blue-200">
            {initials}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="font-black text-slate-900">{fullName}</p>
                <p className="text-sm text-slate-500 font-bold">{roleLabel[role] || role}</p>
                {userCode && <p className="mt-2 text-sm font-black text-blue-700">{userCode}</p>}
              </div>

              <div className="p-4 space-y-2 text-sm">
                {role === 'partner' && (
                  <>
                    <p className="font-bold text-slate-700">Мої клієнти: {partnerStats?.my_clients ?? 0}</p>
                    <p className="font-bold text-emerald-700">Активних: {partnerStats?.active_clients ?? 0}</p>
                  </>
                )}
                {role === 'client' && (
                  <>
                    <p className="font-bold text-slate-700">Доступ: {profile?.access_allowed === false ? 'немає доступу' : 'активний'}</p>
                    <p className={`font-bold ${statusDanger ? 'text-rose-700' : 'text-slate-700'}`}>До: {profile?.subscription_end_display || '—'}</p>
                  </>
                )}
              </div>

              <div className="p-2 border-t border-slate-100">
                <button onClick={() => { setMenuOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 font-bold text-slate-700">
                  <Settings size={16} /> Налаштування
                </button>
                <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 font-bold text-rose-700">
                  <LogOut size={16} /> Вийти
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {toastVisible && (
        <div className="fixed bottom-5 right-5 z-50 w-[320px] bg-white border border-rose-200 shadow-2xl rounded-2xl p-4">
          <div className="flex gap-3">
            <UserRound className="text-rose-600 shrink-0" size={22} />
            <div>
              <p className="font-black text-slate-900">Нагадування про підписку</p>
              <p className="text-sm text-slate-600 mt-1">Ваш доступ закінчується {profile?.subscription_end_display || 'скоро'}. Щоб не втратити доступ, продовжіть підписку.</p>
              <button onClick={() => setToastVisible(false)} className="mt-3 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs">Зрозуміло</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
