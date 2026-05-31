import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Calculator, Camera, CarFront, CheckCircle2, ClipboardCheck, ClipboardList, Clock, FileText, Hash, Info, Loader2, MessageSquare, Package, Plus, Printer, ScanLine, Search, Store, Trash2, Truck, Wrench, X } from 'lucide-react';
import VisitCard from '../components/visits/VisitCard';
import VisitWorkflowPanel from '../components/crm/VisitWorkflowPanel';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
const emptyCarData = { brand: '', model: '', year: '', engine: '', fuel: '', mileage: '', engine_volume: '', engine_power: '', engine_code: '', engine_review_status: 'manual' };
const arr = (v) => (Array.isArray(v) ? v : []);
const visitId = (v) => v?.id ?? v?.visit_id ?? v?.pk ?? '';
const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const servicesOf = (v) => arr(v?.services || v?.orderservice_set);
const partsOf = (v) => arr(v?.parts || v?.items);
const servicesTotal = (v) => servicesOf(v).reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 1), 0);
const partsTotal = (v) => partsOf(v).reduce((s, x) => s + Number(x.sell_price || x.price || 0) * Number(x.quantity || 1), 0);
const totalOf = (v) => servicesTotal(v) + partsTotal(v);

const readCarData = (visit) => {
  if (!visit?.delivery_data || typeof visit.delivery_data !== 'string' || !visit.delivery_data.trim().startsWith('{')) return { ...emptyCarData };
  try { return { ...emptyCarData, ...JSON.parse(visit.delivery_data) }; } catch { return { ...emptyCarData }; }
};

const cleanScan = (data = {}) => ({
  plate: data.plate || '',
  vin_code: data.vin_code || data.vin || '',
  vin_candidate: data.vin_candidate || '',
  brand: data.brand || '',
  model: data.model || '',
  year: data.year || '',
  engine: data.engine || data.engine_volume || data.volume || '',
  engine_volume: data.engine_volume || data.volume || data.engine || '',
  engine_power: data.engine_power || data.power || data.kw || '',
  engine_code: data.engine_code || data.engine_number || data.motor_code || '',
  fuel: data.fuel || '',
  document_side: data.document_side || 'unknown',
  warnings: data.warnings || [],
  engine_review_status: data.engine_review_status || 'needs_review',
});

const mergeScanInto = (base = {}, scan = {}) => {
  const s = cleanScan(scan);
  return {
    ...base,
    plate: s.plate || base.plate || '',
    vin_code: s.vin_code || base.vin_code || '',
    brand: s.brand || base.brand || '',
    model: s.model || base.model || '',
    year: base.year || s.year || '',
    engine: s.engine || s.engine_volume || base.engine || '',
    engine_volume: s.engine_volume || s.engine || base.engine_volume || base.engine || '',
    engine_power: s.engine_power || base.engine_power || '',
    engine_code: s.engine_code || base.engine_code || '',
    fuel: s.fuel || base.fuel || '',
    engine_review_status: (s.engine || s.engine_volume || s.engine_power || s.engine_code) ? 'needs_review' : (base.engine_review_status || 'manual'),
  };
};

