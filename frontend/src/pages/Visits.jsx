import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Calculator,
  Camera,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  Hash,
  Info,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  ScanLine,
  Search,
  Store,
  Trash2,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import VisitCard from '../components/visits/VisitCard';
import VisitWorkflowPanel from '../components/crm/VisitWorkflowPanel';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
const visitId = (visit) => visit?.id ?? visit?.visit_id ?? visit?.pk ?? '';
const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const arr = (value) => (Array.isArray(value) ? value : []);
const getParts = (visit) => arr(visit?.parts || visit?.items);
const getServices = (visit) => arr(visit?.services || visit?.orderservice_set);
const visitTotal = (visit) => getParts(visit).reduce((sum, item) => sum + Number(item.sell_price || item.price || 0) * Number(item.quantity || 1), 0) + getServices(visit).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
const getCarData = (visit) => {
  if (!visit?.delivery_data || typeof visit.delivery_data !== 'string' || !visit.delivery_data.startsWith('{')) return { brand: '', model: '', year: '', engine: '', fuel: '', mileage: '' };
  try { return { brand: '', model: '', year: '', engine: '', fuel: '', mileage: '', ...JSON.parse(visit.delivery_data) }; } catch { return { brand: '', model: '', year: '', engine: '', fuel: '', mileage: '' }; }
};
const visitDateText = (visit) => {
  const raw = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at;
  if (!raw) return 'Без дати';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Без дати';
  return date.toLocaleString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Visits = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [role, setRole] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitTab, setVisitTab] = useState('overview');
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeData, setEditTimeData] = useState({ date: '', time: '' });
  const [editComment, setEditComment] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [editCarData, setEditCarData] = useState({ brand: '', model: '', year: '', engine: '', fuel: '', mileage: '' });
  const [newService, setNewService] = useState({ name: '', price: '', quantity: 1 });
  const [copiedText, setCopiedText] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [newVisitData, setNewVisitData] = useState({
    plate: '', vin_code: '', client: '', phone: '', date: '', time: '',
    delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '',
    brand: '', model: '', year: '', engine: '', fuel: '',
  });

  const token = localStorage.getItem('access_token');
  const isStore = companyInfo?.business_type === 'store';
  const headers = { Authorization: `Bearer ${token}` };
  const partStatusColors = { WAITING: 'text-orange-600 bg-orange-100', IN_TRANSIT: 'text-blue-600 bg-blue-100', ARRIVED: 'text-green-600 bg-green-100', UNAVAILABLE: 'text-red-600 bg-red-100' };

  const getSupplierBadgeStyle = (supplierName) => {
    const name = (supplierName || '').toUpperCase();
    if (name.includes('VESNA') || name.includes('ВЕСНА')) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
    if (name.includes('OMEGA') || name.includes('ОМЕГА')) return 'text-blue-700 bg-blue-50 border-blue-100';
    if (name.includes('TEHNO') || name.includes('ТЕХНО')) return 'text-rose-700 bg-rose-50 border-rose-100';
    return 'text-violet-700 bg-violet-50 border-violet-100';
  };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterDate) params.append('date', filterDate);
      const [visitsRes, settingsRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/?${params.toString()}`, { headers }),
        axios.get(`${API_BASE}/api/settings/`, { headers }),
        axios.get(`${API_BASE}/api/services/`, { headers }),
      ]);
      setVisits(visitsRes.data || []);
      setRole(settingsRes.data.role);
      setCompanyInfo(settingsRes.data.company);
      setPermissions(settingsRes.data.permissions || {});
      setCatalogServices(servicesRes.data || []);
      if (searchParams.get('scan') === 'true') setIsCreatingVisit(true);
    } catch (error) {
      if (error.response?.status === 401) navigate('/login');
      setRole('owner');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const timeoutId = setTimeout(fetchData, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, filterDate, navigate, token]);

  useEffect(() => {
    const data = location.state?.scannedData || location.state?.repeatVisitData;
    if (data) {
      setNewVisitData((prev) => ({ ...prev, ...data }));
      setIsCreatingVisit(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedVisit) return;
    setVisitTab('overview');
    setEditComment(selectedVisit.comment || '');
    setEditCarData(getCarData(selectedVisit));
  }, [selectedVisit?.id]);

  const copyText = (text) => {
    if (!text) return;
    const finish = () => { setCopiedText(String(text)); setTimeout(() => setCopiedText(null), 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(String(text)).then(finish).catch(() => fallbackCopy(text, finish));
    else fallbackCopy(text, finish);
  };
  const fallbackCopy = (text, finish) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); finish?.(); } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(textArea);
  };

  const changeDate = (days) => {
    const current = filterDate ? new Date(filterDate) : new Date();
    current.setDate(current.getDate() + days);
    setFilterDate(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  };

  const handlePlateBlur = async () => {
    if (!newVisitData.plate || newVisitData.plate.length < 3) return;
    try {
      const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers });
      const existing = (res.data || []).find((v) => v.plate?.toUpperCase() === newVisitData.plate.toUpperCase());
      if (existing) {
        setNewVisitData((prev) => ({ ...prev, client: existing.client, phone: existing.phone, vin_code: existing.vin_code || '' }));
        setFoundExisting(true); setTimeout(() => setFoundExisting(false), 4000);
      }
    } catch {}
  };

  const handleScanDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const max = 1200;
        let { width, height } = img;
        if (width > height && width > max) { height *= max / width; width = max; }
        if (height >= width && height > max) { width *= max / height; height = max; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('document', blob, 'scan.jpg');
          try {
            const res = await axios.post(`${API_BASE}/api/visits/recognize_document/`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) setNewVisitData((prev) => ({ ...prev, plate: prev.plate || res.data.plate || '', vin_code: prev.vin_code || res.data.vin_code || '', brand: prev.brand || res.data.brand || '', model: prev.model || res.data.model || '', year: prev.year || res.data.year || '', engine: prev.engine || res.data.engine || '', fuel: prev.fuel || res.data.fuel || '' }));
          } catch { alert('Помилка сканування. Спробуйте інший ракурс.'); }
          finally { setIsScanning(false); if (cameraInputRef.current) cameraInputRef.current.value = ''; if (galleryInputRef.current) galleryInputRef.current.value = ''; }
        }, 'image/jpeg', 0.8);
      };
    };
  };

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    const scheduled_datetime = !isStore && newVisitData.date && newVisitData.time ? new Date(`${newVisitData.date}T${newVisitData.time}`).toISOString() : null;
    const finalPlate = newVisitData.plate ? newVisitData.plate.toUpperCase() : (isStore ? `ORD-${Math.floor(Math.random() * 100000)}` : '');
    const payload = {
      plate: finalPlate, vin_code: newVisitData.vin_code, client: newVisitData.client, phone: newVisitData.phone,
      scheduled_datetime,
      delivery_type: isStore ? newVisitData.delivery_type : 'pickup',
      delivery_data: isStore ? newVisitData.delivery_data : JSON.stringify({ brand: newVisitData.brand.trim(), model: newVisitData.model.trim(), year: newVisitData.year.trim(), engine: newVisitData.engine.trim(), fuel: newVisitData.fuel.trim(), mileage: '' }),
      payment_status: isStore ? newVisitData.payment_status : 'unpaid',
      prepayment_amount: isStore && newVisitData.payment_status === 'advance' ? (newVisitData.prepayment_amount || 0) : 0,
    };
    if (isStore) payload.comment = `[Марка: ${newVisitData.brand.trim()} | Модель: ${newVisitData.model.trim()} | Рік: ${newVisitData.year.trim()} | Дв: ${newVisitData.engine.trim()} | Паливо: ${newVisitData.fuel.trim()}]`.trim();
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers });
      setIsCreatingVisit(false);
      setNewVisitData({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', brand: '', model: '', year: '', engine: '', fuel: '' });
      setSearchQuery(''); setFilterDate(''); fetchData();
    } catch { alert('Помилка створення'); }
  };

  const updateVisitField = async (field, value) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { [field]: value }, { headers });
      setSelectedVisit((prev) => ({ ...prev, [field]: value }));
      fetchData();
    } catch { alert('Помилка збереження'); }
  };

  const handleSaveCarData = async () => {
    if (!selectedVisit) return;
    if (!isStore) {
      const jsonString = JSON.stringify({ ...editCarData });
      if (jsonString !== selectedVisit.delivery_data) await updateVisitField('delivery_data', jsonString);
    } else {
      const pureComment = selectedVisit.comment ? selectedVisit.comment.replace(/^\[Марка:.*?\|.*?\|.*?\|.*?\|.*?\]\s*/, '') : '';
      const finalComment = `[Марка: ${editCarData.brand} | Модель: ${editCarData.model} | Рік: ${editCarData.year} | Дв: ${editCarData.engine} | Паливо: ${editCarData.fuel}] ${pureComment}`.trim();
      await updateVisitField('comment', finalComment);
    }
  };

  const refreshSelectedVisit = async () => {
    if (!selectedVisit?.id) return;
    const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers });
    setSelectedVisit(res.data); fetchData();
  };
  const updatePartStatus = async (id, newStatus) => { try { await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status: newStatus }, { headers }); refreshSelectedVisit(); } catch { alert('Помилка оновлення статусу'); } };
  const handleDeletePart = async (id) => { if (window.confirm('Видалити цю запчастину?')) { try { await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers }); refreshSelectedVisit(); } catch { alert('Помилка видалення запчастини'); } } };
  const handleDeleteService = async (id) => { if (window.confirm('Видалити цю роботу?')) { try { await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers }); refreshSelectedVisit(); } catch { alert('Помилка видалення роботи'); } } };
  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/order-services/`, { visit: selectedVisit.id, name: newService.name, price: parseFloat(newService.price || 0), quantity: parseFloat(newService.quantity || 1) }, { headers });
      setNewService({ name: '', price: '', quantity: 1 }); setSelectedCatalogId(''); setShowServiceForm(false); refreshSelectedVisit();
    } catch { alert('Помилка додавання послуги'); }
  };
  const handleSaveComment = async () => { await updateVisitField('comment', editComment); };
  const handlePrintPDF = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Браузер заблокував вікно друку.');
    try {
      const response = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/pdf/`, { headers, responseType: 'text' });
      printWindow.document.open(); printWindow.document.write(response.data); printWindow.document.close();
    } catch { printWindow.close(); alert('Не вдалося згенерувати документ для друку.'); }
  };
  const handleCancelVisit = async () => {
    if (!selectedVisit?.id || !window.confirm('Скасувати запис? Цю дію неможливо відмінити.')) return;
    try { await axios.delete(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers }); setSelectedVisit(null); fetchData(); } catch { alert('Помилка скасування запису'); }
  };
  const handleEditVisitDateTime = () => {
    if (!selectedVisit?.scheduled_datetime) return;
    const dt = new Date(selectedVisit.scheduled_datetime);
    if (Number.isNaN(dt.getTime())) return;
    setEditTimeData({ date: dt.toISOString().slice(0, 10), time: dt.toTimeString().slice(0, 5) });
    setIsEditingTime(true);
  };
  const handleSaveVisitDateTime = async () => { if (!editTimeData.date || !editTimeData.time) return; await updateVisitField('scheduled_datetime', new Date(`${editTimeData.date}T${editTimeData.time}`).toISOString()); setIsEditingTime(false); };

  const pending = visits.filter((v) => ['PENDING', 'SELECTION', 'DRAFT'].includes(v.status));
  const inProgress = visits.filter((v) => ['IN_PROGRESS', 'ORDERED'].includes(v.status));
  const done = visits.filter((v) => v.status === 'DONE');
  const completed = visits.filter((v) => v.status === 'COMPLETED');

  const selectedGroup = selectedVisit ? { client: selectedVisit.client, phone: selectedVisit.phone, plate: selectedVisit.plate, vin: selectedVisit.vin_code, car: `${editCarData.brand || ''} ${editCarData.model || ''}`.trim() || selectedVisit.plate } : null;

  const Column = ({ title, icon, items, colorClass }) => (
    <div className="bg-slate-50/50 rounded-3xl p-4 flex flex-col border border-slate-100 no-print-area">
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${colorClass}`}>{icon} {title}<span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span></h3>
      <div className="space-y-4 flex-1 pb-4">{items.map((visit) => <VisitCard key={visit.id} visit={visit} onClick={() => setSelectedVisit(visit)} isStore={isStore} />)}{items.length === 0 && <div className="text-center text-slate-400 text-xs font-bold uppercase mt-10">Пусто</div>}</div>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen flex flex-col w-full overflow-x-hidden">
      <style>{`input[type="date"], input[type="time"] { color: #334155 !important; -webkit-appearance: none; min-height: 42px; } @keyframes scan-laser { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } } .laser-line { position: absolute; left: 0; right: 0; height: 2px; background: #10b981; box-shadow: 0 0 15px 5px rgba(16, 185, 129, 0.4); animation: scan-laser 2s infinite linear; }`}</style>

      <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4 no-print-area shrink-0 mt-4 md:mt-0">
        <h1 className="text-2xl font-black uppercase italic w-full xl:w-auto">{isStore ? 'Замовлення' : 'Дошка Візитів'}</h1>
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1 xl:justify-center">
          <div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Пошук (ID, номер, клієнт)..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium shadow-sm transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm transition-all focus-within:border-blue-500 w-full md:w-auto"><button onClick={() => changeDate(-1)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><ChevronLeft size={16} /></button><input type="date" className="bg-transparent px-2 py-2 text-sm outline-none font-medium text-slate-700 cursor-pointer w-full text-center" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /><button onClick={() => changeDate(1)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><ChevronRight size={16} /></button></div>
        </div>
        {(role === 'owner' || permissions?.can_create_visits) && <button onClick={() => setIsCreatingVisit(true)} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 w-full xl:w-auto shrink-0"><Plus size={16} /> {isStore ? 'Нове замовлення' : 'Нове авто'}</button>}
      </div>

      {isStore ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 flex-1 no-print-area"><Column title="Нові" icon={<Package size={18} />} items={pending} colorClass="text-slate-600" /><Column title="Чекаємо деталі" icon={<Clock size={18} />} items={inProgress} colorClass="text-orange-600" /><Column title="Відправка" icon={<Truck size={18} />} items={done} colorClass="text-blue-600" /><Column title="Виконано" icon={<CheckCircle2 size={18} />} items={completed} colorClass="text-green-600" /></div> : <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 no-print-area"><Column title="В черзі / Підбір" icon={<Clock size={18} />} items={pending} colorClass="text-slate-600" /><Column title="В роботі / Замовлено" icon={<Wrench size={18} />} items={inProgress} colorClass="text-blue-600" /><Column title="Готово" icon={<CheckCircle2 size={18} />} items={done} colorClass="text-green-600" /></div>}

      {isCreatingVisit && <CreateVisitModal isStore={isStore} newVisitData={newVisitData} setNewVisitData={setNewVisitData} onClose={() => setIsCreatingVisit(false)} onSubmit={handleCreateVisit} handlePlateBlur={handlePlateBlur} foundExisting={foundExisting} isScanning={isScanning} handleScanDocument={handleScanDocument} cameraInputRef={cameraInputRef} galleryInputRef={galleryInputRef} />}

      {selectedVisit && <VisitModal selectedVisit={selectedVisit} setSelectedVisit={setSelectedVisit} visitTab={visitTab} setVisitTab={setVisitTab} selectedGroup={selectedGroup} editCarData={editCarData} setEditCarData={setEditCarData} handleSaveCarData={handleSaveCarData} copyText={copyText} copiedText={copiedText} isStore={isStore} updateVisitField={updateVisitField} isEditingTime={isEditingTime} editTimeData={editTimeData} setEditTimeData={setEditTimeData} handleEditVisitDateTime={handleEditVisitDateTime} handleSaveVisitDateTime={handleSaveVisitDateTime} setIsEditingTime={setIsEditingTime} handlePrintPDF={handlePrintPDF} handleCancelVisit={handleCancelVisit} showServiceForm={showServiceForm} setShowServiceForm={setShowServiceForm} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} catalogServices={catalogServices} newService={newService} setNewService={setNewService} handleAddService={handleAddService} handleDeleteService={handleDeleteService} getSupplierBadgeStyle={getSupplierBadgeStyle} updatePartStatus={updatePartStatus} handleDeletePart={handleDeletePart} partStatusColors={partStatusColors} editComment={editComment} setEditComment={setEditComment} handleSaveComment={handleSaveComment} />}
    </div>
  );
};

