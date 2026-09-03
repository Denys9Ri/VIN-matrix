import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, ClipboardCheck, FilePenLine, FileText, Gauge, LockKeyhole, Save } from 'lucide-react';
import api from '../../api/axios';
import { AcceptancePhotoPicker } from './AcceptancePhotos';
import AcceptanceActDocumentPanel from './AcceptanceActDocumentPanel';

const fuelOptions = ['Порожній', '1/4', '1/2', '3/4', 'Повний'];

const statusClass = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  attention: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-rose-50 text-rose-700 border-rose-100',
  not_checked: 'bg-slate-100 text-slate-500 border-slate-200',
};

const diagnosticItems = [
  ['engine', 'Двигун'],
  ['brakes', 'Гальма'],
  ['suspension', 'Ходова'],
  ['fluids', 'Рідини'],
  ['tires', 'Шини'],
  ['lights', 'Світло'],
  ['battery', 'АКБ'],
  ['computer', 'Помилки/компʼютер'],
];

const statusOptions = [
  ['ok', 'ОК'],
  ['attention', 'Увага'],
  ['critical', 'Критично'],
  ['not_checked', 'Не перевірено'],
];

const defaultChecklist = diagnosticItems.reduce(
  (acc, [key]) => ({
    ...acc,
    [key]: { status: 'not_checked', note: '' },
  }),
  {}
);

const defaultAcceptance = {
  id: null,
  mileage: '',
  fuel_level: '1/2',
  exterior_note: '',
  interior_note: '',
  damages: '',
  customer_complaint: '',
  note: '',
  terms_text: '',
  status: 'draft',
  locked: false,
  can_correct: false,
  revision_count: 0,
};

const getVisitId = (visit) => visit?.id ?? visit?.visit_id ?? visit?.pk ?? null;

const parseMileage = (visit) => {
  if (!visit) return '';
  if (visit.mileage || visit.odometer || visit.run || visit.car_mileage) return visit.mileage || visit.odometer || visit.run || visit.car_mileage;
  if (typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(visit.delivery_data);
      return parsed.mileage || parsed.probig || '';
    } catch {
      return '';
    }
  }
  return '';
};

