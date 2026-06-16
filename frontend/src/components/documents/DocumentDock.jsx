import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock3, Copy, Download, Eye, FileText, History, Printer, ReceiptText, Share2, ShieldCheck, Undo2, X } from 'lucide-react';
import api from '../../api/axios';

const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
const qty = (value) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const nl2br = (value) => esc(value || '').replace(/\n/g, '<br>');
const arr = (value) => (Array.isArray(value) ? value : []);

const docTypes = {
  receipt: { title: 'Товарний чек', short: 'Чек', icon: ReceiptText, tone: 'blue', description: 'Короткий документ для клієнта з товарами, роботами, оплатою і боргом.' },
  invoice: { title: 'Рахунок на оплату', short: 'Рахунок', icon: FileText, tone: 'emerald', description: 'Документ для оплати з реквізитами, сумою до сплати і призначенням.' },
  waybill: { title: 'Видаткова накладна', short: 'Накладна', icon: FileText, tone: 'slate', description: 'Складський документ по товарах без внутрішніх закупівель і постачальників.' },
  service_act: { title: 'Акт виконаних робіт', short: 'Акт робіт', icon: FileText, tone: 'violet', description: 'Роботи, використані товари, підсумок і підписи сторін.' },
  warranty: { title: 'Гарантійний талон', short: 'Гарантія', icon: ShieldCheck, tone: 'amber', description: 'Гарантійні умови, товари/роботи і підпис відповідальної особи.' },
  return_note: { title: 'Акт повернення товару', short: 'Повернення', icon: Undo2, tone: 'rose', description: 'Бланк повернення з позиціями, сумою і підписами.' },
};

const docOrder = ['receipt', 'invoice', 'waybill', 'service_act', 'warranty', 'return_note'];

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600',
  slate: 'bg-slate-50 text-slate-700 border-slate-200 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900',
  violet: 'bg-violet-50 text-violet-700 border-violet-100 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600',
  amber: 'bg-amber-50 text-amber-700 border-amber-100 group-hover:bg-amber-500 group-hover:text-slate-950 group-hover:border-amber-500',
  rose: 'bg-rose-50 text-rose-700 border-rose-100 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600',
};

const actionLabels = {
  document_viewed: 'Переглянуто',
  document_printed: 'Надруковано',
  document_downloaded: 'Скачано',
  document_sent: 'Надіслано',
  document_message_copied: 'Скопійовано текст',
};

function findContext() {
  const text = document.body?.innerText || '';
  const store = text.match(/Замовлення\s*№\s*(\d+)/i);
  if (store) return { id: store[1], mode: 'store', title: `Замовлення №${store[1]}` };
  const sto = text.match(/Візит\s*№\s*(\d+)/i) || text.match(/візит\s*№\s*(\d+)/i);
  if (sto) return { id: sto[1], mode: 'sto', title: `Візит №${sto[1]}` };
  return null;
}

function formatActivityDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

