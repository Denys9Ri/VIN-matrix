import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, Copy, ExternalLink, PackageCheck, RefreshCcw, Truck, Wallet, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const arr = (value) => (Array.isArray(value) ? value : []);
const num = (value) => Number(String(value || 0).replace(',', '.')) || 0;
const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

const parseDeliveryData = (order) => {
  try {
    const raw = order?.delivery_data;
    if (!raw) return {};
    if (typeof raw === 'string' && raw.trim().startsWith('{')) return JSON.parse(raw);
    return typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const orderTotal = (order) => {
  const financeTotal = num(order?.grand_total || order?.finance?.grand_total);
  if (financeTotal > 0) return financeTotal;
  return arr(order?.parts).reduce((sum, part) => sum + num(part.sell_price) * (num(part.quantity) || 1), 0);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const detectOpenOrderId = () => {
  const overlays = Array.from(document.querySelectorAll('div.fixed.inset-0'));
  const drawer = overlays.find((el) => {
    const text = el.textContent || '';
    return text.includes('Замовлення №') && text.includes('Доставка');
  });
  if (!drawer) return '';
  const match = (drawer.textContent || '').match(/Замовлення\s*№\s*(\d+)/i);
  return match?.[1] || '';
};

const copyText = async (text) => {
  const value = String(text || '').trim();
  if (!value) return false;
  try {
    if (window.isSecureContext && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
};

const statusMeta = (status, text = '') => {
  const value = String(status || '').toLowerCase();
  const lowText = String(text || '').toLowerCase();
  if (value === 'received' || lowText.includes('отрим')) return { label: 'Отримано', tone: 'emerald', icon: CheckCircle2 };
  if (value === 'returned' || lowText.includes('повер') || lowText.includes('відмов')) return { label: 'Повернення', tone: 'rose', icon: AlertTriangle };
  if (value === 'arrived' || lowText.includes('прибул')) return { label: 'Прибуло', tone: 'amber', icon: PackageCheck };
  if (value === 'in_transit' || lowText.includes('дороз') || lowText.includes('пряму')) return { label: 'У дорозі', tone: 'blue', icon: Truck };
  if (value === 'created' || value === 'sent') return { label: 'ТТН створено', tone: 'indigo', icon: Clipboard };
  return { label: 'Відстежується', tone: 'slate', icon: Truck };
};

const toneClass = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function NovaPostDeliveryControl() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let last = '';
    const sync = () => {
      const next = detectOpenOrderId();
      if (next !== last) {
        last = next;
        setOrderId(next);
        setExpanded(Boolean(next));
        setNotice('');
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setInterval(sync, 1200);
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);

  const load = async (id = orderId) => {
    if (!id) return;
    setLoading(true);
    try {
      const [orderRes, deliveryRes] = await Promise.all([
        api.get(`/api/visits/${id}/`),
        api.get(`/api/delivery/novapost/visits/${id}/`).catch(() => ({ data: {} })),
      ]);
      setOrder(orderRes.data || null);
      setDelivery(deliveryRes.data?.delivery || null);
    } catch {
      setNotice('Не вдалося завантажити доставку Нової пошти.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOrder(null);
    setDelivery(null);
    if (orderId) load(orderId);
  }, [orderId]);

  const mergedDelivery = useMemo(() => {
    const fromOrder = parseDeliveryData(order);
    return { ...fromOrder, ...(delivery || {}) };
  }, [order, delivery]);

  const ttn = mergedDelivery.ttn || '';
  const status = mergedDelivery.status || mergedDelivery.delivery_status || '';
  const statusText = mergedDelivery.status_text || mergedDelivery.delivery_status_text || '';
  const meta = statusMeta(status, statusText);
  const StatusIcon = meta.icon;
  const events = arr(mergedDelivery.tracking_data?.events || mergedDelivery.events).slice(0, 8);
  const isReceived = meta.tone === 'emerald' || String(status).toLowerCase() === 'received';
  const isReturned = meta.tone === 'rose' || String(status).toLowerCase() === 'returned';
  const codEnabled = Boolean(mergedDelivery.cod_enabled || order?.payment_status === 'cod');
  const paymentNotClosed = order && order.payment_status !== 'paid';
  const total = orderTotal(order);
  const trackingUrl = ttn ? `https://tracking.novaposhta.ua/#/uk/tracking/${encodeURIComponent(ttn)}` : '';

  const navigateRefresh = () => {
    if (!orderId) return;
    navigate(`/visits?visit_id=${orderId}&tab=delivery&np=${Date.now()}`, { replace: false });
  };

  const refreshStatus = async () => {
    if (!orderId || !ttn) return;
    setBusy('refresh');
    try {
      const res = await api.post(`/api/delivery/novapost/visits/${orderId}/status/`);
      setDelivery(res.data?.delivery || null);
      setNotice(res.data?.message || 'Статус Нової пошти оновлено.');
      await load(orderId);
      navigateRefresh();
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося оновити статус ТТН.');
    } finally {
      setBusy('');
    }
  };

  const markPaid = async () => {
    if (!orderId) return;
    setBusy('paid');
    try {
      await api.patch(`/api/visits/${orderId}/`, { payment_status: 'paid', prepayment_amount: total });
      setNotice('Оплату позначено як отриману.');
      await load(orderId);
      navigateRefresh();
    } catch {
      setNotice('Не вдалося позначити оплату.');
    } finally {
      setBusy('');
    }
  };

  const closeOrder = async () => {
    if (!orderId) return;
    setBusy('close');
    try {
      await api.patch(`/api/visits/${orderId}/`, { status: 'COMPLETED' });
      setNotice('Замовлення закрито як виконане.');
      await load(orderId);
      navigateRefresh();
    } catch {
      setNotice('Не вдалося закрити замовлення.');
    } finally {
      setBusy('');
    }
  };

  const markReturned = async () => {
    if (!orderId) return;
    setBusy('return');
    try {
      await api.patch(`/api/visits/${orderId}/`, { status: 'RETURNED' });
      setNotice('Замовлення позначено як повернення.');
      await load(orderId);
      navigateRefresh();
    } catch {
      setNotice('Не вдалося позначити повернення.');
    } finally {
      setBusy('');
    }
  };

  const copyTtn = async () => {
    const ok = await copyText(ttn);
    setNotice(ok ? 'ТТН скопійовано.' : 'Не вдалося скопіювати ТТН.');
  };

  if (!orderId) return null;

  return (
    <div className="fixed bottom-4 right-3 left-3 z-[75] md:left-auto md:right-6 md:bottom-6 md:w-[430px] pointer-events-none">
      <div className="pointer-events-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full bg-slate-950 text-white px-4 py-3 flex items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Truck size={17} className="text-blue-200 shrink-0" />
            <span className="text-xs font-black uppercase tracking-[0.14em] truncate">Контроль доставки НП</span>
          </span>
          <span className={`rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase ${toneClass[meta.tone] || toneClass.slate}`}>
            {ttn ? meta.label : 'Без ТТН'}
          </span>
        </button>

        {expanded && (
          <div className="max-h-[72vh] overflow-y-auto p-4 space-y-4">
            {loading && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">Завантаження доставки...</div>}
            {notice && <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 flex items-start justify-between gap-3"><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15}/></button></div>}

            <div className={`rounded-3xl border p-4 ${toneClass[meta.tone] || toneClass.slate}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Замовлення №{orderId}</p>
                  <h3 className="mt-1 text-xl font-black uppercase leading-tight flex items-center gap-2"><StatusIcon size={19}/> {ttn ? meta.label : 'ТТН ще не створено'}</h3>
                  <p className="mt-2 text-xs font-bold leading-relaxed break-words">{statusText || (ttn ? 'Статус готовий до оновлення.' : 'Створіть або внесіть ТТН у вкладці доставки.')}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini label="ТТН" value={ttn || '—'} />
                <Mini label="Післяплата" value={codEnabled ? money(mergedDelivery.cod_amount || total) : 'Ні'} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ActionButton disabled={!ttn || busy === 'refresh'} onClick={refreshStatus} icon={<RefreshCcw size={15}/>} label={busy === 'refresh' ? 'Оновлюємо...' : 'Оновити статус'} />
              <ActionButton disabled={!ttn} onClick={copyTtn} icon={<Copy size={15}/>} label="Скопіювати ТТН" />
              <ActionButton disabled={!ttn} onClick={() => trackingUrl && window.open(trackingUrl, '_blank', 'noopener,noreferrer')} icon={<ExternalLink size={15}/>} label="Відкрити в НП" />
              <ActionButton onClick={() => navigateRefresh()} icon={<Truck size={15}/>} label="Вкладка доставки" />
            </div>

            {isReceived && order?.status !== 'COMPLETED' && (
              <Suggestion tone="emerald" icon={<CheckCircle2 size={18}/>} title="Посилка отримана" text="Можна закрити замовлення як виконане, якщо товар і документи в порядку.">
                <button type="button" disabled={busy === 'close'} onClick={closeOrder} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white shadow-lg shadow-emerald-100 disabled:opacity-60">{busy === 'close' ? 'Закриваємо...' : 'Закрити замовлення'}</button>
              </Suggestion>
            )}

            {codEnabled && paymentNotClosed && (
              <Suggestion tone="amber" icon={<Wallet size={18}/>} title="Післяплата очікується" text="Перевірте надходження післяплати. Коли гроші зайшли — позначте оплату в замовленні.">
                <button type="button" disabled={busy === 'paid'} onClick={markPaid} className="rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase text-white shadow-lg shadow-amber-100 disabled:opacity-60">{busy === 'paid' ? 'Фіксуємо...' : 'Позначити оплату'}</button>
              </Suggestion>
            )}

            {isReturned && (
              <Suggestion tone="rose" icon={<AlertTriangle size={18}/>} title="Повернення / проблема" text="Нова пошта показує повернення або відмову. Перевірте причину, оплату і що робити з товаром.">
                <button type="button" disabled={busy === 'return'} onClick={markReturned} className="rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-black uppercase text-white shadow-lg shadow-rose-100 disabled:opacity-60">{busy === 'return' ? 'Фіксуємо...' : 'Позначити повернення'}</button>
              </Suggestion>
            )}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Історія статусів</h4>
                <span className="text-[10px] font-black uppercase text-slate-400">{events.length}</span>
              </div>
              {events.length ? (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div key={`${event.time || index}-${index}`} className="rounded-2xl border border-white bg-white px-3 py-2">
                      <p className="text-xs font-black text-slate-900">{event.text || event.status || 'Статус'}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">{formatDateTime(event.time)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-400">Історія зʼявиться після створення ТТН або першого оновлення статусу.</p>
              )}
            </div>

            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">Автооновлення через cron можна додати наступним етапом. Зараз контроль ручний і безпечний: статус оновлюється кнопкою.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return <div className="rounded-2xl border border-white/70 bg-white/75 p-3 min-w-0"><p className="text-[9px] font-black uppercase tracking-wide opacity-60">{label}</p><p className="mt-1 truncate text-xs font-black">{value}</p></div>;
}

function ActionButton({ icon, label, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-45 disabled:cursor-not-allowed">{icon}{label}</button>;
}

function Suggestion({ tone, icon, title, text, children }) {
  const cls = tone === 'rose' ? 'border-rose-100 bg-rose-50 text-rose-800' : tone === 'amber' ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800';
  return <div className={`rounded-3xl border p-4 ${cls}`}><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0">{icon}</span><div className="min-w-0 flex-1"><h4 className="font-black uppercase text-sm">{title}</h4><p className="mt-1 text-xs font-bold leading-relaxed opacity-80">{text}</p><div className="mt-3">{children}</div></div></div></div>;
}
