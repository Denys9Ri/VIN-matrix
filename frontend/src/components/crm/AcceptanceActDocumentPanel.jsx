import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileSignature, Printer, Save, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';

export default function AcceptanceActDocumentPanel({ visitId, locked = false, hasAct = false }) {
  const [terms, setTerms] = useState('');
  const [savedTerms, setSavedTerms] = useState('');
  const [defaultTerms, setDefaultTerms] = useState('');
  const [usesDefault, setUsesDefault] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [serverHasAct, setServerHasAct] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const dirty = terms !== savedTerms;
  const effectiveLocked = Boolean(locked);
  const effectiveHasAct = Boolean(hasAct || serverHasAct);

  useEffect(() => {
    if (!visitId) return undefined;
    let cancelled = false;
    setLoading(true);
    setNotice('');
    api.get(`/api/visit-acceptance-act/terms/?visit=${visitId}`)
      .then((response) => {
        if (cancelled) return;
        const data = response.data || {};
        const value = data.terms_text || '';
        setTerms(value);
        setSavedTerms(value);
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
  }, [visitId, locked]);

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
      setSavedTerms(response.data?.terms_text ?? terms);
      setServerHasAct(Boolean(response.data?.has_act ?? true));
      setUsesDefault(false);
      if (saveAsDefault) {
        setDefaultTerms(terms);
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

    if (dirty && canEdit && !effectiveLocked) {
      const ok = await saveTerms({ silent: true });
      if (!ok) {
        popup.close();
        return;
      }
    }

    try {
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
            onChange={(event) => setTerms(event.target.value)}
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

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => openDocument(false)} disabled={!effectiveHasAct} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-black uppercase text-blue-700 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Eye size={16}/>Переглянути акт</button>
        <button type="button" onClick={() => openDocument(true)} disabled={!effectiveHasAct} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white shadow-md shadow-blue-100 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Printer size={16}/>Друк / PDF</button>
      </div>
    </section>
  );
}
