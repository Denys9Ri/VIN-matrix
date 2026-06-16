import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, PackageCheck, RefreshCcw, Send, Truck, Wallet } from 'lucide-react';
import api from '../../api/axios';

const arr = (value) => (Array.isArray(value) ? value : []);
const num = (value) => Number(String(value || 0).replace(',', '.')) || 0;
const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

const parseDelivery = (order) => {
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
  const explicit = num(order?.grand_total || order?.finance?.grand_total);
  if (explicit > 0) return explicit;
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

const findDeliveryPanel = () => {
  const headings = Array.from(document.querySelectorAll('h3'));
  const heading = headings.find((el) => (el.textContent || '').trim().toLowerCase().includes('нова пошта'));
  return heading?.parentElement || null;
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
  if (value === 'arrived' || lowText.includes('прибул')) return { label: 'Прибуло у відділення', tone: 'amber', icon: PackageCheck };
  if (value === 'in_transit' || lowText.includes('дороз') || lowText.includes('пряму')) return { label: 'У дорозі', tone: 'blue', icon: Truck };
  if (value === 'sent' || value === 'created') return { label: 'ТТН створено', tone: 'indigo', icon: Truck };
  return { label: 'Без статусу', tone: 'slate', icon: Truck };
};

const tone = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function NovaPostInlineDeliveryPolish() {
  const [target, setTarget] = useState(null);
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [manualTtn, setManualTtn] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const oldChildrenRef = useRef([]);
  const oldCreateButtonRef = useRef(null);

  useEffect(() => {
    let mount = null;

    const sync = () => {
      const id = detectOpenOrderId();
      const panel = findDeliveryPanel();
      setOrderId(id || '');

      if (!id || !panel) {
        setTarget(null);
        return;
      }

      if (!mount || mount.parentElement !== panel) {
        if (mount?.parentElement) mount.remove();
        mount = document.createElement('div');
        mount.setAttribute('data-np-inline-polish', 'true');
        const heading = panel.querySelector('h3');
        if (heading?.nextSibling) panel.insertBefore(mount, heading.nextSibling);
        else panel.appendChild(mount);
      }

      const oldCreateButton = Array.from(panel.querySelectorAll('button')).find((button) => (button.textContent || '').toLowerCase().includes('створити ттн'));
      oldCreateButtonRef.current = oldCreateButton || null;

      const children = Array.from(panel.children).filter((child) => child !== mount && child.tagName !== 'H3');
      oldChildrenRef.current.forEach((child) => {
        if (!children.includes(child)) child.style.display = '';
      });
      children.forEach((child) => { child.style.display = 'none'; });
      oldChildrenRef.current = children;
      setTarget(mount);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setInterval(sync, 1000);

    return () => {
      observer.disconnect();
      clearInterval(timer);
      oldChildrenRef.current.forEach((child) => { child.style.display = ''; });
      if (mount?.parentElement) mount.remove();
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
      const nextOrder = orderRes.data || null;
      const nextDelivery = deliveryRes.data?.delivery || null;
      setOrder(nextOrder);
      setDelivery(nextDelivery);
      const merged = { ...parseDelivery(nextOrder), ...(nextDelivery || {}) };
      setManualTtn(merged.ttn || '');
    } catch {
      setNotice('Не вдалося завантажити доставку.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOrder(null);
    setDelivery(null);
    setNotice('');
    if (orderId) load(orderId);
  }, [orderId]);

  const merged = useMemo(() => ({ ...parseDelivery(order), ...(delivery || {}) }), [order, delivery]);
  const ttn = merged.ttn || manualTtn || '';
  const status = merged.status || merged.delivery_status || '';
  const statusText = merged.status_text || merged.delivery_status_text || merged.message || '';
  const meta = statusMeta(status, statusText);
  const Icon = meta.icon;
  const events = arr(merged.tracking_data?.events || merged.events || merged.status_history).slice(0, 8);
  const trackingUrl = ttn ? `https://tracking.novaposhta.ua/#/uk/tracking/${encodeURIComponent(ttn)}` : '';
  const total = orderTotal(order);
  const codEnabled = Boolean(merged.cod_enabled || order?.payment_status === 'cod');
  const paymentNotClosed = order && order.payment_status !== 'paid';
  const isReceived = meta.tone === 'emerald';
  const isReturned = meta.tone === 'rose';

  const saveTtn = async () => {
    if (!orderId || !manualTtn.trim()) return;
    setBusy('save');
    try {
      const nextDelivery = { ...parseDelivery(order), ...merged, ttn: manualTtn.trim(), delivery_status: 'sent', mode: 'store' };
      const res = await api.patch(`/api/visits/${orderId}/`, { delivery_data: JSON.stringify(nextDelivery), status: 'SHIPPED' });
      setOrder(res.data || order);
      setNotice('ТТН збережено.');
      await load(orderId);
    } catch {
      setNotice('Не вдалося зберегти ТТН.');
    } finally {
      setBusy('');
    }
  };

  const markSent = async () => {
    if (!orderId) return;
    setBusy('sent');
    try {
      const nextDelivery = { ...parseDelivery(order), ...merged, ttn: manualTtn.trim() || ttn, delivery_status: 'sent', mode: 'store' };
      const res = await api.patch(`/api/visits/${orderId}/`, { delivery_data: JSON.stringify(nextDelivery), status: 'SHIPPED' });
      setOrder(res.data || order);
      setNotice('Замовлення позначено як відправлене.');
      await load(orderId);
    } catch {
      setNotice('Не вдалося позначити відправлення.');
    } finally {
      setBusy('');
    }
  };

  const refreshStatus = async () => {
    if (!orderId || !ttn) return;
    setBusy('refresh');
    try {
      const res = await api.post(`/api/delivery/novapost/visits/${orderId}/status/`);
      setDelivery(res.data?.delivery || null);
      setNotice(res.data?.message || 'Статус Нової пошти оновлено.');
      await load(orderId);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося оновити статус Нової пошти.');
    } finally {
      setBusy('');
    }
  };

  const markPaid = async () => {
    if (!orderId) return;
    setBusy('paid');
    try {
      const res = await api.patch(`/api/visits/${orderId}/`, { payment_status: 'paid', prepayment_amount: total });
      setOrder(res.data || order);
      setNotice('Оплату позначено як отриману.');
      await load(orderId);
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
      const res = await api.patch(`/api/visits/${orderId}/`, { status: 'COMPLETED' });
      setOrder(res.data || order);
      setNotice('Замовлення закрито як виконане.');
      await load(orderId);
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
      const res = await api.patch(`/api/visits/${orderId}/`, { status: 'RETURNED' });
      setOrder(res.data || order);
      setNotice('Замовлення позначено як повернення.');
      await load(orderId);
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

  const openCreateTtn = () => {
    if (oldCreateButtonRef.current) oldCreateButtonRef.current.click();
  };

  if (!target || !orderId) return null;

  return createPortal(
    <div className="space-y-4">
      {notice && <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{notice}</div>}

      <section className={`rounded-[28px] border p-4 md:p-5 ${tone[meta.tone] || tone.slate}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em]">
              <Icon size={16} /> {ttn ? meta.label : 'ТТН ще не створено'}
            </div>
            <h3 className="mt-3 text-2xl font-black uppercase text-slate-950 break-words">{ttn || 'Нова пошта'}</h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{statusText || (ttn ? 'Натисніть “Оновити статус”, щоб підтягнути актуальний стан доставки.' : 'Створіть ТТН або внесіть її вручну. Після цього статус доставки буде контрольований.')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:min-w-[360px]">
            <Mini label="Післяплата" value={codEnabled ? money(merged.cod_amount || total) : 'Ні'} />
            <Mini label="Оплата" value={order?.payment_status === 'paid' ? 'Оплачено' : 'Потребує контролю'} bad={order?.payment_status !== 'paid'} />
            <Mini label="Одержувач" value={order?.client || '—'} />
            <Mini label="Телефон" value={order?.phone || '—'} />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <input value={manualTtn} onChange={(event) => setManualTtn(event.target.value)} placeholder="Введіть ТТН вручну" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-500 focus:bg-white" />
          <button type="button" onClick={saveTtn} disabled={busy === 'save' || !manualTtn.trim()} className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 disabled:opacity-50">{busy === 'save' ? 'Зберігаємо...' : 'Зберегти ТТН'}</button>
          <button type="button" onClick={markSent} disabled={busy === 'sent'} className="rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-emerald-100 disabled:opacity-50 inline-flex items-center justify-center gap-2"><Send size={15}/> Відправлено</button>
        </div>

        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          <ActionButton disabled={busy === 'refresh' || !ttn} onClick={refreshStatus} icon={<RefreshCcw size={15}/>} label={busy === 'refresh' ? 'Оновлюємо...' : 'Оновити статус'} />
          <ActionButton disabled={!ttn} onClick={copyTtn} icon={<Copy size={15}/>} label="Скопіювати ТТН" />
          <ActionButton disabled={!ttn} onClick={() => trackingUrl && window.open(trackingUrl, '_blank', 'noopener,noreferrer')} icon={<ExternalLink size={15}/>} label="Відкрити в НП" />
          <ActionButton onClick={openCreateTtn} icon={<Truck size={15}/>} label="Створити ТТН" />
        </div>
      </section>

      {(isReceived || codEnabled || isReturned) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {isReceived && order?.status !== 'COMPLETED' && <Suggestion tone="emerald" icon={<CheckCircle2 size={18}/>} title="Посилка отримана" text="Можна закрити замовлення, якщо все оплачено і товар виданий."><button type="button" disabled={busy === 'close'} onClick={closeOrder} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white disabled:opacity-60">Закрити замовлення</button></Suggestion>}
          {codEnabled && paymentNotClosed && <Suggestion tone="amber" icon={<Wallet size={18}/>} title="Післяплата" text="Після отримання грошей позначте оплату, щоб борг не висів."><button type="button" disabled={busy === 'paid'} onClick={markPaid} className="rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase text-white disabled:opacity-60">Позначити оплату</button></Suggestion>}
          {isReturned && <Suggestion tone="rose" icon={<AlertTriangle size={18}/>} title="Повернення / проблема" text="Перевірте причину, оплату і що робити з товаром."><button type="button" disabled={busy === 'return'} onClick={markReturned} className="rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-black uppercase text-white disabled:opacity-60">Позначити повернення</button></Suggestion>}
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Історія статусів</h4>
          <span className="rounded-xl bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-400">{events.length}</span>
        </div>
        {loading ? <p className="text-sm font-bold text-slate-400">Завантаження...</p> : events.length ? (
          <div className="space-y-2">
            {events.map((event, index) => <div key={`${event.time || index}-${index}`} className="rounded-2xl border border-white bg-white px-3 py-2"><p className="text-sm font-black text-slate-900">{event.text || event.status || 'Статус доставки'}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{formatDateTime(event.time)}</p></div>)}
          </div>
        ) : <p className="text-sm font-bold text-slate-400">Історія зʼявиться після створення ТТН або першого оновлення статусу.</p>}
      </section>
    </div>,
    target
  );
}

function Mini({ label, value, bad }) {
  return <div className="min-w-0 rounded-2xl border border-white/70 bg-white/80 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 truncate text-sm font-black ${bad ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p></div>;
}

function ActionButton({ icon, label, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45">{icon}{label}</button>;
}

function Suggestion({ tone: toneName, icon, title, text, children }) {
  const cls = toneName === 'rose' ? 'border-rose-100 bg-rose-50 text-rose-800' : toneName === 'amber' ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800';
  return <div className={`rounded-3xl border p-4 ${cls}`}><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0">{icon}</span><div className="min-w-0 flex-1"><h4 className="font-black uppercase text-sm">{title}</h4><p className="mt-1 text-xs font-bold leading-relaxed opacity-80">{text}</p><div className="mt-3">{children}</div></div></div></div>;
}
