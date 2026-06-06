import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, X } from 'lucide-react';
import ActivityTimeline from './ActivityTimeline';

const norm = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

function findTabsBarByLabels(requiredLabels = []) {
  const required = requiredLabels.map(norm);
  const candidates = Array.from(document.querySelectorAll('div'));
  return candidates.find((el) => {
    const buttons = Array.from(el.children).filter((node) => node.tagName === 'BUTTON');
    if (buttons.length < required.length) return false;
    const labels = norm(buttons.map((b) => b.innerText || '').join('|'));
    return required.every((label) => labels.includes(label));
  }) || null;
}

function findStoreOrderContext() {
  const text = document.body?.innerText || '';
  const match = text.match(/Замовлення\s*№\s*(\d+)/i);
  const tabsBar = findTabsBarByLabels(['Клієнт', 'Запчастини', 'Доставка']);
  if (!match || !tabsBar) return null;
  return { kind: 'store', title: `Історія замовлення №${match[1]}`, visitId: match[1], tabsBar };
}

function findStoVisitContext() {
  const text = document.body?.innerText || '';
  const match = text.match(/Візит\s*№\s*(\d+)/i) || text.match(/візит\s*№\s*(\d+)/i);
  const tabsBar = findTabsBarByLabels(['Огляд', 'Підсумок']);
  if (!match || !tabsBar) return null;
  return { kind: 'sto', title: `Історія візиту №${match[1]}`, visitId: match[1], tabsBar };
}

function findClientContext() {
  const tabsBar = findTabsBarByLabels(['Огляд', 'Історія покупок', 'Авто', 'Борги', 'Повернення']);
  if (!tabsBar) return null;
  const root = tabsBar.closest('section, div') || document.body;
  const text = root.innerText || document.body?.innerText || '';
  const phone = (text.match(/(?:\+?38)?0\d{9}/) || text.match(/\d{10,12}/))?.[0] || '';
  if (!phone) return null;
  return { kind: 'client', title: `Активність клієнта ${phone}`, phone, tabsBar };
}

function findContext() {
  return findStoreOrderContext() || findStoVisitContext() || findClientContext();
}

function contextKey(ctx) {
  if (!ctx) return '';
  return `${ctx.kind}:${ctx.visitId || ctx.phone || ''}`;
}

export default function ActivityDock() {
  const [ctx, setCtx] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const next = findContext();
      setCtx((prev) => {
        if (contextKey(prev) !== contextKey(next)) setOpen(false);
        return next;
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setInterval(update, 700);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, []);

  const visible = Boolean(ctx?.tabsBar);
  const buttonLabel = ctx?.kind === 'client' ? 'Активність' : 'Історія';
  const mode = ctx?.kind === 'store' ? 'store' : ctx?.kind === 'sto' ? 'sto' : undefined;

  const tabButton = useMemo(() => {
    if (!visible) return null;
    return <button type="button" onClick={() => setOpen(true)} className={`rounded-xl p-3 font-black uppercase text-xs flex items-center justify-center gap-2 whitespace-nowrap ${open ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-white bg-white/70 border border-slate-100'}`}>
      <History size={15}/>{buttonLabel}
    </button>;
  }, [visible, open, buttonLabel]);

  if (!visible) return null;

  const panel = open ? <div className="fixed inset-0 z-[95] bg-slate-900/45 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
    <div className="bg-white w-full md:max-w-4xl h-[92dvh] md:h-auto md:max-h-[88dvh] rounded-t-[28px] md:rounded-[28px] shadow-2xl overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Журнал довіри</p>
          <h2 className="text-xl md:text-2xl font-black uppercase">{ctx.title}</h2>
          <p className="text-xs font-bold text-blue-100 mt-1">Усі важливі дії: статуси, товари, склад, оплати, повернення.</p>
        </div>
        <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center"><X size={18}/></button>
      </div>
      <div className="p-3 md:p-5 overflow-y-auto bg-slate-50/60">
        <ActivityTimeline visitId={ctx.visitId} phone={ctx.phone} mode={mode} limit={100} title={ctx.kind === 'client' ? 'Активність клієнта' : 'Історія картки'} />
      </div>
    </div>
  </div> : null;

  return <>{ctx.tabsBar ? createPortal(tabButton, ctx.tabsBar) : null}{createPortal(panel, document.body)}</>;
}