export default function VisitWorkflowPanel({
  selectedGroup,
  lastVisit,
  initialActive = 'acceptance',
  standalone = false,
  onDiagnosticSaved,
}) {
  const visitId = getVisitId(lastVisit);
  const [active, setActive] = useState(initialActive || 'acceptance');
  const [acceptance, setAcceptance] = useState(defaultAcceptance);
  const [diagnostic, setDiagnostic] = useState({ checklist: defaultChecklist, summary: '', status: 'draft' });
  const [loading, setLoading] = useState(false);
  const [savingAcceptance, setSavingAcceptance] = useState(false);
  const [savingDiagnostic, setSavingDiagnostic] = useState(false);
  const [reopeningAcceptance, setReopeningAcceptance] = useState(false);
  const [diagnosticSyncInfo, setDiagnosticSyncInfo] = useState(null);

  const tabs = useMemo(() => [
    ['acceptance', 'Акт приймання', FileText],
    ['diagnostic', 'Діагностика', ClipboardCheck],
  ], []);

  const acceptanceLocked = acceptance.status === 'completed' || Boolean(acceptance.locked);

  useEffect(() => {
    setActive(initialActive || 'acceptance');
  }, [initialActive, visitId]);

  const loadData = async () => {
    if (!visitId) return;
    setLoading(true);
    setDiagnosticSyncInfo(null);
    try {
      const [acceptanceResponse, diagnosticResponse] = await Promise.all([
        api.get(`/api/visit-acceptance-act/?visit=${visitId}`).catch(() => ({ data: {} })),
        api.get(`/api/visit-diagnostic-checklist/?visit=${visitId}`).catch(() => ({ data: {} })),
      ]);
      const savedAcceptance = acceptanceResponse.data || {};
      const savedDiagnostic = diagnosticResponse.data || {};
      setAcceptance({
        ...defaultAcceptance,
        id: savedAcceptance.id || null,
        mileage: savedAcceptance.mileage || parseMileage(lastVisit) || '',
        fuel_level: savedAcceptance.fuel_level || '1/2',
        exterior_note: savedAcceptance.exterior_note || '',
        interior_note: savedAcceptance.interior_note || '',
        damages: savedAcceptance.damages || '',
        customer_complaint: savedAcceptance.customer_complaint || '',
        note: savedAcceptance.note || '',
        terms_text: savedAcceptance.terms_text || '',
        status: savedAcceptance.status || 'draft',
        locked: Boolean(savedAcceptance.locked),
        can_correct: Boolean(savedAcceptance.can_correct),
        revision_count: Number(savedAcceptance.revision_count || 0),
      });
      setDiagnostic({
        checklist: { ...defaultChecklist, ...(savedDiagnostic.checklist || {}) },
        summary: savedDiagnostic.summary || '',
        status: savedDiagnostic.status || 'draft',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAcceptance = async (event, finalStatus = 'draft') => {
    event?.preventDefault();
    if (!visitId || savingAcceptance || acceptanceLocked) return;

    if (finalStatus === 'completed') {
      const confirmed = window.confirm(
        'Зафіксувати акт як доказ стану авто? Після цього оригінал і поточні фото не можна буде тихо переписати або видалити. За потреби власник зможе створити окреме коригування з історією.'
      );
      if (!confirmed) return;
    }

    setSavingAcceptance(true);
    try {
      const response = await api.post('/api/visit-acceptance-act/', {
        visit: visitId,
        client: selectedGroup?.client || lastVisit?.client || '',
        phone: selectedGroup?.phone || lastVisit?.phone || '',
        plate: selectedGroup?.plate || lastVisit?.plate || '',
        ...acceptance,
        status: finalStatus,
      });
      setAcceptance((prev) => ({
        ...prev,
        ...(response.data || {}),
        status: response.data?.status || finalStatus,
        locked: Boolean(response.data?.locked || finalStatus === 'completed'),
        can_correct: Boolean(response.data?.can_correct),
        revision_count: Number(response.data?.revision_count || prev.revision_count || 0),
      }));
    } catch (error) {
      alert(error?.response?.data?.detail || 'Не вдалося зберегти акт приймання.');
    } finally {
      setSavingAcceptance(false);
    }
  };

  const reopenAcceptance = async () => {
    if (!visitId || !acceptance.can_correct || reopeningAcceptance) return;
    const reason = window.prompt('Вкажіть причину коригування акта (наприклад: помилково не внесли подряпину):');
    if (reason === null) return;
    if (reason.trim().length < 3) {
      alert('Вкажіть коротку причину коригування.');
      return;
    }
    setReopeningAcceptance(true);
    try {
      const response = await api.post('/api/visit-acceptance-act/reopen/', { visit: visitId, reason: reason.trim() });
      setAcceptance((prev) => ({
        ...prev,
        ...(response.data || {}),
        status: 'draft',
        locked: false,
        can_correct: false,
        revision_count: Number(response.data?.revision_count || prev.revision_count || 0),
      }));
      await loadData();
    } catch (error) {
      alert(error?.response?.data?.detail || 'Не вдалося відкрити коригування акта.');
    } finally {
      setReopeningAcceptance(false);
    }
  };

  const saveDiagnostic = async (event, finalStatus = diagnostic.status) => {
    event?.preventDefault();
    if (!visitId || savingDiagnostic) return;
    setSavingDiagnostic(true);
    try {
      const response = await api.post('/api/visit-diagnostic-checklist/', {
        visit: visitId,
        client: selectedGroup?.client || lastVisit?.client || '',
        phone: selectedGroup?.phone || lastVisit?.phone || '',
        plate: selectedGroup?.plate || lastVisit?.plate || '',
        checklist: diagnostic.checklist,
        summary: diagnostic.summary,
        status: finalStatus,
      });
      setDiagnostic((prev) => ({
        ...prev,
        ...(response.data || {}),
        checklist: response.data?.checklist || prev.checklist,
        status: response.data?.status || finalStatus,
      }));
      setDiagnosticSyncInfo(response.data?.recommendation_sync || {});
      onDiagnosticSaved?.(response.data || {});
    } catch {
      alert('Не вдалося зберегти діагностику.');
    } finally {
      setSavingDiagnostic(false);
    }
  };

  const updateDiagnosticItem = (key, field, value) => {
    setDiagnostic((prev) => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [key]: { ...(prev.checklist?.[key] || {}), [field]: value },
      },
    }));
  };

  if (!visitId) {
    return <div className="bg-white rounded-3xl border border-slate-200 p-5 text-sm font-bold text-slate-400 text-center">Спочатку потрібен візит. Акт і діагностика привʼязуються саме до ID візиту.</div>;
  }

  return (
    <div className="bg-white rounded-3xl sm:rounded-2xl border border-slate-200 p-5 sm:p-4 shadow-sm min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base sm:text-sm font-black text-slate-800 flex items-center gap-2"><ClipboardCheck size={18} className="text-blue-600" />Акт і діагностика</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">Привʼязано до візиту №{visitId}</p>
        </div>
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{loading ? 'Завантаження...' : acceptanceLocked && active === 'acceptance' ? 'Зафіксовано' : 'Готово'}</span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 mb-4"><div className="flex gap-2 min-w-max pb-1">{tabs.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setActive(key)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase border whitespace-nowrap transition-all ${active === key ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}><Icon size={15}/>{label}</button>)}</div></div>

      {active === 'acceptance' && (
        <form onSubmit={(event) => saveAcceptance(event, 'draft')} className="space-y-3">
          {acceptanceLocked && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <LockKeyhole size={20} className="mt-0.5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-emerald-900">Акт зафіксовано як доказ стану авто</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-800">Оригінальна версія та її фото захищені від тихого переписування. Коригувань в історії: {acceptance.revision_count || 0}.</p>
                  {acceptance.can_correct && <button type="button" disabled={reopeningAcceptance} onClick={reopenAcceptance} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black uppercase text-emerald-800 shadow-sm disabled:opacity-50"><FilePenLine size={15}/>{reopeningAcceptance ? 'Відкриваю...' : 'Внести коригування'}</button>}
                </div>
              </div>
            </div>
          )}

          {!acceptanceLocked && acceptance.revision_count > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Відкрито коригування акта. Попередня зафіксована версія та її фото збережені в історії. Коригувань: {acceptance.revision_count}.</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SmallInfo icon={<CarFront size={15}/>} label="Авто" value={`${selectedGroup?.plate || lastVisit?.plate || '—'} · ${selectedGroup?.car || ''}`} />
            <SmallInfo icon={<Gauge size={15}/>} label="Пробіг" value={acceptance.mileage ? `${Number(acceptance.mileage).toLocaleString('uk-UA')} км` : '—'} />
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0">
              <label className="text-[10px] font-black uppercase text-slate-400">Пробіг</label>
              <input type="number" disabled={acceptanceLocked} value={acceptance.mileage} onChange={(event) => setAcceptance({ ...acceptance, mileage: event.target.value })} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0">
              <label className="text-[10px] font-black uppercase text-slate-400">Паливо</label>
              <select disabled={acceptanceLocked} value={acceptance.fuel_level} onChange={(event) => setAcceptance({ ...acceptance, fuel_level: event.target.value })} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500">{fuelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TextArea disabled={acceptanceLocked} label="Скарга клієнта" value={acceptance.customer_complaint} onChange={(value) => setAcceptance({ ...acceptance, customer_complaint: value })} placeholder="Що турбує клієнта: шум, стук, не заводиться..." />
            <TextArea disabled={acceptanceLocked} label="Пошкодження кузова" value={acceptance.damages} onChange={(value) => setAcceptance({ ...acceptance, damages: value })} placeholder="Подряпини, вмʼятини, сколи, стан ЛФП"><AcceptancePhotoPicker visitId={visitId} category="damages" title="пошкодження кузова" completed={acceptanceLocked} /></TextArea>
            <TextArea disabled={acceptanceLocked} label="Салон / речі в авто" value={acceptance.interior_note} onChange={(value) => setAcceptance({ ...acceptance, interior_note: value })} placeholder="Документи, ключі, килимки, особисті речі"><AcceptancePhotoPicker visitId={visitId} category="interior" title="салон / речі" completed={acceptanceLocked} /></TextArea>
            <TextArea disabled={acceptanceLocked} label="Зовнішній стан / примітка" value={acceptance.exterior_note} onChange={(value) => setAcceptance({ ...acceptance, exterior_note: value })} placeholder="Стан авто при прийманні"><AcceptancePhotoPicker visitId={visitId} category="exterior" title="зовнішній стан" completed={acceptanceLocked} /></TextArea>
          </div>

          <TextArea disabled={acceptanceLocked} label="Загальна примітка" value={acceptance.note} onChange={(value) => setAcceptance({ ...acceptance, note: value })} placeholder="Що важливо не забути" rows={2} />

          <AcceptanceActDocumentPanel
            visitId={visitId}
            locked={acceptanceLocked}
            hasAct={Boolean(acceptance.id)}
            termsText={acceptance.terms_text}
            onTermsChange={(termsText) => setAcceptance((prev) => ({ ...prev, terms_text: termsText }))}
          />

          {!acceptanceLocked && <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <button type="submit" disabled={savingAcceptance} className="bg-slate-900 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"><Save size={15}/>{savingAcceptance ? 'Зберігаю...' : 'Зберегти чернетку'}</button>
            <button type="button" onClick={(event) => saveAcceptance(event, 'completed')} disabled={savingAcceptance} className="bg-emerald-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"><CheckCircle2 size={15}/>Зафіксувати акт</button>
          </div>}
        </form>
      )}

      {active === 'diagnostic' && (
        <form onSubmit={(event) => saveDiagnostic(event)} className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {diagnosticItems.map(([key, label]) => {
              const item = diagnostic.checklist?.[key] || { status: 'not_checked', note: '' };
              return <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2"><p className="text-sm font-black text-slate-800">{label}</p><select value={item.status || 'not_checked'} onChange={(event) => updateDiagnosticItem(key, 'status', event.target.value)} className={`border rounded-xl px-3 py-2 text-xs font-black uppercase outline-none ${statusClass[item.status] || statusClass.not_checked}`}>{statusOptions.map(([value, optionText]) => <option key={value} value={value}>{optionText}</option>)}</select></div><input value={item.note || ''} onChange={(event) => updateDiagnosticItem(key, 'note', event.target.value)} placeholder="Коментар майстра" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" /></div>;
            })}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex gap-2 text-sm text-blue-800"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><div><p className="font-black">«Увага» та «Критично» автоматично потрапляють у рекомендації після збереження.</p><p className="mt-1 text-xs font-semibold text-blue-700">Нічого переносити вручну не потрібно — далі можна відредагувати рекомендацію або одразу записати клієнта на наступний візит.</p>{diagnosticSyncInfo && Number(diagnosticSyncInfo.created || 0) > 0 && <p className="mt-2 inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">Створено рекомендацій: {diagnosticSyncInfo.created}</p>}</div></div>

          <TextArea label="Висновок діагностики" value={diagnostic.summary} onChange={(value) => setDiagnostic({ ...diagnostic, summary: value })} placeholder="Коротко: що перевірено, що треба зробити, що критично" rows={3} />
          <div className="flex flex-col sm:flex-row gap-2 justify-end"><button type="submit" disabled={savingDiagnostic} className="bg-slate-900 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"><Save size={15}/>{savingDiagnostic ? 'Зберігаю...' : 'Зберегти чернетку'}</button><button type="button" onClick={(event) => saveDiagnostic(event, 'completed')} disabled={savingDiagnostic} className="bg-emerald-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"><CheckCircle2 size={15}/>Діагностика готова</button></div>
        </form>
      )}
    </div>
  );
}

function SmallInfo({ icon, label, value }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">{icon}{label}</p><p className="text-sm font-black text-slate-800 mt-1 break-words">{value}</p></div>;
}

function TextArea({ label, value, onChange, placeholder, rows = 3, children, disabled = false }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0"><label className="text-[10px] font-black uppercase text-slate-400">{label}</label><textarea disabled={disabled} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 resize-none disabled:bg-slate-100 disabled:text-slate-500" />{children}</div>;
}