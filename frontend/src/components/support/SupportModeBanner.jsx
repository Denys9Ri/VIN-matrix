import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Headphones, LogOut } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
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
  const accountName = companyName || clientName || 'клієнта';

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-100 text-amber-950 shadow-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex min-h-10 items-center justify-between gap-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-xl bg-amber-200 p-1.5"><Headphones size={16} /></div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black uppercase tracking-wide sm:text-xs">
                Технічна підтримка активна <span className="normal-case tracking-normal">· {accountName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white/70 text-amber-950 transition hover:bg-white"
            aria-expanded={expanded}
            aria-label={expanded ? 'Згорнути панель технічної підтримки' : 'Розгорнути панель технічної підтримки'}
            title={expanded ? 'Згорнути' : 'Розгорнути'}
          >
            {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </div>

        {expanded && (
          <div className="border-t border-amber-200 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-amber-200 p-2"><Headphones size={20} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Режим технічної підтримки</p>
                <p className="font-black">Ви працюєте в акаунті: {accountName}</p>
                <p className="text-sm font-bold">Доступ до: {formatDateTime(expiresAt)}{status?.reason ? ` · ${status.reason}` : ''}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={returnToAdmin}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black uppercase text-white hover:bg-slate-800"
            >
              <LogOut size={16} /> Повернутися до адмін-панелі
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportModeBanner;