function CreateVisitModal({ isStore, newVisitData, setNewVisitData, onClose, onSubmit, handlePlateBlur, foundExisting, isScanning, handleScanDocument, cameraInputRef, galleryInputRef }) {
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto no-print-area pt-10 pb-20"><div className="bg-white rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl relative overflow-hidden">{isScanning && <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm"><div className="relative w-48 h-32 border-2 border-emerald-500 rounded-lg mb-6 overflow-hidden bg-slate-800/50"><div className="laser-line" /></div><h3 className="text-white font-black text-xl mb-2">ШІ розпізнає техпаспорт</h3></div>}<button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl"><X size={18} /></button><h2 className="text-xl font-black uppercase mb-4">{isStore ? 'Нове замовлення' : 'Новий візит'}</h2><form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => cameraInputRef.current?.click()} className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Camera size={16} /> Камера</button><button type="button" onClick={() => galleryInputRef.current?.click()} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-xl py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><ScanLine size={16} /> Фото</button><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleScanDocument} className="hidden" /><input ref={galleryInputRef} type="file" accept="image/*" onChange={handleScanDocument} className="hidden" /></div>{!isStore && <div className="grid grid-cols-2 gap-4"><input required type="date" className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 font-bold text-sm" value={newVisitData.date} onChange={(e) => setNewVisitData({ ...newVisitData, date: e.target.value })} /><input required type="time" className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 font-bold text-sm" value={newVisitData.time} onChange={(e) => setNewVisitData({ ...newVisitData, time: e.target.value })} /></div>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><input required type="text" placeholder="ПІБ Клієнта" className="bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={newVisitData.client} onChange={(e) => setNewVisitData({ ...newVisitData, client: e.target.value })} /><input required type="text" placeholder="Телефон" className="bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={newVisitData.phone} onChange={(e) => setNewVisitData({ ...newVisitData, phone: e.target.value })} /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Держ. номер</label><input required={!isStore} type="text" placeholder="АА1234ВВ" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase tracking-widest text-sm" value={newVisitData.plate} onChange={(e) => setNewVisitData({ ...newVisitData, plate: e.target.value.toUpperCase() })} onBlur={handlePlateBlur} />{foundExisting && <p className="text-emerald-600 text-[10px] font-black uppercase mt-1 ml-1">✓ З бази</p>}</div><div><label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">VIN</label><input type="text" placeholder="17 знаків" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-sm uppercase" value={newVisitData.vin_code} onChange={(e) => setNewVisitData({ ...newVisitData, vin_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) })} /></div></div><div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-3">Дані автомобіля</p><div className="grid grid-cols-2 gap-3"><InputSmall label="Марка" value={newVisitData.brand} onChange={(v) => setNewVisitData({ ...newVisitData, brand: v })} /><InputSmall label="Модель" value={newVisitData.model} onChange={(v) => setNewVisitData({ ...newVisitData, model: v })} /><InputSmall label="Рік" type="number" value={newVisitData.year} onChange={(v) => setNewVisitData({ ...newVisitData, year: v })} /><InputSmall label="Двигун см³" type="number" value={newVisitData.engine} onChange={(v) => setNewVisitData({ ...newVisitData, engine: v })} /><div className="col-span-2"><InputSmall label="Паливо" value={newVisitData.fuel} onChange={(v) => setNewVisitData({ ...newVisitData, fuel: v })} /></div></div><p className="text-[10px] font-bold text-amber-600 mt-3 bg-amber-50 border border-amber-100 rounded-xl p-2">Двигун після скану краще перевірити вручну перед збереженням.</p></div><button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-sm tracking-widest text-xs">Створити {isStore ? 'замовлення' : 'візит'}</button></form></div></div>;
}

function VisitModal(props) {
  const { selectedVisit, setSelectedVisit, visitTab, setVisitTab, selectedGroup, editCarData, setEditCarData, handleSaveCarData, copyText, copiedText, isStore, updateVisitField, isEditingTime, editTimeData, setEditTimeData, handleEditVisitDateTime, handleSaveVisitDateTime, setIsEditingTime, handlePrintPDF, handleCancelVisit } = props;
  const tabs = [
    ['overview', 'Огляд', Info], ['passport', 'Техпаспорт', CarFront], ['acceptance', 'Акт', FileText], ['diagnostic', 'Діагностика', ClipboardCheck], ['works', 'Роботи', Wrench], ['parts', 'Запчастини', Package], ['recommendations', 'Рекомендації', ClipboardList], ['summary', 'Підсумок', Calculator],
  ];
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-start justify-center p-0 sm:p-4 z-50 overflow-hidden no-print-area"><div className="bg-white w-full sm:max-w-5xl sm:rounded-3xl shadow-2xl sm:mt-8 sm:mb-16 relative flex flex-col h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-4rem)] min-w-0 overflow-hidden"><div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 shrink-0"><div className="flex flex-col md:flex-row justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 mb-2"><span className="bg-blue-600 text-white rounded-xl px-3 py-1 text-xs font-black uppercase flex items-center gap-1"><Hash size={13} /> Візит №{visitId(selectedVisit)}</span><span className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-xs font-black uppercase text-slate-500">{selectedVisit.status || 'SELECTION'}</span></div><h2 className="text-2xl md:text-3xl font-black uppercase leading-tight break-words">{selectedVisit.plate}</h2><p className="text-slate-500 text-[13px] font-bold flex flex-wrap items-center gap-2 mt-1"><CarFront size={14} /> {selectedVisit.client} <Phone size={14} /> {selectedVisit.phone}</p></div><div className="flex items-center gap-2 shrink-0 justify-end"><button onClick={handlePrintPDF} className="bg-blue-100 text-blue-600 p-2 rounded-xl hover:bg-blue-200 flex items-center gap-2 font-bold text-xs"><Printer size={18} /> Друк</button><button onClick={handleCancelVisit} className="bg-red-100 text-red-600 p-2 rounded-xl hover:bg-red-200 flex items-center gap-2 font-bold text-xs"><Trash2 size={18} /> Скасувати</button><button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 rounded-xl hover:bg-slate-200"><X size={18} /></button></div></div><div className="mt-4 flex gap-2 bg-white p-1.5 rounded-xl overflow-x-auto border border-slate-200"><button onClick={() => updateVisitField('status', 'PENDING')} className={`min-w-[90px] flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase ${['PENDING', 'DRAFT'].includes(selectedVisit.status) ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>{isStore ? 'Нове' : 'В черзі'}</button><button onClick={() => updateVisitField('status', 'IN_PROGRESS')} className={`min-w-[90px] flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase ${['IN_PROGRESS', 'ORDERED'].includes(selectedVisit.status) ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>{isStore ? 'Чекаємо' : 'В роботі'}</button><button onClick={() => updateVisitField('status', 'DONE')} className={`min-w-[90px] flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase ${selectedVisit.status === 'DONE' ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>{isStore ? 'Відправка' : 'Готово'}</button>{isStore && <button onClick={() => updateVisitField('status', 'COMPLETED')} className={`min-w-[90px] flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase ${selectedVisit.status === 'COMPLETED' ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>Виконано</button>}</div></div><div className="px-4 md:px-6 pt-4 bg-white border-b border-slate-100 overflow-x-auto shrink-0"><div className="flex gap-2 min-w-max pb-3">{tabs.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setVisitTab(key)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase whitespace-nowrap transition-all ${visitTab === key ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Icon size={15} /> {label}</button>)}</div></div><div className="p-4 md:p-6 overflow-y-auto flex-1 min-w-0">{visitTab === 'overview' && <OverviewTab selectedVisit={selectedVisit} editCarData={editCarData} copyText={copyText} copiedText={copiedText} handleEditVisitDateTime={handleEditVisitDateTime} isEditingTime={isEditingTime} editTimeData={editTimeData} setEditTimeData={setEditTimeData} handleSaveVisitDateTime={handleSaveVisitDateTime} setIsEditingTime={setIsEditingTime} />}{visitTab === 'passport' && <PassportTab editCarData={editCarData} setEditCarData={setEditCarData} handleSaveCarData={handleSaveCarData} selectedVisit={selectedVisit} copyText={copyText} />}{visitTab === 'acceptance' && <VisitWorkflowPanel selectedGroup={selectedGroup} lastVisit={selectedVisit} initialActive="acceptance" standalone />}{visitTab === 'diagnostic' && <VisitWorkflowPanel selectedGroup={selectedGroup} lastVisit={selectedVisit} initialActive="diagnostic" standalone />}{visitTab === 'works' && <WorksTab {...props} />}{visitTab === 'parts' && <PartsTab {...props} />}{visitTab === 'recommendations' && <RecommendationsTab selectedVisit={selectedVisit} />}{visitTab === 'summary' && <SummaryTab {...props} />}</div></div></div>;
}

function OverviewTab({ selectedVisit, editCarData, copyText, copiedText, handleEditVisitDateTime, isEditingTime, editTimeData, setEditTimeData, handleSaveVisitDateTime, setIsEditingTime }) {
  return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><InfoCard label="ID візиту" value={`№${visitId(selectedVisit)}`} action={<button onClick={() => copyText(visitId(selectedVisit))} className="text-xs font-black text-blue-600">{copiedText === String(visitId(selectedVisit)) ? 'Скопійовано' : 'Копіювати'}</button>} /><InfoCard label="Дата" value={visitDateText(selectedVisit)} /><InfoCard label="Сума" value={money(visitTotal(selectedVisit))} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><InfoCard label="Клієнт" value={selectedVisit.client} /><InfoCard label="Телефон" value={selectedVisit.phone} /><InfoCard label="Авто" value={`${editCarData.brand || '—'} ${editCarData.model || ''} ${editCarData.year || ''}`} /><InfoCard label="Пробіг" value={editCarData.mileage ? `${Number(editCarData.mileage).toLocaleString('uk-UA')} км` : '—'} /><InfoCard label="VIN" value={selectedVisit.vin_code || '—'} action={selectedVisit.vin_code && <button onClick={() => copyText(selectedVisit.vin_code)} className="text-xs font-black text-blue-600">{copiedText === selectedVisit.vin_code ? 'Скопійовано' : 'Копіювати'}</button>} wide /></div><div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between"><p className="font-black text-slate-800 flex items-center gap-2"><Clock size={16} /> Час запису</p><button onClick={handleEditVisitDateTime} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-600 flex items-center justify-center gap-1"><Pencil size={13} /> Змінити</button></div>{isEditingTime && <div className="mt-3 flex flex-col sm:flex-row gap-2"><input type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold" value={editTimeData.date} onChange={(e) => setEditTimeData({ ...editTimeData, date: e.target.value })} /><input type="time" className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold" value={editTimeData.time} onChange={(e) => setEditTimeData({ ...editTimeData, time: e.target.value })} /><button onClick={handleSaveVisitDateTime} className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white font-black uppercase">Зберегти</button><button onClick={() => setIsEditingTime(false)} className="text-xs px-3 py-2 rounded-lg bg-slate-200 text-slate-600 font-black uppercase">Скасувати</button></div>}</div></div>;
}

function PassportTab({ editCarData, setEditCarData, handleSaveCarData, selectedVisit, copyText }) {
  return <div className="space-y-4"><div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm font-semibold text-amber-700 flex gap-2"><AlertTriangle size={18} className="shrink-0" /> Після скану техпаспорта двигун краще перевіряти вручну. Тут можна спокійно виправити марку, модель, рік, двигун, паливо і пробіг.</div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"><InputBlock label="Марка" value={editCarData.brand} onChange={(v) => setEditCarData({ ...editCarData, brand: v })} /><InputBlock label="Модель" value={editCarData.model} onChange={(v) => setEditCarData({ ...editCarData, model: v })} /><InputBlock label="Рік" type="number" value={editCarData.year} onChange={(v) => setEditCarData({ ...editCarData, year: v })} /><InputBlock label="Двигун, см³" type="number" value={editCarData.engine} onChange={(v) => setEditCarData({ ...editCarData, engine: v })} /><InputBlock label="Паливо" value={editCarData.fuel} onChange={(v) => setEditCarData({ ...editCarData, fuel: v })} /><InputBlock label="Пробіг, км" type="number" value={editCarData.mileage} onChange={(v) => setEditCarData({ ...editCarData, mileage: v })} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><InfoCard label="Держ. номер" value={selectedVisit.plate} /><InfoCard label="VIN" value={selectedVisit.vin_code || '—'} action={selectedVisit.vin_code && <button onClick={() => copyText(selectedVisit.vin_code)} className="text-xs font-black text-blue-600">Копіювати</button>} /></div><button onClick={handleSaveCarData} className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase">Зберегти дані техпаспорта</button></div>;
}

function WorksTab({ selectedVisit, showServiceForm, setShowServiceForm, selectedCatalogId, setSelectedCatalogId, catalogServices, newService, setNewService, handleAddService, handleDeleteService }) {
  const services = getServices(selectedVisit);
  return <div><div className="flex justify-between items-center mb-3"><h3 className="font-black uppercase text-slate-700 flex items-center gap-2 text-sm"><Wrench size={16} /> Роботи</h3><button onClick={() => setShowServiceForm(!showServiceForm)} className="text-xs font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-xl">Додати роботу</button></div>{showServiceForm && <form onSubmit={handleAddService} className="bg-slate-50 border border-slate-200 p-3 rounded-xl mb-3 space-y-2"><select className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none" value={selectedCatalogId} onChange={(e) => { setSelectedCatalogId(e.target.value); const s = catalogServices.find((x) => x.id === parseInt(e.target.value)); if (s) setNewService({ name: s.name, price: s.price || s.default_price || '', quantity: 1 }); }}><option value="">-- Ввести вручну --</option>{catalogServices.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.price || s.default_price} ₴)</option>)}</select>{!selectedCatalogId && <input required type="text" placeholder="Назва роботи" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none" value={newService.name || ''} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />}<div className="flex gap-2"><input required type="number" placeholder="Ціна" className="w-1/2 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} /><input required type="number" step="0.1" placeholder="К-сть" className="w-1/2 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: e.target.value })} /></div><button type="submit" className="w-full bg-blue-600 text-white text-xs font-black uppercase py-2 rounded-lg">Зберегти роботу</button></form>}<div className="space-y-2">{services.length ? services.map((s) => <div key={s.id} className="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center shadow-sm"><div><p className="font-bold text-slate-700 text-sm">{s.name || s.custom_name}</p><p className="text-xs text-slate-400">{parseFloat(s.quantity || 1)} од. × {money(s.price)}</p></div><div className="flex items-center gap-3"><p className="font-black text-sm text-slate-800">{money(parseFloat(s.quantity || 1) * parseFloat(s.price || 0))}</p><button onClick={() => handleDeleteService(s.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></div>) : <p className="text-sm text-center text-slate-400 italic py-4">Немає доданих робіт</p>}</div></div>;
}

function PartsTab({ selectedVisit, getSupplierBadgeStyle, updatePartStatus, handleDeletePart, partStatusColors }) {
  const parts = getParts(selectedVisit);
  return <div><h3 className="font-black uppercase text-slate-700 mb-3 flex items-center gap-2 text-sm"><Store size={16} /> Запчастини</h3><div className="space-y-3">{parts.length ? parts.map((p) => <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1 overflow-hidden"><p className="font-bold text-slate-700 text-sm leading-tight truncate">{p.name}</p><p className="text-xs uppercase font-bold text-slate-500 mt-1 truncate">{p.brand} | {p.part_number || p.article}</p>{(p.supplier_name || p.supplier) && <p className={`text-[10px] font-bold mt-1 inline-flex items-center border px-2 py-0.5 rounded-full ${getSupplierBadgeStyle(p.supplier_name || p.supplier)}`}>Постачальник: {p.supplier_name || p.supplier}</p>}<p className="text-xs font-black text-blue-600 mt-1">{money(p.sell_price)}</p><p className="text-[10px] font-semibold text-slate-500">Постачальника: {money(p.buy_price)}</p></div><div className="flex items-center gap-2 w-full sm:w-auto"><select value={p.status || p.logistics_status || 'WAITING'} onChange={(e) => updatePartStatus(p.id, e.target.value)} className={`text-[11px] font-black uppercase rounded-xl px-3 py-2 outline-none cursor-pointer flex-1 sm:w-36 text-center shadow-sm border border-slate-200 ${partStatusColors[p.status || p.logistics_status || 'WAITING'] || partStatusColors.WAITING}`}><option value="WAITING">⏳ Очікується</option><option value="IN_TRANSIT">🚚 В дорозі</option><option value="ARRIVED">📦 Доставлено</option><option value="UNAVAILABLE">❌ Відмова</option></select><button onClick={() => handleDeletePart(p.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></div>) : <p className="text-sm text-center text-slate-400 italic py-4">Кошик запчастин порожній</p>}</div></div>;
}

function RecommendationsTab({ selectedVisit }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center"><ClipboardList className="mx-auto text-slate-300 mb-2" size={28} /><p className="font-black text-slate-700">Рекомендації по візиту №{visitId(selectedVisit)}</p><p className="text-sm font-semibold text-slate-400 mt-1">Рекомендації вже доступні у CRM клієнта. Тут залишено місце для наступного етапу — створення рекомендації прямо з діагностики.</p></div>; }

function SummaryTab({ selectedVisit, editComment, setEditComment, handleSaveComment, handlePrintPDF }) { const services = getServices(selectedVisit); const parts = getParts(selectedVisit); const servicesTotal = services.reduce((sum, s) => sum + Number(s.price || 0) * Number(s.quantity || 1), 0); const partsTotal = parts.reduce((sum, p) => sum + Number(p.sell_price || 0) * Number(p.quantity || 1), 0); return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><InfoCard label="Роботи" value={money(servicesTotal)} /><InfoCard label="Запчастини" value={money(partsTotal)} /><InfoCard label="Разом" value={money(servicesTotal + partsTotal)} /></div><div className="bg-amber-50 p-4 rounded-2xl border border-amber-100"><h3 className="font-black uppercase text-amber-800 mb-3 flex items-center gap-2 text-xs"><MessageSquare size={16} /> Внутрішній коментар</h3><textarea className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm outline-none focus:border-amber-400 min-h-[90px] font-medium text-slate-700" placeholder="Нотатка..." value={editComment} onChange={(e) => setEditComment(e.target.value)} /><div className="flex flex-col sm:flex-row justify-between gap-2 mt-3"><button onClick={handlePrintPDF} className="text-blue-600 font-black text-xs uppercase hover:underline flex items-center justify-center gap-1"><Printer size={14} /> Друкувати</button><button onClick={handleSaveComment} className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest">Зберегти коментар</button></div></div></div>; }

function InfoCard({ label, value, action, wide }) { return <div className={`bg-slate-50 border border-slate-100 rounded-2xl p-4 min-w-0 ${wide ? 'md:col-span-2' : ''}`}><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-sm mt-1 break-words">{value || '—'}</p>{action && <div className="mt-2">{action}</div>}</div>; }
function InputBlock({ label, value, onChange, type = 'text' }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><label className="text-[10px] font-black uppercase text-slate-400">{label}</label><input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" /></div>; }
function InputSmall({ label, value, onChange, type = 'text' }) { return <div><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 ml-0.5">{label}</label><input type={type} className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500" value={value || ''} onChange={(e) => onChange(e.target.value)} /></div>; }

export default Visits;