const visitDate = (visit) => {
  const raw = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at;
  if (!raw) return 'Без дати';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 'Без дати' : d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Visits() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [settings, setSettings] = useState({ role: 'owner', permissions: {}, company: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitTab, setVisitTab] = useState('overview');
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const [newVisitData, setNewVisitData] = useState({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', ...emptyCarData });
  const [scanDraft, setScanDraft] = useState(null);
  const [passportScanDraft, setPassportScanDraft] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [editCarData, setEditCarData] = useState({ ...emptyCarData });
  const [editComment, setEditComment] = useState('');
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '', quantity: 1 });
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const passportScanInputRef = useRef(null);
  const token = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };
  const isStore = settings.company?.business_type === 'store';

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterDate) params.append('date', filterDate);
      const [visitsRes, settingsRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/?${params.toString()}`, { headers }),
        axios.get(`${API_BASE}/api/settings/`, { headers }),
        axios.get(`${API_BASE}/api/services/`, { headers }).catch(() => ({ data: [] })),
      ]);
      setVisits(visitsRes.data || []);
      setSettings(settingsRes.data || { role: 'owner', permissions: {}, company: {} });
      setCatalogServices(servicesRes.data || []);
      if (searchParams.get('scan') === 'true') setIsCreatingVisit(true);
    } catch (e) {
      if (e.response?.status === 401) navigate('/login');
    } finally { setLoading(false); }
  };
  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t); }, [searchQuery, filterDate]);
  useEffect(() => {
    const data = location.state?.scannedData || location.state?.repeatVisitData;
    if (data) {
      const cleaned = cleanScan(data);
      setNewVisitData((prev) => mergeScanInto(prev, cleaned));
      setScanDraft((prev) => mergeScanInto(prev || newVisitData, cleaned));
      setIsCreatingVisit(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  useEffect(() => { if (selectedVisit) { setVisitTab('overview'); setEditComment(selectedVisit.comment || ''); setEditCarData(readCarData(selectedVisit)); setPassportScanDraft(null); } }, [selectedVisit?.id]);

  const recognizeDocument = async (file) => {
    const dataUrl = await new Promise((resolve) => { const r = new FileReader(); r.onload = (e) => resolve(e.target.result); r.readAsDataURL(file); });
    const img = await new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = dataUrl; });
    const canvas = document.createElement('canvas');
    const max = 1200;
    let { width, height } = img;
    if (width > height && width > max) { height *= max / width; width = max; }
    if (height >= width && height > max) { width *= max / height; height = max; }
    canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    const formData = new FormData(); formData.append('document', blob, 'scan.jpg');
    const res = await axios.post(`${API_BASE}/api/visits/recognize_document/`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    if (!res.data?.success) throw new Error('scan_failed');
    return cleanScan(res.data);
  };
  const scanNewVisit = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; setIsScanning(true);
    try { const scan = await recognizeDocument(file); setScanDraft((prev) => mergeScanInto(prev || newVisitData, scan)); }
    catch { alert('Помилка сканування. Спробуйте інший ракурс.'); }
    finally { setIsScanning(false); if (cameraInputRef.current) cameraInputRef.current.value = ''; if (galleryInputRef.current) galleryInputRef.current.value = ''; }
  };
  const scanExistingVisit = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; setIsScanning(true);
    try { const scan = await recognizeDocument(file); setPassportScanDraft((prev) => mergeScanInto(prev || editCarData, scan)); setVisitTab('passport'); }
    catch { alert('Помилка сканування. Спробуйте інший ракурс.'); }
    finally { setIsScanning(false); if (passportScanInputRef.current) passportScanInputRef.current.value = ''; }
  };

  const acceptNewScan = () => { if (!scanDraft) return; setNewVisitData((prev) => mergeScanInto(prev, scanDraft)); setScanDraft(null); };
  const acceptPassportScan = () => { if (!passportScanDraft) return; setEditCarData((prev) => mergeScanInto(prev, passportScanDraft)); if (passportScanDraft.plate) patchVisit('plate', passportScanDraft.plate.toUpperCase()); if (passportScanDraft.vin_code) patchVisit('vin_code', passportScanDraft.vin_code.toUpperCase()); setPassportScanDraft(null); };

  const handlePlateBlur = async () => {
    if (!newVisitData.plate || newVisitData.plate.length < 3) return;
    try { const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers }); const existing = (res.data || []).find((v) => v.plate?.toUpperCase() === newVisitData.plate.toUpperCase()); if (existing) { setNewVisitData((p) => ({ ...p, client: existing.client, phone: existing.phone, vin_code: existing.vin_code || p.vin_code })); setFoundExisting(true); setTimeout(() => setFoundExisting(false), 3500); } } catch {}
  };
  const createVisit = async (e) => {
    e.preventDefault();
    const carPayload = { brand: newVisitData.brand, model: newVisitData.model, year: newVisitData.year, engine: newVisitData.engine || newVisitData.engine_volume, fuel: newVisitData.fuel, mileage: newVisitData.mileage || '', engine_volume: newVisitData.engine_volume || newVisitData.engine || '', engine_power: newVisitData.engine_power || '', engine_code: newVisitData.engine_code || '', engine_review_status: newVisitData.engine_review_status || 'manual' };
    const payload = { plate: newVisitData.plate.toUpperCase(), vin_code: newVisitData.vin_code, client: newVisitData.client, phone: newVisitData.phone, scheduled_datetime: !isStore && newVisitData.date && newVisitData.time ? new Date(`${newVisitData.date}T${newVisitData.time}`).toISOString() : null, delivery_type: 'pickup', delivery_data: JSON.stringify(carPayload), payment_status: 'unpaid', prepayment_amount: 0 };
    try { await axios.post(`${API_BASE}/api/visits/`, payload, { headers }); setIsCreatingVisit(false); setScanDraft(null); setNewVisitData({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', ...emptyCarData }); fetchData(); }
    catch { alert('Помилка створення'); }
  };
  const patchVisit = async (field, value) => { await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { [field]: value }, { headers }); setSelectedVisit((p) => ({ ...p, [field]: value })); fetchData(); };
  const saveCarData = async () => { await patchVisit('delivery_data', JSON.stringify({ ...emptyCarData, ...editCarData, engine_volume: editCarData.engine_volume || editCarData.engine || '' })); };
  const refreshSelected = async () => { if (!selectedVisit?.id) return; const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers }); setSelectedVisit(res.data); fetchData(); };
  const addService = async (e) => { e.preventDefault(); try { await axios.post(`${API_BASE}/api/order-services/`, { visit: selectedVisit.id, name: newService.name, price: Number(newService.price || 0), quantity: Number(newService.quantity || 1) }, { headers }); setNewService({ name: '', price: '', quantity: 1 }); setSelectedCatalogId(''); setShowServiceForm(false); refreshSelected(); } catch { alert('Помилка додавання роботи'); } };
  const deleteService = async (id) => { if (window.confirm('Видалити роботу?')) { await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers }); refreshSelected(); } };
  const deletePart = async (id) => { if (window.confirm('Видалити запчастину?')) { await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers }); refreshSelected(); } };
  const updatePartStatus = async (id, status) => { await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status }, { headers }); refreshSelected(); };
  const printPdf = async () => { const w = window.open('', '_blank'); if (!w) return; try { const r = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/pdf/`, { headers, responseType: 'text' }); w.document.write(r.data); w.document.close(); } catch { w.close(); alert('Не вдалося згенерувати документ'); } };
  const cancelVisit = async () => { if (!window.confirm('Скасувати запис?')) return; await axios.delete(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers }); setSelectedVisit(null); fetchData(); };

  const grouped = {
    pending: visits.filter((v) => ['PENDING', 'SELECTION', 'DRAFT'].includes(v.status)),
    progress: visits.filter((v) => ['IN_PROGRESS', 'ORDERED'].includes(v.status)),
    done: visits.filter((v) => v.status === 'DONE'),
    completed: visits.filter((v) => v.status === 'COMPLETED'),
  };
  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  return <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen overflow-x-hidden"><div className="flex flex-col xl:flex-row gap-4 justify-between mb-6"><h1 className="text-2xl font-black uppercase italic">{isStore ? 'Замовлення' : 'Дошка Візитів'}</h1><div className="flex flex-col md:flex-row gap-3 flex-1 xl:justify-center"><div className="relative w-full md:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Пошук ID, номер, клієнт..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold outline-none" /></div><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" /></div><button onClick={() => setIsCreatingVisit(true)} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase text-xs flex justify-center gap-2"><Plus size={16} /> Новий візит</button></div><div className="grid grid-cols-1 md:grid-cols-3 gap-5"><Column title="В черзі / Підбір" items={grouped.pending} icon={<Clock size={18} />} onOpen={setSelectedVisit} isStore={isStore} /><Column title="В роботі" items={grouped.progress} icon={<Wrench size={18} />} onOpen={setSelectedVisit} isStore={isStore} /><Column title="Готово" items={isStore ? [...grouped.done, ...grouped.completed] : grouped.done} icon={<CheckCircle2 size={18} />} onOpen={setSelectedVisit} isStore={isStore} /></div>{isCreatingVisit && <CreateVisitModal data={newVisitData} setData={setNewVisitData} onClose={() => { setIsCreatingVisit(false); setScanDraft(null); }} onSubmit={createVisit} onPlateBlur={handlePlateBlur} foundExisting={foundExisting} isScanning={isScanning} cameraRef={cameraInputRef} galleryRef={galleryInputRef} onScan={scanNewVisit} scanDraft={scanDraft} setScanDraft={setScanDraft} onAcceptScan={acceptNewScan} />}{selectedVisit && <VisitModal visit={selectedVisit} setVisit={setSelectedVisit} tab={visitTab} setTab={setVisitTab} carData={editCarData} setCarData={setEditCarData} onSaveCar={saveCarData} scanRef={passportScanInputRef} onScan={scanExistingVisit} scanDraft={passportScanDraft} setScanDraft={setPassportScanDraft} onAcceptScan={acceptPassportScan} isScanning={isScanning} onPatch={patchVisit} onPrint={printPdf} onCancel={cancelVisit} catalogServices={catalogServices} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} newService={newService} setNewService={setNewService} onAddService={addService} onDeleteService={deleteService} onDeletePart={deletePart} onUpdatePartStatus={updatePartStatus} editComment={editComment} setEditComment={setEditComment} />}</div>;
}

