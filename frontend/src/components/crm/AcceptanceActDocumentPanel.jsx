import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileSignature, Printer, Save, Share2, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';

const HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
let html2pdfPromise = null;

function ensureHtml2Pdf() {
  if (typeof window === 'undefined') return Promise.reject(new Error('PDF unavailable'));
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (html2pdfPromise) return html2pdfPromise;

  html2pdfPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-vinmatrix-html2pdf="true"]');
    if (existing) {
      existing.addEventListener('load', () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error('PDF library unavailable')), { once: true });
      existing.addEventListener('error', () => reject(new Error('PDF library unavailable')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = HTML2PDF_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.vinmatrixHtml2pdf = 'true';
    script.onload = () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error('PDF library unavailable'));
    script.onerror = () => reject(new Error('PDF library unavailable'));
    document.head.appendChild(script);
  }).catch((error) => {
    html2pdfPromise = null;
    throw error;
  });

  return html2pdfPromise;
}

function waitForIframeReady(iframe, html) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Document render timeout')), 15000);
    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('Document unavailable');
        doc.querySelector('.toolbar')?.remove();
        if (doc.fonts?.ready) await doc.fonts.ready.catch(() => {});
        const images = Array.from(doc.images || []);
        await Promise.all(images.map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise((done) => {
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
          });
        }));
        window.clearTimeout(timeout);
        resolve(doc);
      } catch (error) {
        window.clearTimeout(timeout);
        reject(error);
      }
    };
    iframe.srcdoc = html;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function AcceptanceActDocumentPanel({
  visitId,
  locked = false,
  hasAct = false,
  termsText = '',
  onTermsChange,
}) {
  const [terms, setTerms] = useState(termsText || '');
  const [savedTerms, setSavedTerms] = useState(termsText || '');
  const [defaultTerms, setDefaultTerms] = useState('');
  const [usesDefault, setUsesDefault] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [serverHasAct, setServerHasAct] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfAction, setPdfAction] = useState('');
  const [notice, setNotice] = useState('');

  const dirty = terms !== savedTerms;
  const effectiveLocked = Boolean(locked);
  const effectiveHasAct = Boolean(hasAct || serverHasAct);
  const pdfFilename = `Akt-pryimannia-${visitId || 'auto'}.pdf`;

  const changeTerms = (value) => {
    setTerms(value);
    onTermsChange?.(value);
  };

  useEffect(() => {
    if (!visitId) return undefined;
    let cancelled = false;
    setLoading(true);
    setNotice('');
    api.get(`/api/visit-acceptance-act/terms/?visit=${visitId}`)
      .then((response) => {
        if (cancelled) return;
        const data = response.data || {};
        const value = data.terms_text || termsText || '';
        setTerms(value);
        setSavedTerms(value);
        onTermsChange?.(value);
        setDefaultTerms(data.default_terms || '');
        setUsesDefault(Boolean(data.uses_default));
        setCanEdit(Boolean(data.can_edit));
        setServerHasAct(Boolean(data.has_act));
      })
      .catch(() => {
        if (!cancelled) setNotice('Не вдалося завантажити текст для друкованого акта.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visitId, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (termsText === terms) return;
    setTerms(termsText || '');
  }, [termsText]); // eslint-disable-line react-hooks/exhaustive-deps

  const helperText = useMemo(() => {
    if (effectiveLocked) return 'Текст уже входить у зафіксовану версію акта і не змінюється заднім числом.';
    if (!canEdit) return 'Змінювати стандартні умови може власник СТО.';
    if (usesDefault && !dirty) return 'Зараз використовується стандартний текст СТО. Його можна змінити для цього акта.';
    return 'Напишіть власні умови або примітку. VIN Matrix не додає юридичний текст автоматично.';
  }, [effectiveLocked, canEdit, usesDefault, dirty]);

  const saveTerms = async ({ silent = false } = {}) => {
    if (!visitId || !canEdit || effectiveLocked || saving) return true;
    setSaving(true);
    setNotice('');
    try {
      const response = await api.patch('/api/visit-acceptance-act/terms/', {
        visit: visitId,
        terms_text: terms,
        save_as_default: saveAsDefault,
      });
      const persisted = response.data?.terms_text ?? terms;
      setSavedTerms(persisted);
      setTerms(persisted);
      onTermsChange?.(persisted);
      setServerHasAct(Boolean(response.data?.has_act ?? true));
      setUsesDefault(false);
      if (saveAsDefault) {
        setDefaultTerms(persisted);
        setSaveAsDefault(false);
      }
      if (!silent) setNotice(saveAsDefault ? 'Текст збережено і встановлено стандартним для наступних актів.' : 'Текст акта збережено.');
      return true;
    } catch (error) {
      setNotice(error?.response?.data?.detail || 'Не вдалося зберегти текст акта.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const prepareDocument = async () => {
    if (!visitId || !effectiveHasAct) {
      setNotice('Спочатку збережіть чернетку акта приймання, щоб сформувати документ.');
      return null;
    }
    if (dirty && canEdit && !effectiveLocked) {
      const ok = await saveTerms({ silent: true });
      if (!ok) return null;
    }
    const response = await api.get(`/api/visit-acceptance-act/document/${visitId}/`, { responseType: 'text' });
    return response.data;
  };

  const openDocument = async (autoPrint = false) => {
    if (!visitId || !effectiveHasAct) {
      setNotice('Спочатку збережіть чернетку акта приймання, щоб сформувати документ.');
      return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      setNotice('Браузер заблокував відкриття документа. Дозвольте спливаючі вікна для VIN Matrix.');
      return;
    }
    popup.document.open();
    popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Акт приймання</title></head><body style="font-family:Arial,sans-serif;padding:32px;color:#0f172a"><b>Формуємо акт приймання...</b></body></html>');
    popup.document.close();

    try {
      if (dirty && canEdit && !effectiveLocked) {
        const ok = await saveTerms({ silent: true });
        if (!ok) {
          popup.close();
          return;
        }
      }
      const suffix = autoPrint ? '?print=1' : '';
      const response = await api.get(`/api/visit-acceptance-act/document/${visitId}/${suffix}`, { responseType: 'text' });
      popup.document.open();
      popup.document.write(response.data);
      popup.document.close();
    } catch (error) {
      popup.close();
      setNotice(error?.response?.data?.detail || 'Не вдалося сформувати акт приймання.');
    }
  };

  const createPdfBlob = async () => {
    const html = await prepareDocument();
    if (!html) return null;
    await ensureHtml2Pdf();

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-12000px',
      top: '0',
      width: '794px',
      height: '1123px',
      border: '0',
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    document.body.appendChild(iframe);

    try {
      const doc = await waitForIframeReady(iframe, html);
      const target = doc.querySelector('.sheet') || doc.body;
      const worker = window.html2pdf().set({
        margin: 0,
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(target.scrollWidth || 794, 794),
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(target).toPdf();
      return await worker.outputPdf('blob');
    } finally {
      iframe.remove();
    }
  };

  const downloadPdf = async () => {
    if (pdfAction) return;
    setPdfAction('download');
    setNotice('Формуємо PDF...');
    try {
      const blob = await createPdfBlob();
      if (!blob) return;
      downloadBlob(blob, pdfFilename);
      setNotice('PDF готовий і завантажений на пристрій.');
    } catch {
      setNotice('Не вдалося створити PDF. Перевірте інтернет і спробуйте ще раз.');
    } finally {
      setPdfAction('');
    }
  };

  const sharePdf = async () => {
    if (pdfAction) return;
    setPdfAction('share');
    setNotice('Готуємо PDF для відправлення...');
    try {
      const blob = await createPdfBlob();
      if (!blob) return;
      const file = new File([blob], pdfFilename, { type: 'application/pdf' });
      const canShareFile = Boolean(navigator.share) && (!navigator.canShare || navigator.canShare({ files: [file] }));
      if (canShareFile) {
        await navigator.share({
          title: `Акт приймання №${visitId}`,
          text: 'Акт приймання автомобіля',
          files: [file],
        });
        setNotice('PDF передано в меню «Поділитися».');
      } else {
        downloadBlob(blob, pdfFilename);
        setNotice('На цьому пристрої відправлення файлів не підтримується, тому PDF завантажено.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice('Не вдалося підготувати PDF для відправлення. Спробуйте ще раз.');
    } finally {
      setPdfAction('');
    }
  };

  return (
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-700"><FileSignature size={19}/><p className="text-xs font-black uppercase tracking-wider">Друкований акт приймання</p></div>
          <h4 className="mt-1 text-base font-black text-slate-900">Готовий документ для клієнта і СТО</h4>
          <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-slate-500">Дані про авто, пробіг, паливо, стан, скаргу та фото підтягуються автоматично з Акта вище — повторно нічого вводити не потрібно.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${effectiveHasAct ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{effectiveHasAct ? 'Можна формувати' : 'Збережіть чернетку'}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Умови / примітка СТО в кінці акта</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{helperText}</p>
          </div>
          {effectiveLocked && <ShieldCheck size={20} className="shrink-0 text-emerald-600"/>}
        </div>

        {loading ? <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100"/> : (
          <textarea
            rows={5}
            disabled={effectiveLocked || !canEdit}
            value={terms}
            onChange={(event) => changeTerms(event.target.value)}
            placeholder="Власник СТО може додати тут власні умови, застереження або іншу примітку для друкованого акта."
            className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold leading-relaxed text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
          />
        )}

        {!effectiveLocked && canEdit && (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} className="h-4 w-4 rounded border-slate-300"/>
              Використовувати цей текст як стандарт для наступних актів
            </label>
            <button type="button" onClick={() => saveTerms()} disabled={saving || (!dirty && !saveAsDefault)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={14}/>{saving ? 'Зберігаю...' : 'Зберегти текст'}</button>
          </div>
        )}
        {!terms && defaultTerms && !canEdit && <p className="mt-2 text-[11px] font-semibold text-slate-400">Для цього СТО налаштовано стандартний текст акта.</p>}
      </div>

      {notice && <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">{notice}</div>}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => openDocument(false)} disabled={!effectiveHasAct || Boolean(pdfAction)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-black uppercase text-blue-700 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Eye size={16}/>Переглянути</button>
        <button type="button" onClick={() => openDocument(true)} disabled={!effectiveHasAct || Boolean(pdfAction)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Printer size={16}/>Друк</button>
        <button type="button" onClick={downloadPdf} disabled={!effectiveHasAct || Boolean(pdfAction)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white shadow-md shadow-blue-100 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Download size={16}/>{pdfAction === 'download' ? 'Формуємо...' : 'Завантажити PDF'}</button>
        <button type="button" onClick={sharePdf} disabled={!effectiveHasAct || Boolean(pdfAction)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Share2 size={16}/>{pdfAction === 'share' ? 'Готуємо...' : 'Поділитися PDF'}</button>
      </div>
      <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">PDF формується локально у браузері з цього акта. На телефоні «Поділитися PDF» відкриває системне меню, де можна обрати Telegram, Viber, WhatsApp, пошту або інший застосунок.</p>
    </section>
  );
}
