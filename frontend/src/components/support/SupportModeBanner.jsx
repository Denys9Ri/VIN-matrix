import React, { useEffect, useState } from 'react';
import { Headphones, LogOut } from 'lucide-react';
import api from '../../api/axios';

const supportKeys = ['support_mode', 'support_session_id', 'support_client_name', 'support_company_name', 'support_expires_at'];

export const restoreOriginalAdminSession = () => {
  const originalAccess = localStorage.getItem('support_original_access_token');
  const originalRefresh = localStorage.getItem('support_original_refresh_token');
  if (originalAccess) localStorage.setItem('access_token', originalAccess);
  else localStorage.removeItem('access_token');
  if (originalRefresh) localStorage.setItem('refresh_token', originalRefresh);
  else localStorage.removeItem('refresh_token');
  [...supportKeys, 'support_original_access_token', 'support_original_refresh_token'].forEach((key) => localStorage.removeItem(key));
};

const formatDateTime = (value) => value ? new Date(value).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const SupportModeBanner = () => {
  const [status, setStatus] = useState(null);
  const supportMode = localStorage.getItem('support_mode') === 'true';

  const returnToAdmin = async () => {
    try { await api.post('/api/support/exit/'); } catch { /* expired/invalid support token: restore locally anyway */ }
    restoreOriginalAdminSession();
    window.location.assign('/partner-clients');
  };

  useEffect(() => {
    if (!supportMode) return undefined;
    let cancelled = false;
    api.get('/api/support/status/')
      .then((res) => { if (!cancelled) setStatus(res.data || {}); })
      .catch((error) => {
        if ([401, 403].includes(error?.response?.status)) {
          restoreOriginalAdminSession();
          window.location.assign('/partner-clients');
        }
      });
    return () => { cancelled = true; };
  }, [supportMode]);

  if (!supportMode) return null;

  const companyName = status?.company_name || localStorage.getItem('support_company_name') || '';
  const clientName = status?.client_name || localStorage.getItem('support_client_name') || '';
  const expiresAt = status?.expires_at || localStorage.getItem('support_expires_at');

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-100 text-amber-950 shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-amber-200 p-2"><Headphones size={20}/></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Режим технічної підтримки</p>
            <p className="font-black">Ви працюєте в акаунті: {companyName || clientName || 'клієнта'}</p>
            <p className="text-sm font-bold">Доступ до: {formatDateTime(expiresAt)}{status?.reason ? ` · ${status.reason}` : ''}</p>
          </div>
        </div>
        <button type="button" onClick={returnToAdmin} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black uppercase text-white hover:bg-slate-800">
          <LogOut size={16}/> Повернутися до адмін-панелі
        </button>
      </div>
    </div>
  );
};

export default SupportModeBanner;