function Column({ title, icon, items, onOpen, isStore }) { return <div className="bg-slate-50/50 rounded-3xl p-4 border border-slate-100"><h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 text-slate-600">{icon} {title}<span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span></h3><div className="space-y-4">{items.map((v) => <VisitCard key={v.id} visit={v} onClick={() => onOpen(v)} isStore={isStore} />)}{items.length === 0 && <div className="text-center text-slate-400 text-xs font-bold uppercase py-10">Пусто</div>}</div></div>; }

function CreateVisitModal({ data, setData, onClose, onSubmit, onPlateBlur, foundExisting, isScanning, cameraRef, galleryRef, onScan, scanDraft, setScanDraft, onAcceptScan }) { return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4"><div className="bg-white rounded-3xl w-full max-w-xl mx-auto my-6 p-5 md:p-6 relative shadow-2xl">{isScanning && <ScanOverlay />}<button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-xl"><X size={18} /></button><h2 className="text-2xl font-black uppercase mb-4">Новий візит</h2><form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => cameraRef.current?.click()} className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Camera size={16} /> Камера</button><button type="button" onClick={() => galleryRef.current?.click()} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-xl py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><ScanLine size={16} /> Фото</button><input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onScan} className="hidden" /><input ref={galleryRef} type="file" accept="image/*" onChange={onScan} className="hidden" /></div>{scanDraft && <ScanReviewCard data={scanDraft} setData={setScanDraft} onApply={onAcceptScan} onCancel={() => setScanDraft(null)} />}
<div className="grid grid-cols-2 gap-3"><LabeledInput label="Дата візиту" type="date" required value={data.date} onChange={(v) => setData({ ...data, date: v })} /><LabeledInput label="Час візиту" type="time" required value={data.time} onChange={(v) => setData({ ...data, time: v })} /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><LabeledInput label="ПІБ клієнта" required value={data.client} onChange={(v) => setData({ ...data, client: v })} /><LabeledInput label="Телефон" required value={data.phone} onChange={(v) => setData({ ...data, phone: v })} /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><LabeledInput label="Держ. номер" required value={data.plate} onBlur={onPlateBlur} onChange={(v) => setData({ ...data, plate: v.toUpperCase() })} hint={foundExisting ? '✓ Знайдено в базі' : ''} /><LabeledInput label="VIN" value={data.vin_code} onChange={(v) => setData({ ...data, vin_code: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) })} /></div><CarFields data={data} setData={setData} /><button className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black uppercase text-xs">Створити візит</button></form></div></div>; }

