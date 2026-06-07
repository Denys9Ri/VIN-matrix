import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import CopyButton from '../common/CopyButton';
import NotificationBell from '../notifications/NotificationBell';
import GlobalSearchBox from '../search/GlobalSearchBox';

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

const formatShortDate = (value) => {
  if (!value) return null;
  const display = String(value);
  const match = display.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) return `${match[1]}.${match[2]}`;
  return display;
};

const getBillingBadge = (profile = {}) => {
  const billing = profile.billing || {};
  const status = billing.billing_status || billing.status || profile.billing_status;
  const daysLeft = billing.days_left ?? profile.days_until_subscription_end;
  const graceDaysLeft = billing.grace_days_left;
  const overdueDays = billing.overdue_days;
  const date = formatShortDate(billing.subscription_end_display || billing.trial_until_display || profile.subscription_end_display);

  if (profile.access_allowed === false || status === 'blocked') {
    return { text: 'Доступ призупинено', tone: 'danger', icon: <AlertTriangle size={14} /> };
  }
  if (status === 'grace') {
    const days = overdueDays || (graceDaysLeft ? Math.max(1, 4 - Number(graceDaysLeft)) : 1);
    return { text: `Прострочено ${days} дн.`, tone: 'warning', icon: <AlertTriangle size={14} /> };
  }
  if (status === 'payment_due_soon') {
    return { text: `Оплата через ${daysLeft ?? 3} дн.`, tone: 'warning', icon: <Clock3 size={14} /> };
  }
  if (status === 'trial') {
    return { text: `Тест ${daysLeft ?? 14} дн.`, tone: 'trial', icon: <CalendarDays size={14} /> };
  }
  if (date) {
    return { text: `Активний до ${date}`, tone: 'success', icon: <CheckCircle2 size={14} /> };
  }
  return { text: 'Активний', tone: 'success', icon: <CheckCircle2 size={14} /> };
};

const badgeClass = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-100/60',
  trial: 'bg-blue-50 text-blue-700 border-blue-100 shadow-blue-100/60',
  warning: 'bg-amber-50 text-amber-800 border-amber-100 shadow-amber-100/60',
  danger: 'bg-rose-50 text-rose-700 border-rose-100 shadow-rose-100/60',
};

const Header = ({ toggleMenu }) => {
  const [profile, setProfile] = useState(null);
  const [partnerStats, setPartnerStats] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const role = profile?.actual_role || profile?.account_role || profile?.role || 'client';
  const user = profile?.user || {};
  const fullName = user.first_name || user.username || 'Користувач';
  const userCode = profile?.user_code || profile?.client_code_display || null;
  const initials = useMemo(() => getInitials(fullName, user.username), [fullName, user.username]);
  const billingBadge = useMemo(() => getBillingBadge(profile || {}), [profile]);

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
  }, [location.pathname]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const statusDanger = billingBadge.tone === 'danger' || billingBadge.tone === 'warning';

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm w-full">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <button onClick={toggleMenu} className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <Menu size={24} />
          </button>

          <GlobalSearchBox compact />
        </div>

        <div className="flex items-center gap-2 md:gap-4 ml-2 shrink-0 relative">
          {userCode && (
            <div className="hidden sm:flex items-center gap-2 border-l pl-4 border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400">Ваш код:</span>
              <CopyButton
                value={userCode}
                label={userCode}
                copiedLabel="Скопійовано"
                title="Скопіювати код"
                tone="dark"
                className="px-2 py-0.5 rounded text-xs shadow-sm shadow-blue-200"
              />
            </div>
          )}

          {role === 'client' && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black shadow-sm transition hover:scale-[1.02] ${badgeClass[billingBadge.tone] || badgeClass.success}`}
              title="Тариф і оплата"
            >
              {billingBadge.icon}
              <span>{billingBadge.text}</span>
            </button>
          )}

          {role !== 'partner' && <NotificationBell />}

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
                    <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 font-black text-xs ${badgeClass[billingBadge.tone] || badgeClass.success}`}>
                      {billingBadge.icon}
                      <span>{billingBadge.text}</span>
                    </div>
                    <p className="font-bold text-slate-700">Доступ: {profile?.access_allowed === false ? 'немає доступу' : 'активний'}</p>
                    <p className={`font-bold ${statusDanger ? 'text-rose-700' : 'text-slate-700'}`}>До: {profile?.billing?.subscription_end_display || profile?.billing?.trial_until_display || profile?.subscription_end_display || '—'}</p>
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

      {role === 'client' && (
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={`sm:hidden fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-[11px] font-black shadow-xl ${badgeClass[billingBadge.tone] || badgeClass.success}`}
        >
          {billingBadge.icon}
          <span>{billingBadge.text}</span>
        </button>
      )}

      {toastVisible && (
        <div className="fixed bottom-5 right-5 z-50 w-[320px] bg-white border border-amber-200 shadow-2xl rounded-2xl p-4">
          <div className="flex gap-3">
            <UserRound className="text-amber-600 shrink-0" size={22} />
            <div>
              <p className="font-black text-slate-900">Нагадування про оплату</p>
              <p className="text-sm text-slate-600 mt-1">{profile?.billing?.message || `Ваш доступ закінчується ${profile?.subscription_end_display || 'скоро'}. Щоб не втратити доступ, продовжіть оплату.`}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => navigate('/settings')} className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 font-bold text-xs">Оплата</button>
                <button onClick={() => setToastVisible(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">Закрити</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;