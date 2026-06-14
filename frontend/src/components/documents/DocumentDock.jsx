import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, ReceiptText, ShieldCheck, Undo2, X } from 'lucide-react';
import api from '../../api/axios';

const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const qty = (v) => Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function findContext() {
  const text = document.body?.innerText || '';
  const store = text.match(/Замовлення\s*№\s*(\d+)/i);
  if (store) return { id: store[1], mode: 'store', title: `Замовлення №${store[1]}` };
  const sto = text.match(/Візит\s*№\s*(\d+)/i) || text.match(/візит\s*№\s*(\d+)/i);
  if (sto) return { id: sto[1], mode: 'sto', title: `Візит №${sto[1]}` };
  return null;
}

const docTitles = {
  receipt: 'Товарний чек',
  invoice: 'Рахунок на оплату',
  waybill: 'Видаткова накладна',
  service_act: 'Акт виконаних робіт',
  warranty: 'Гарантійний талон',
  return_note: 'Акт повернення товару',
};

export default function DocumentDock() {
  const [ctx, setCtx] = useState(null);
  const [open, setOpen] = useState(false);
  const [visit, setVisit] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [embeddedTrigger, setEmbeddedTrigger] = useState(false);

  const load = async (overrideCtx = null) => {
    const currentCtx = overrideCtx?.id ? overrideCtx : ctx;
    if (!currentCtx?.id) return;

    setCtx(currentCtx);
    setLoading(true);
    try {
      const [visitRes, settingsRes] = await Promise.all([
        api.get(`/api/visits/${currentCtx.id}/`),
        api.get('/api/settings/'),
      ]);
      setVisit(visitRes.data);
      setSettings(settingsRes.data);
      setOpen(true);
    } catch (e) {
      alert('Не вдалося підготувати документи. Оновіть сторінку і спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const update = () => {
      setCtx(findContext());
      setEmbeddedTrigger(Boolean(document.querySelector('[data-document-dock-anchor="true"]')));
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    const timer = setInterval(update, 800);

    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || findContext();
      if (detail?.id) load(detail);
    };

    window.addEventListener('vinmatrix:open-documents', handler);
    return () => window.removeEventListener('vinmatrix:open-documents', handler);
  }, [ctx]);

  const docs = useMemo(() => {
    if (!ctx) return [];
    if (ctx.mode === 'store') return ['receipt', 'invoice', 'waybill', 'warranty', 'return_note'];
    return ['service_act', 'invoice', 'receipt', 'warranty'];
  }, [ctx]);

  if (!ctx) return null;

  return <>
    {!embeddedTrigger && (
      <button onClick={() => load()} disabled={loading} className="fixed right-5 bottom-24 z-[60] md:right-8 md:bottom-8 bg-slate-900 hover:bg-blue-700 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2 font-black text-xs uppercase transition">
        <FileText size={17}/>{loading ? 'Готуємо...' : 'Документи'}
      </button>
    )}

    {open && createPortal(<div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="bg-white w-full md:max-w-3xl rounded-t-[28px] md:rounded-[28px] shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white p-5 flex justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Пакет документів</p>
            <h2 className="text-2xl font-black uppercase">{ctx.title}</h2>
            <p className="text-xs font-bold text-blue-100 mt-1">Чек, накладна, рахунок, гарантія та документи СТО в одному місці.</p>
          </div>
          <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center"><X size={18}/></button>
        </div>
        <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docs.map((type) => <button key={type} onClick={() => printDocument(type, visit, settings)} className="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 p-4 transition group">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-white border border-slate-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">{iconFor(type)}</span>
              <div>
                <p className="font-black text-slate-900 uppercase">{docTitles[type]}</p>
                <p className="text-xs font-bold text-slate-500 mt-1">Відкрити друкований бланк із логотипом, реквізитами та підвалом.</p>
              </div>
            </div>
          </button>)}
        </div>
      </div>
    </div>, document.body)}
  </>;
}

function iconFor(type) {
  if (type === 'warranty') return <ShieldCheck size={19}/>;
  if (type === 'return_note') return <Undo2 size={19}/>;
  if (type === 'receipt') return <ReceiptText size={19}/>;
  return <Printer size={19}/>;
}