function VisitModal({ visit, setVisit, tab, setTab, carData, setCarData, onSaveCar, scanRef, onScan, scanDraft, setScanDraft, onAcceptScan, isScanning, onPatch, onPrint, onCancel, catalogServices, selectedCatalogId, setSelectedCatalogId, showServiceForm, setShowServiceForm, newService, setNewService, onAddService, onDeleteService, onDeletePart, onUpdatePartStatus, editComment, setEditComment }) { const tabs = [['overview','Огляд',Info],['passport','Техпаспорт',CarFront],['acceptance','Акт',FileText],['diagnostic','Діагностика',ClipboardCheck],['works','Роботи',Wrench],['parts','Запчастини',Package],['recommendations','Рекомендації',ClipboardList],['summary','Підсумок',Calculator]]; const group = { client: visit.client, phone: visit.phone, plate: visit.plate, vin: visit.vin_code, car: `${carData.brand || ''} ${carData.model || ''}`.trim() || visit.plate }; return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-hidden flex items-stretch sm:items-start justify-center sm:p-4"><div className="bg-white w-full sm:max-w-5xl sm:rounded-3xl shadow-2xl flex flex-col h-[100dvh] sm:max-h-[calc(100dvh-3rem)] relative">{isScanning && <ScanOverlay />}<div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 shrink-0"><div className="flex justify-between gap-3"><div><div className="flex flex-wrap gap-2 mb-2"><span className="bg-blue-600 text-white rounded-xl px-3 py-1 text-xs font-black uppercase flex items-center gap-1"><Hash size={13}/> Візит №{visitId(visit)}</span><span className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-xs font-black uppercase text-slate-500">{visit.status || 'SELECTION'}</span></div><h2 className="text-2xl font-black uppercase">{visit.plate}</h2><p className="text-slate-500 text-sm font-bold">{visit.client} · {visit.phone}</p></div><div className="flex gap-2"><button onClick={onPrint} className="bg-blue-100 text-blue-700 p-2 rounded-xl"><Printer size={18}/></button><button onClick={onCancel} className="bg-red-100 text-red-600 p-2 rounded-xl"><Trash2 size={18}/></button><button onClick={() => setVisit(null)} className="bg-slate-100 p-2 rounded-xl"><X size={18}/></button></div></div><div className="mt-4 grid grid-cols-3 gap-2"><StatusBtn active={['PENDING','DRAFT','SELECTION'].includes(visit.status)} onClick={() => onPatch('status','PENDING')} label="В черзі"/><StatusBtn active={['IN_PROGRESS','ORDERED'].includes(visit.status)} onClick={() => onPatch('status','IN_PROGRESS')} label="В роботі"/><StatusBtn active={visit.status === 'DONE'} onClick={() => onPatch('status','DONE')} label="Готово"/></div></div><div className="px-4 md:px-6 pt-3 bg-white border-b border-slate-100 overflow-x-auto shrink-0"><div className="flex gap-2 min-w-max pb-3">{tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase whitespace-nowrap ${tab===key?'bg-blue-600 text-white':'bg-slate-50 text-slate-500'}`}><Icon size={15}/>{label}</button>)}</div></div><div className="p-4 md:p-6 overflow-y-auto flex-1">{tab==='overview'&&<Overview visit={visit} carData={carData}/>} {tab==='passport'&&<Passport carData={carData} setCarData={setCarData} onSave={onSaveCar} scanRef={scanRef} onScan={onScan} scanDraft={scanDraft} setScanDraft={setScanDraft} onAcceptScan={onAcceptScan} visit={visit}/>} {tab==='acceptance'&&<VisitWorkflowPanel selectedGroup={group} lastVisit={visit} initialActive="acceptance" standalone/>} {tab==='diagnostic'&&<VisitWorkflowPanel selectedGroup={group} lastVisit={visit} initialActive="diagnostic" standalone/>} {tab==='works'&&<Works visit={visit} catalogServices={catalogServices} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} newService={newService} setNewService={setNewService} onAddService={onAddService} onDeleteService={onDeleteService}/>} {tab==='parts'&&<Parts visit={visit} onDelete={onDeletePart} onStatus={onUpdatePartStatus}/>} {tab==='recommendations'&&<EmptyPanel text="Рекомендації у наступному етапі можна створювати прямо з діагностики."/>} {tab==='summary'&&<Summary visit={visit} editComment={editComment} setEditComment={setEditComment} onSave={() => onPatch('comment', editComment)} />}</div></div></div>; }
function StatusBtn({active,onClick,label}){return <button onClick={onClick} className={`py-2.5 rounded-xl text-[10px] font-black uppercase ${active?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200'}`}>{label}</button>}
function Overview({visit,carData}){return <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><InfoCard label="ID" value={`№${visitId(visit)}`}/><InfoCard label="Дата" value={visitDate(visit)}/><InfoCard label="Сума" value={money(totalOf(visit))}/><InfoCard label="Клієнт" value={visit.client}/><InfoCard label="Телефон" value={visit.phone}/><InfoCard label="Авто" value={`${carData.brand || '—'} ${carData.model || ''} ${carData.year || ''}`}/><InfoCard label="VIN" value={visit.vin_code || '—'}/><InfoCard label="Двигун" value={`${carData.engine_volume || carData.engine || '—'} см³ ${carData.engine_power ? `· ${carData.engine_power} кВт` : ''}`}/><InfoCard label="Паливо" value={carData.fuel || '—'}/></div>}
function Passport({carData,setCarData,onSave,scanRef,onScan,scanDraft,setScanDraft,onAcceptScan,visit}){return <div className="space-y-4"><div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 justify-between"><div><h3 className="font-black text-slate-800 flex gap-2"><ScanLine size={17}/> Скан техпаспорта</h3><p className="text-xs font-semibold text-slate-400">Дані з другого фото додаються до вже збережених, а не очищають їх.</p></div><button onClick={()=>scanRef.current?.click()} className="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase flex gap-2 justify-center"><Camera size={15}/> Сканувати</button><input ref={scanRef} type="file" accept="image/*" onChange={onScan} className="hidden"/></div>{scanDraft&&<ScanReviewCard data={scanDraft} setData={setScanDraft} onApply={onAcceptScan} onCancel={()=>setScanDraft(null)}/>}<CarFields data={carData} setData={setCarData}/><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><InfoCard label="Держ. номер" value={visit.plate}/><InfoCard label="VIN" value={visit.vin_code || '—'}/></div><button onClick={onSave} className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти техпаспорт</button></div>}
function Works({visit,catalogServices,selectedCatalogId,setSelectedCatalogId,showServiceForm,setShowServiceForm,newService,setNewService,onAddService,onDeleteService}){const ss=servicesOf(visit);return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><InfoCard label="Робіт" value={ss.length}/><InfoCard label="Сума" value={money(servicesTotal(visit))}/></div><button onClick={()=>setShowServiceForm(!showServiceForm)} className="bg-blue-50 text-blue-700 rounded-xl px-4 py-3 text-xs font-black uppercase flex gap-2"><Plus size={14}/> Додати роботу</button>{showServiceForm&&<form onSubmit={onAddService} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2"><select value={selectedCatalogId} onChange={(e)=>{setSelectedCatalogId(e.target.value);const s=catalogServices.find(x=>x.id===Number(e.target.value)); if(s) setNewService({name:s.name,price:s.price||s.default_price||'',quantity:1})}} className="w-full bg-white border rounded-lg p-2 text-xs font-bold"><option value="">Ввести вручну</option>{catalogServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input required placeholder="Назва роботи" value={newService.name} onChange={(e)=>setNewService({...newService,name:e.target.value})} className="w-full bg-white border rounded-lg p-2 text-xs font-bold"/><div className="grid grid-cols-2 gap-2"><input required type="number" placeholder="Ціна" value={newService.price} onChange={(e)=>setNewService({...newService,price:e.target.value})} className="bg-white border rounded-lg p-2 text-xs font-bold"/><input required type="number" placeholder="К-сть" value={newService.quantity} onChange={(e)=>setNewService({...newService,quantity:e.target.value})} className="bg-white border rounded-lg p-2 text-xs font-bold"/></div><button className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs font-black uppercase">Зберегти</button></form>}{ss.map(s=><Row key={s.id} title={s.name||s.custom_name} sub={`${s.quantity||1} × ${money(s.price)}`} price={money(Number(s.price||0)*Number(s.quantity||1))} onDelete={()=>onDeleteService(s.id)}/>)}{!ss.length&&<EmptyPanel text="Роботи ще не додані"/>}</div>}
function Parts({visit,onDelete,onStatus}){const ps=partsOf(visit);return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><InfoCard label="Позицій" value={ps.length}/><InfoCard label="Сума" value={money(partsTotal(visit))}/></div>{ps.map(p=><div key={p.id} className="p-3 bg-slate-50 rounded-xl border flex flex-col lg:flex-row lg:items-center gap-3"><div className="flex-1"><p className="font-black text-slate-800 text-sm">{p.name}</p><p className="text-xs uppercase font-bold text-slate-500">{p.brand} | {p.part_number||p.article}</p><p className="text-xs font-bold text-blue-600 mt-1">{money(p.sell_price||p.price)} · к-сть {p.quantity||1}</p></div><select value={p.status||p.logistics_status||'WAITING'} onChange={(e)=>onStatus(p.id,e.target.value)} className="border rounded-xl px-3 py-2 text-xs font-black"><option value="WAITING">Очікується</option><option value="IN_TRANSIT">В дорозі</option><option value="ARRIVED">Доставлено</option><option value="UNAVAILABLE">Відмова</option></select><button onClick={()=>onDelete(p.id)} className="text-red-500 p-2"><Trash2 size={16}/></button></div>)}{!ps.length&&<EmptyPanel text="Запчастини ще не додані"/>}</div>}
function Summary({visit,editComment,setEditComment,onSave}){return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><InfoCard label="Роботи" value={money(servicesTotal(visit))}/><InfoCard label="Запчастини" value={money(partsTotal(visit))}/><InfoCard label="Разом" value={money(totalOf(visit))}/></div><textarea value={editComment} onChange={(e)=>setEditComment(e.target.value)} className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm font-bold min-h-[100px]" placeholder="Внутрішній коментар"/><button onClick={onSave} className="bg-amber-400 text-amber-950 rounded-xl px-5 py-3 text-xs font-black uppercase">Зберегти коментар</button></div>}
function CarFields({data,setData}){return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div className="flex justify-between items-center border-b pb-2 mb-3"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Дані автомобіля</p><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${data.engine_review_status==='needs_review'?'bg-amber-50 text-amber-700 border-amber-100':'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{data.engine_review_status==='needs_review'?'Двигун перевірити':'Перевірено вручну'}</span></div><div className="grid grid-cols-2 gap-3"><LabeledInput label="Марка" value={data.brand} onChange={(v)=>setData({...data,brand:v})}/><LabeledInput label="Модель" value={data.model} onChange={(v)=>setData({...data,model:v})}/><LabeledInput label="Рік" type="number" value={data.year} onChange={(v)=>setData({...data,year:v})}/><LabeledInput label="Обʼєм см³" type="number" value={data.engine_volume||data.engine} onChange={(v)=>setData({...data,engine:v,engine_volume:v,engine_review_status:'manual'})}/><LabeledInput label="Потужність кВт" type="number" value={data.engine_power} onChange={(v)=>setData({...data,engine_power:v,engine_review_status:'manual'})}/><LabeledInput label="Код двигуна" value={data.engine_code} onChange={(v)=>setData({...data,engine_code:v,engine_review_status:'manual'})}/><div className="col-span-2"><LabeledInput label="Паливо" value={data.fuel} onChange={(v)=>setData({...data,fuel:v,engine_review_status:'manual'})}/></div></div></div>}
function ScanReviewCard({data,setData,onApply,onCancel}){return <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3"><div className="flex gap-2"><AlertTriangle size={18} className="text-amber-600 shrink-0"/><div><p className="font-black text-amber-800 text-sm">Результат скану потребує перевірки</p><p className="text-xs font-semibold text-amber-700">Це обʼєднаний результат: нове фото доповнює вже знайдені дані.</p></div></div><div className="grid grid-cols-2 gap-2"><LabeledInput label="Держ. номер" value={data.plate} onChange={(v)=>setData({...data,plate:v.toUpperCase()})}/><LabeledInput label="VIN" value={data.vin_code||data.vin_candidate} onChange={(v)=>setData({...data,vin_code:v.toUpperCase()})}/><LabeledInput label="Марка" value={data.brand} onChange={(v)=>setData({...data,brand:v})}/><LabeledInput label="Модель" value={data.model} onChange={(v)=>setData({...data,model:v})}/><LabeledInput label="Рік" type="number" value={data.year} onChange={(v)=>setData({...data,year:v})}/><LabeledInput label="Обʼєм см³" type="number" value={data.engine_volume||data.engine} onChange={(v)=>setData({...data,engine:v,engine_volume:v})}/><LabeledInput label="Потужність кВт" type="number" value={data.engine_power} onChange={(v)=>setData({...data,engine_power:v})}/><LabeledInput label="Код двигуна" value={data.engine_code} onChange={(v)=>setData({...data,engine_code:v})}/><div className="col-span-2"><LabeledInput label="Паливо" value={data.fuel} onChange={(v)=>setData({...data,fuel:v})}/></div></div>{data.warnings?.length>0&&<div className="text-xs font-bold text-amber-700 space-y-1">{data.warnings.map((w,i)=><p key={i}>• {w}</p>)}</div>}<div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={onApply} className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Прийняти дані</button><button type="button" onClick={onCancel} className="flex-1 bg-white border border-amber-200 text-amber-700 rounded-xl py-3 text-xs font-black uppercase">Не використовувати</button></div></div>}
function LabeledInput({label,value,onChange,type='text',required,hint,onBlur}){return <label className="block"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">{label}</span><input required={required} type={type} value={value||''} onBlur={onBlur} onChange={(e)=>onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-500"/>{hint&&<span className="text-[10px] font-black text-emerald-600 ml-1 mt-1 block">{hint}</span>}</label>}
function InfoCard({label,value}){return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-sm mt-1 break-words">{value||'—'}</p></div>}
function Row({title,sub,price,onDelete}){return <div className="p-3 bg-slate-50 rounded-xl border flex justify-between items-center gap-3"><div><p className="font-bold text-slate-700 text-sm">{title}</p><p className="text-xs text-slate-400">{sub}</p></div><div className="flex items-center gap-3"><p className="font-black text-sm text-slate-800">{price}</p><button onClick={onDelete} className="text-red-500 p-1"><Trash2 size={16}/></button></div></div>}
function EmptyPanel({text}){return <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center text-slate-400 font-bold text-sm">{text}</div>}
function ScanOverlay(){return <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center text-center"><Loader2 className="animate-spin text-white mb-4" size={38}/><h3 className="text-white font-black text-xl">Розпізнаємо техпаспорт</h3><p className="text-slate-300 text-sm font-semibold mt-1">Після скану покажемо дані для перевірки</p></div>}