function canShareDocumentFile() {
  try {
    if (!window.isSecureContext || !navigator?.share || typeof File === 'undefined') return false;
    const file = new File(['Документ'], 'document.html', { type: 'text/html' });
    if (!navigator.canShare) return true;
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export default function DocumentDock() {
  const [ctx, setCtx] = useState(null);
  const [open, setOpen] = useState(false);
  const [visit, setVisit] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [embeddedTrigger, setEmbeddedTrigger] = useState(false);
  const [activeType, setActiveType] = useState('receipt');
  const [notice, setNotice] = useState('');
  const [sendType, setSendType] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shareAvailable, setShareAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);

  const loadDocumentHistory = async (id = visit?.id) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/activity/?visit=${id}&category=documents&limit=12`);
      setHistory(Array.isArray(response.data?.results) ? response.data.results : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const load = async (overrideCtx = null) => {
    const currentCtx = overrideCtx?.id ? overrideCtx : ctx;
    if (!currentCtx?.id) return;

    setCtx(currentCtx);
    setLoading(true);
    setNotice('');
    try {
      const [visitRes, settingsRes] = await Promise.all([
        api.get(`/api/visits/${currentCtx.id}/`),
        api.get('/api/settings/'),
      ]);
      setVisit(visitRes.data);
      setSettings(settingsRes.data);
      setActiveType(currentCtx.mode === 'store' ? 'receipt' : 'service_act');
      setOpen(true);
      setShareAvailable(canShareDocumentFile());
      await loadDocumentHistory(visitRes.data?.id || currentCtx.id);
    } catch {
      setNotice('Не вдалося підготувати документи. Оновіть сторінку і спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const update = () => {
      setCtx(findContext());
      setEmbeddedTrigger(Boolean(document.querySelector('[data-document-dock-anchor="true"]')));
      setShareAvailable(canShareDocumentFile());
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

  const docs = useMemo(() => docOrder, []);
  const previewHtml = useMemo(() => buildDocumentHtml(activeType, visit, settings), [activeType, visit, settings]);

  if (!ctx) return null;

  const getBackendHtml = async (type, { autoPrint = false, download = false } = {}) => {
    if (!visit?.id) throw new Error('Немає ID замовлення');
    const params = new URLSearchParams();
    if (autoPrint) params.set('print', '1');
    if (download) params.set('download', '1');
    const query = params.toString();
    const response = await api.get(`/api/documents/visits/${visit.id}/${type}/${query ? `?${query}` : ''}`, { responseType: 'text' });
    return response.data;
  };

  const recordDocumentEvent = async (type, action = 'sent', channel = '') => {
    if (!visit?.id) return;
    try {
      await api.post(`/api/documents/visits/${visit.id}/${type}/`, { action, channel });
      await loadDocumentHistory(visit.id);
    } catch {
      // Logging must never block document work.
    }
  };

  const openWindow = async (type, autoPrint = false) => {
    const popup = window.open('', '_blank');
    if (!popup) {
      setNotice('Браузер заблокував відкриття документа. Дозвольте спливаючі вікна для сайту.');
      return;
    }

    popup.document.open();
    popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Документ</title></head><body style="font-family:Arial,sans-serif;padding:32px;color:#0f172a"><b>Формуємо документ...</b></body></html>');
    popup.document.close();

    try {
      const html = await getBackendHtml(type, { autoPrint });
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      await loadDocumentHistory(visit.id);
    } catch {
      const html = buildDocumentHtml(type, visit, settings, { autoPrint });
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      await recordDocumentEvent(type, autoPrint ? 'printed' : 'viewed', 'fallback');
      setNotice('Backend-документ ще недоступний після деплою, відкрито локальний стабільний бланк.');
    }
  };

  const downloadDocument = async (type) => {
    try {
      const html = await getBackendHtml(type, { download: true });
      downloadBlob(html, `${fileSlug(docTypes[type]?.title || 'document')}-${visit?.id || 'new'}.html`);
      setNotice('Документ скачано. Його можна прикріпити в Telegram, Viber або надіслати клієнту іншим способом.');
      await loadDocumentHistory(visit.id);
    } catch {
      const html = buildDocumentHtml(type, visit, settings);
      downloadBlob(html, `${fileSlug(docTypes[type]?.title || 'document')}-${visit?.id || 'new'}.html`);
      await recordDocumentEvent(type, 'downloaded', 'fallback');
      setNotice('Документ скачано локальним бланком. Його можна прикріпити в Telegram або Viber.');
    }
  };

  const shareDocument = async (type) => {
    if (!visit?.id) return false;
    const meta = docTypes[type] || docTypes.receipt;
    const html = buildDocumentHtml(type, visit, settings);
    const file = new File([html], `${fileSlug(meta.title)}-${visit.id}.html`, { type: 'text/html' });
    const text = `Документ “${meta.title}” по замовленню №${visit.id}. Сума: ${money(documentTotals(type, visit).total)}.`;

    try {
      if (!canShareDocumentFile()) throw new Error('Share is not supported');
      setSharing(true);
      await navigator.share({ title: `${meta.title} №${visit.id}`, text, files: [file] });
      await recordDocumentEvent(type, 'sent', 'native_share');
      setNotice('Документ передано в системне меню “Поділитись”.');
      setSendType(null);
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setNotice('На цьому пристрої “Поділитись” недоступне. Скачайте документ і прикріпіть вручну.');
      }
      return false;
    } finally {
      setSharing(false);
      setShareAvailable(canShareDocumentFile());
    }
  };

  return <>
    {!embeddedTrigger && (
      <button onClick={() => load()} disabled={loading} className="fixed right-5 bottom-24 z-[60] md:right-8 md:bottom-8 bg-slate-900 hover:bg-blue-700 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2 font-black text-xs uppercase transition whitespace-nowrap disabled:opacity-60">
        <FileText size={17}/>{loading ? 'Готуємо...' : 'Документи'}
      </button>
    )}

    {notice && !open && <div className="fixed right-5 bottom-40 z-[70] max-w-sm rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-xl">{notice}</div>}

    {open && createPortal(
      <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="bg-white w-full md:max-w-7xl h-[100dvh] md:h-[92dvh] rounded-none md:rounded-[30px] shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 text-white p-4 md:p-5 flex justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Пакет документів</p>
              <h2 className="text-lg md:text-2xl font-black uppercase truncate">{ctx.title}</h2>
              <p className="text-[11px] md:text-xs font-bold text-blue-100 mt-1">Превʼю, друк, PDF-бланк, файл для клієнта і журнал дій.</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0"><X size={18}/></button>
          </div>

          {notice && <div className="mx-3 md:mx-5 mt-3 md:mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 flex items-center justify-between gap-3 shrink-0"><span>{notice}</span><button onClick={() => setNotice('')} className="text-blue-400 hover:text-blue-700"><X size={16}/></button></div>}

          <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-0 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden overscroll-contain">
            <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/80 p-3 md:p-5 lg:overflow-y-auto lg:min-h-0">
              <div className="mb-3 md:mb-4">
                <h3 className="text-sm font-black uppercase text-slate-900">Документи</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Оберіть тип документа і дію: перегляд, друк, PDF або файл для клієнта.</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {docs.map((type) => {
                  const meta = docTypes[type];
                  const Icon = meta.icon;
                  const active = activeType === type;
                  return (
                    <button key={type} onClick={() => setActiveType(type)} className={`group text-left rounded-2xl border p-3 transition ${active ? 'bg-white border-blue-300 shadow-sm ring-4 ring-blue-50' : 'bg-white/80 border-slate-200 hover:border-blue-200 hover:bg-blue-50/60'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl border flex items-center justify-center shrink-0 transition ${toneClasses[meta.tone] || toneClasses.blue}`}><Icon size={18}/></span>
                        <span className="min-w-0">
                          <span className="block font-black text-slate-900 uppercase text-sm leading-tight">{meta.title}</span>
                          <span className="block text-xs font-semibold text-slate-500 mt-1 leading-snug">{meta.description}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 md:mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Журнал</p>
                    <h4 className="text-sm font-black uppercase text-slate-900">Історія документів</h4>
                  </div>
                  <button type="button" onClick={() => loadDocumentHistory(visit?.id)} className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center"><History size={16}/></button>
                </div>
                {historyLoading ? (
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-400 flex items-center gap-2"><Clock3 size={14} className="animate-spin"/> Завантаження...</div>
                ) : history.length ? (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate">{actionLabels[item.action_type] || item.title || 'Документ'}</p>
                            <p className="text-[11px] font-semibold text-slate-500 truncate">{item.metadata?.document_title || item.description || 'Документ'}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-black text-slate-400">{formatActivityDate(item.created_at)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-700"><CheckCircle2 size={12}/> {item.actor || 'Система'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">Поки дій з документами немає</div>
                )}
              </div>
            </aside>

            <main className="min-h-[680px] lg:min-h-0 flex flex-col bg-slate-100/70">
              <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 md:px-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Превʼю документа</p>
                  <h3 className="text-base md:text-lg font-black uppercase text-slate-900 truncate">{docTypes[activeType]?.title}</h3>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <ActionButton onClick={() => openWindow(activeType, false)} icon={<Eye size={15}/>} label="Переглянути" />
                  <ActionButton onClick={() => openWindow(activeType, true)} icon={<Printer size={15}/>} label="Друк" />
                  <ActionButton onClick={() => downloadDocument(activeType)} icon={<Download size={15}/>} label="PDF" />
                  <ActionButton onClick={() => setSendType(activeType)} icon={shareAvailable ? <Share2 size={15}/> : <Download size={15}/>} label={shareAvailable ? 'Поділитись' : 'Скачати'} dark />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-visible lg:overflow-auto p-3 md:p-6">
                <div className="mx-auto w-full max-w-[860px] rounded-[20px] md:rounded-[24px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70 overflow-hidden">
                  <iframe title="document-preview" srcDoc={previewHtml} className="w-full h-[58dvh] sm:h-[66dvh] lg:h-[72vh] bg-white" />
                </div>
              </div>
            </main>
          </div>
        </div>

        {sendType && <DownloadDialog type={sendType} visit={visit} settings={settings} shareAvailable={shareAvailable} sharing={sharing} onClose={() => setSendType(null)} onShare={() => shareDocument(sendType)} onDownload={() => downloadDocument(sendType)} onCopy={async () => { await recordDocumentEvent(sendType, 'copied', 'copy'); setNotice('Текст скопійовано.'); }} />}
      </div>,
      document.body
    )}
  </>;
}

function ActionButton({ icon, label, onClick, dark = false }) {
  return <button type="button" onClick={onClick} className={`${dark ? 'bg-slate-900 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'} rounded-2xl px-3 py-2.5 text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition whitespace-nowrap`}>{icon}{label}</button>;
}

function DownloadDialog({ type, visit, settings, shareAvailable, sharing, onClose, onShare, onDownload, onCopy }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const meta = docTypes[type] || docTypes.receipt;
  const company = settings?.company || {};
  const text = `Добрий день, ${visit?.client || ''}. Надсилаємо документ “${meta.title}” по замовленню №${visit?.id || ''}. Компанія: ${company.name || ''}. Сума: ${money(documentTotals(type, visit).total)}.`;

  const handleDownload = async () => {
    await onDownload?.();
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1800);
  };

  const handleShare = async () => {
    const ok = await onShare?.();
    if (!ok) return;
    setDownloaded(false);
  };

  const handleCopy = async () => {
    setCopyError(false);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      await onCopy?.(text);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setCopyError(true);
    }
  };

  return <div className="absolute inset-0 z-[130] bg-slate-950/50 backdrop-blur-sm overflow-y-auto p-3 md:p-4 flex items-start md:items-center justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="my-4 md:my-0 bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden">
      <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white p-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Файл для клієнта</p>
          <h3 className="text-xl font-black uppercase mt-1">{meta.title}</h3>
          <p className="text-xs font-bold text-blue-100 mt-1">{shareAvailable ? 'Натисніть “Поділитись” і вручну оберіть Telegram, Viber або контакт.' : 'Скачайте документ і прикріпіть його в Telegram, Viber або іншому месенджері.'}</p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center"><X size={18}/></button>
      </div>
      <div className="p-5 space-y-3">
        {shareAvailable ? (
          <button type="button" onClick={handleShare} disabled={sharing} className="w-full rounded-2xl bg-slate-900 text-white px-4 py-4 text-xs font-black uppercase flex items-center justify-center gap-2 transition hover:bg-blue-700 disabled:opacity-60">
            <Share2 size={17}/> {sharing ? 'Відкриваємо...' : 'Поділитись документом'}
          </button>
        ) : (
          <button type="button" onClick={handleDownload} className={`w-full rounded-2xl px-4 py-4 text-xs font-black uppercase flex items-center justify-center gap-2 transition ${downloaded ? 'bg-emerald-600 text-white scale-[1.02]' : 'bg-slate-900 text-white hover:bg-blue-700'}`}>
            {downloaded ? <CheckCircle2 size={18}/> : <Download size={17}/>} {downloaded ? 'Документ скачано' : 'Скачати документ'}
          </button>
        )}
        {shareAvailable && (
          <button type="button" onClick={handleDownload} className={`w-full rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2 transition ${downloaded ? 'bg-emerald-50 text-emerald-700 ring-4 ring-emerald-100 scale-[1.02]' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
            {downloaded ? <CheckCircle2 size={16}/> : <Download size={16}/>} {downloaded ? 'Документ скачано' : 'Або скачати файл'}
          </button>
        )}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 leading-relaxed">{text}</div>
        <button type="button" onClick={handleCopy} className={`w-full rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2 transition ${copied ? 'bg-emerald-50 text-emerald-700 ring-4 ring-emerald-100 scale-[1.02]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          {copied ? <CheckCircle2 size={16}/> : <Copy size={16}/>} {copied ? 'Скопійовано' : 'Скопіювати текст'}
        </button>
        {copyError && <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">Не вдалося скопіювати автоматично. Виділіть текст вище і скопіюйте вручну.</div>}
        <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">{shareAvailable ? 'На HTTPS і сумісному телефоні відкриється системне меню телефона. На HTTP кнопка автоматично замінюється на скачування.' : 'Після скачування файл буде у завантаженнях браузера. Його можна прикріпити клієнту в Telegram, Viber або будь-якому іншому месенджері.'}</p>
      </div>
    </div>
  </div>;
}

function buildRows(type, visit) {
  const parts = arr(visit?.parts).map((part) => ({
    kind: 'Товар',
    article: [part.brand, part.article].filter(Boolean).join(' ') || '—',
    name: part.name || 'Товар',
    qty: part.quantity || 1,
    price: part.sell_price || part.price || 0,
    sum: Number(part.sell_price || part.price || 0) * Number(part.quantity || 1),
  }));
  const services = arr(visit?.services).map((service) => ({
    kind: 'Робота',
    article: 'Послуга',
    name: service.name || 'Робота',
    qty: service.quantity || 1,
    price: service.price || 0,
    sum: Number(service.price || 0) * Number(service.quantity || 1),
  }));

  if (type === 'waybill' || type === 'warranty' || type === 'return_note') return parts;
  if (type === 'service_act') return [...services, ...parts];
  return [...parts, ...services];
}

function documentTotals(type, visit) {
  const rows = buildRows(type, visit);
  const total = rows.reduce((sum, row) => sum + Number(row.sum || 0), 0);
  const paid = Number(visit?.paid_amount || visit?.prepayment_amount || 0);
  const debt = Math.max(total - paid, 0);
  return { rows, total, paid, debt };
}

function normalizeLogoUrl(logo) {
  if (!logo) return '';
  if (/^(https?:|data:|blob:)/i.test(logo)) return logo;
  if (logo.startsWith('/')) return `${window.location.origin}${logo}`;
  return logo;
}

function carLabel(visit) {
  let data = {};
  if (visit?.delivery_data && typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
    try { data = JSON.parse(visit.delivery_data); } catch { data = {}; }
  }
  return [data.brand, data.model, data.year].filter(Boolean).join(' ') || visit?.plate || '—';
}

function fileSlug(value) {
  return String(value || 'document').toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, '-').replace(/^-|-$/g, '');
}

function downloadBlob(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildDocumentHtml(type, visit, settings, options = {}) {
  const meta = docTypes[type] || docTypes.receipt;
  const company = settings?.company || {};
  const { rows, total, paid, debt } = documentTotals(type, visit);
  const logo = normalizeLogoUrl(company.logo);
  const date = new Date().toLocaleDateString('uk-UA');
  const requisites = company.document_requisites || '';
  const warrantyText = company.document_warranty_text || 'Гарантія діє за умови встановлення та використання товару згідно з рекомендаціями виробника. Повернення можливе згідно з чинним законодавством та умовами продавця.';
  const footer = company.document_footer || 'Дякуємо за довіру. Зберігайте цей документ до завершення гарантійного терміну.';
  const signature = company.document_signature || 'Підпис відповідальної особи';
  const isWarranty = type === 'warranty';
  const isReturn = type === 'return_note';
  const isInvoice = type === 'invoice';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.title)} №${esc(visit?.id || '')}</title><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;color:#0f172a;font-family:Inter,Arial,sans-serif}.sheet{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:15mm 16mm;position:relative}.top{display:flex;justify-content:space-between;gap:22px;border-bottom:3px solid #0f172a;padding-bottom:16px}.brand{display:flex;gap:14px;align-items:center;min-width:0}.logo{width:68px;height:68px;object-fit:contain;border:1px solid #e2e8f0;border-radius:18px;padding:6px}.company h1{margin:0;font-size:24px;line-height:1.05;font-weight:900;letter-spacing:-.03em}.muted{color:#64748b;font-size:12px;line-height:1.45}.req{text-align:right;max-width:82mm}.doc-head{margin:22px 0 18px;display:flex;justify-content:space-between;gap:18px;align-items:flex-end}.doc-title{font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:-.04em;margin:0}.pill{display:inline-flex;background:#eff6ff;color:#1d4ed8;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:900;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.box{border:1px solid #e2e8f0;border-radius:18px;padding:13px;background:#f8fafc;min-height:72px}.box b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:6px}.box p{margin:0;font-size:14px;font-weight:800;line-height:1.35}.section-title{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#334155;margin:20px 0 8px}table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}th{background:#0f172a;color:white;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px}td{border-bottom:1px solid #e2e8f0;padding:10px;font-size:12px;vertical-align:top}tr:last-child td{border-bottom:0}.num{text-align:right;white-space:nowrap}.kind{display:inline-flex;border-radius:999px;background:#f1f5f9;color:#475569;padding:4px 7px;font-size:10px;font-weight:900;text-transform:uppercase}.summary{margin-left:auto;margin-top:16px;width:300px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden}.summary div{display:flex;justify-content:space-between;gap:12px;padding:11px 13px;border-bottom:1px solid #e2e8f0;font-size:13px}.summary div:last-child{border-bottom:0}.summary .pay{background:#0f172a;color:white;font-weight:900}.summary .debt{color:#be123c;font-weight:900}.note{margin-top:18px;border:1px dashed #cbd5e1;border-radius:18px;padding:14px;color:#475569;font-size:12px;line-height:1.5;background:#f8fafc}.note b{display:block;color:#0f172a;text-transform:uppercase;font-size:11px;margin-bottom:6px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:46px}.line{border-top:1px solid #0f172a;padding-top:8px;color:#475569;font-size:11px}.footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;color:#64748b;font-size:11px;line-height:1.45}.no-print{position:sticky;top:0;z-index:5;background:#0f172a;color:white;padding:10px 14px;text-align:right}.no-print button{border:0;border-radius:12px;background:#2563eb;color:white;padding:10px 14px;font-weight:900;text-transform:uppercase;font-size:11px}@media print{body{background:white}.sheet{width:auto;min-height:auto;margin:0;padding:0}.no-print{display:none}.box,.note,tr{break-inside:avoid;page-break-inside:avoid}}
  </style></head><body>${options.autoPrint ? '' : '<div class="no-print"><button onclick="window.print()">Друк / зберегти PDF</button></div>'}<main class="sheet">
    <header class="top"><div class="brand">${logo ? `<img class="logo" src="${esc(logo)}" alt="logo">` : ''}<div class="company"><h1>${esc(company.name || 'VIN-matrix')}</h1><div class="muted">${esc(company.address || '')}</div><div class="muted">${esc(company.phone || '')}</div></div></div><div class="muted req"><b>${esc(date)}</b><br>${nl2br(requisites)}</div></header>
    <section class="doc-head"><div><h2 class="doc-title">${esc(meta.title)}</h2><span class="pill">№${esc(visit?.id || '—')} · ${esc(visit?.status || '')}</span></div><div class="muted" style="text-align:right">${isInvoice ? 'Призначення платежу:<br>' : ''}${isInvoice ? `Оплата за замовлення №${esc(visit?.id || '')}` : ''}</div></section>
    <section class="grid"><div class="box"><b>Клієнт</b><p>${esc(visit?.client || '—')}</p><div class="muted">${esc(visit?.phone || '')}</div></div><div class="box"><b>Авто / VIN</b><p>${esc(carLabel(visit))}</p><div class="muted">${esc(visit?.plate || '')}${visit?.vin_code ? ` · VIN: ${esc(visit.vin_code)}` : ''}</div></div></section>
    <div class="section-title">Позиції документа</div>
    <table><thead><tr><th>Тип</th><th>Артикул</th><th>Назва</th><th class="num">К-сть</th><th class="num">Ціна</th><th class="num">Сума</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="kind">${esc(row.kind)}</span></td><td>${esc(row.article || '—')}</td><td>${esc(row.name || '—')}</td><td class="num">${qty(row.qty)}</td><td class="num">${money(row.price)}</td><td class="num">${money(row.sum)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:18px">Позицій немає</td></tr>'}</tbody></table>
    <section class="summary"><div><span>Разом</span><b>${money(total)}</b></div><div><span>Оплачено</span><b>${money(paid)}</b></div><div><span>Борг</span><b class="debt">${money(debt)}</b></div><div class="pay"><span>До сплати</span><b>${money(Math.max(debt, 0))}</b></div></section>
    ${isWarranty ? `<section class="note"><b>Умови гарантії</b>${nl2br(warrantyText)}</section>` : ''}
    ${isReturn ? '<section class="note"><b>Повернення товару</b>Товар прийнято до повернення після перевірки стану, комплектності та відповідності умовам повернення. Остаточне рішення приймається відповідальною особою компанії.</section>' : ''}
    ${!isWarranty && !isReturn ? `<section class="note"><b>Примітка</b>${nl2br(footer)}</section>` : ''}
    <section class="sign"><div class="line">${esc(signature)}</div><div class="line">Підпис клієнта</div></section>
    <footer class="footer">${nl2br(footer)}<br>Документ сформовано у VIN-matrix · ${esc(company.name || '')}</footer>
  </main>${options.autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),250);</script>' : ''}</body></html>`;
}