function printDocument(type, visit, settings) {
  if (!visit) return;
  const company = settings?.company || {};
  const title = docTitles[type] || 'Документ';
  const parts = Array.isArray(visit.parts) ? visit.parts : [];
  const services = Array.isArray(visit.services) ? visit.services : [];
  const partsTotal = parts.reduce((s, p) => s + Number(p.sell_price || 0) * Number(p.quantity || 1), 0);
  const servicesTotal = services.reduce((s, p) => s + Number(p.price || 0) * Number(p.quantity || 1), 0);
  const total = type === 'service_act' ? servicesTotal + partsTotal : partsTotal + (type === 'invoice' ? servicesTotal : 0);
  const rows = [
    ...(type === 'service_act' || type === 'invoice' ? services.map((s) => ({ article: 'Робота', name: s.name, qty: s.quantity, price: s.price, sum: Number(s.price || 0) * Number(s.quantity || 1) })) : []),
    ...parts.map((p) => ({ article: `${p.brand || ''} ${p.article || ''}`.trim(), name: p.name, qty: p.quantity, price: p.sell_price, sum: Number(p.sell_price || 0) * Number(p.quantity || 1) })),
  ];
  const warrantyText = company.document_warranty_text || 'Гарантія діє за умови встановлення та використання товару згідно з рекомендаціями виробника. Повернення можливе згідно з чинним законодавством та умовами продавця.';
  const footer = company.document_footer || 'Дякуємо за довіру. Зберігайте цей документ до завершення гарантійного терміну.';
  const requisites = company.document_requisites || '';
  const signature = company.document_signature || 'Підпис відповідальної особи';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;margin:0;background:#f8fafc}.page{width:210mm;min-height:297mm;margin:0 auto;background:white;padding:18mm}.header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0f172a;padding-bottom:16px}.brand{display:flex;gap:14px;align-items:center}.logo{width:64px;height:64px;object-fit:contain;border:1px solid #e2e8f0;border-radius:14px}.company h1{font-size:22px;margin:0}.muted{color:#64748b;font-size:12px}.doc-title{font-size:28px;font-weight:900;text-transform:uppercase;margin:24px 0 4px}.pill{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.box{border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#f8fafc}.box b{display:block;font-size:11px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#0f172a;color:white;text-align:left;font-size:11px;text-transform:uppercase;padding:10px}td{border-bottom:1px solid #e2e8f0;padding:10px;font-size:13px}td.num,th.num{text-align:right}.total{margin-left:auto;margin-top:18px;width:280px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}.total div{display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid #e2e8f0}.total div:last-child{border-bottom:0;background:#0f172a;color:white;font-weight:900}.note{margin-top:22px;border:1px dashed #cbd5e1;border-radius:16px;padding:14px;color:#475569;font-size:13px;line-height:1.45}.sign{display:flex;justify-content:space-between;gap:40px;margin-top:48px}.line{border-top:1px solid #0f172a;padding-top:8px;flex:1;color:#475569;font-size:12px}.footer{position:fixed;bottom:10mm;left:18mm;right:18mm;border-top:1px solid #e2e8f0;padding-top:8px;color:#64748b;font-size:11px}@media print{body{background:white}.page{margin:0;width:auto;min-height:auto}.footer{position:fixed}.no-print{display:none}}
  </style></head><body><div class="page">
    <div class="header"><div class="brand">${company.logo ? `<img class="logo" src="${esc(company.logo)}">` : ''}<div class="company"><h1>${esc(company.name || 'VIN-matrix')}</h1><div class="muted">${esc(company.address || '')}</div><div class="muted">${esc(company.phone || '')}</div></div></div><div class="muted" style="text-align:right">${new Date().toLocaleDateString('uk-UA')}<br>${esc(requisites).replace(/\n/g,'<br>')}</div></div>
    <div class="doc-title">${esc(title)}</div><span class="pill">№${esc(visit.id)} · ${esc(visit.status || '')}</span>
    <div class="grid"><div class="box"><b>Клієнт</b>${esc(visit.client || '—')}<br><span class="muted">${esc(visit.phone || '')}</span></div><div class="box"><b>Авто / VIN</b>${esc(visit.plate || '—')}<br><span class="muted">${esc(visit.vin_code || '')}</span></div></div>
    ${type === 'warranty' ? `<div class="note"><b>Умови гарантії</b><br>${esc(warrantyText).replace(/\n/g,'<br>')}</div>` : ''}
    ${type === 'return_note' ? `<div class="note"><b>Повернення товару</b><br>Товар прийнято до повернення після перевірки стану, комплектності та відповідності умовам повернення.</div>` : ''}
    <table><thead><tr><th>Артикул</th><th>Назва</th><th class="num">К-сть</th><th class="num">Ціна</th><th class="num">Сума</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.article || '—')}</td><td>${esc(r.name || '—')}</td><td class="num">${qty(r.qty)}</td><td class="num">${money(r.price)}</td><td class="num">${money(r.sum)}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Позицій немає</td></tr>'}</tbody></table>
    <div class="total"><div><span>Разом</span><b>${money(total)}</b></div><div><span>До сплати</span><b>${money(total)}</b></div></div>
    <div class="sign"><div class="line">${esc(signature)}</div><div class="line">Підпис клієнта</div></div>
    <div class="note">${esc(footer).replace(/\n/g,'<br>')}</div>
    <div class="footer">Документ сформовано у VIN-matrix · ${esc(company.name || '')}</div>
  </div><script>window.onload=()=>{window.print();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return alert('Браузер заблокував відкриття документа. Дозвольте спливаючі вікна.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}
