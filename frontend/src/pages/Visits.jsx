import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Store, Pencil, List, Search, RefreshCcw, Trash2, Printer, MessageSquare, ChevronLeft, ChevronRight, Copy, Check, Truck, Package, CreditCard, Camera, ScanLine, Info, ImagePlus } from 'lucide-react';
import VisitCard from '../components/visits/VisitCard'; 
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

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
  
  const isStore = companyInfo?.business_type === 'store'; 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false); 
  const [showManualPartForm, setShowManualPartForm] = useState(false); 
  const [showServiceForm, setShowServiceForm] = useState(false);
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeData, setEditTimeData] = useState({ date: '', time: '' });
  
  const [editComment, setEditComment] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);
  
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  const [newVisitData, setNewVisitData] = useState({ 
    plate: '', vin_code: '', client: '', phone: '', date: '', time: '',
    delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '',
    brand: '', model: '', year: '', engine: '', fuel: ''
  });

  const [editCarData, setEditCarData] = useState({ brand: '', model: '', year: '', engine: '', fuel: '', mileage: '' });
  
  const [newService, setNewService] = useState({ name: '', price: '', quantity: 1 });
  const [newPart, setNewPart] = useState({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });

  const [copiedVin, setCopiedVin] = useState(null);

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  const partStatusColors = { 'WAITING': 'text-orange-600 bg-orange-100', 'IN_TRANSIT': 'text-blue-600 bg-blue-100', 'ARRIVED': 'text-green-600 bg-green-100', 'UNAVAILABLE': 'text-red-600 bg-red-100' };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterDate) params.append('date', filterDate);

      const [visitsRes, settingsRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/services/`, { headers: { Authorization: `Bearer ${token}` } }) 
      ]);
      setVisits(visitsRes.data || []);
      setRole(settingsRes.data.role);
      setCompanyInfo(settingsRes.data.company); 
      setPermissions(settingsRes.data.permissions || {}); 
      setCatalogServices(servicesRes.data || []);

      if (searchParams.get('scan') === 'true') {
        setIsCreatingVisit(true);
      }
    } catch (error) { 
        if (error.response?.status === 401) navigate('/login');
        setRole('owner'); 
    } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, filterDate, navigate, token]);

  useEffect(() => {
    if (location.state?.scannedData) {
      const sd = location.state.scannedData;
      setNewVisitData(prev => ({
        ...prev,
        plate: prev.plate || sd.plate || '',
        vin_code: prev.vin_code || sd.vin_code || '',
        brand: prev.brand || sd.brand || '',
        model: prev.model || sd.model || '',
        year: prev.year || sd.year || '',
        engine: prev.engine || sd.engine || '',
        fuel: prev.fuel || sd.fuel || ''
      }));
      setIsCreatingVisit(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (selectedVisit) {
      setEditComment(selectedVisit.comment || '');
      try {
        if (!isStore && selectedVisit.delivery_data && selectedVisit.delivery_data.startsWith('{')) {
          setEditCarData(JSON.parse(selectedVisit.delivery_data));
        } else {
          setEditCarData({ brand: '', model: '', year: '', engine: '', fuel: '', mileage: selectedVisit.mileage || '' });
        }
      } catch (e) {
        setEditCarData({ brand: '', model: '', year: '', engine: '', fuel: '', mileage: selectedVisit.mileage || '' });
      }
    }
  }, [selectedVisit?.id, selectedVisit?.delivery_data, isStore, selectedVisit?.mileage]);

  const handleSaveCarData = async () => {
    if (!isStore) {
      if (editCarData.mileage !== selectedVisit.mileage) {
        await updateVisitField('mileage', editCarData.mileage);
      }
      const carDataToSave = { ...editCarData };
      delete carDataToSave.mileage;
      
      const jsonString = JSON.stringify(carDataToSave);
      if (jsonString !== selectedVisit.delivery_data) {
        await updateVisitField('delivery_data', jsonString);
      }
    } else {
      const pureComment = selectedVisit.comment ? selectedVisit.comment.replace(/^\[Марка:.*?\|.*?\|.*?\|.*?\|.*?\]\s*/, '') : '';
      const newCommentStr = `[Марка: ${editCarData.brand} | Модель: ${editCarData.model} | Рік: ${editCarData.year} | Дв: ${editCarData.engine} | Паливо: ${editCarData.fuel}] ${pureComment}`.trim();
      if (newCommentStr !== selectedVisit.comment) {
        await updateVisitField('comment', newCommentStr);
      }
    }
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
        const MAX_WIDTH = 1200; const MAX_HEIGHT = 1200;
        let width = img.width; let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('document', blob, 'scan.jpg');
          try {
            const res = await axios.post(`${API_BASE}/api/visits/recognize_document/`, formData, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
              setNewVisitData(prev => ({
                ...prev,
                plate: prev.plate || res.data.plate || '',
                vin_code: prev.vin_code || res.data.vin_code || '',
                brand: prev.brand || res.data.brand || '',
                model: prev.model || res.data.model || '',
                year: prev.year || res.data.year || '', 
                engine: prev.engine || res.data.engine || '',
                fuel: prev.fuel || res.data.fuel || ''
              }));
            }
          } catch (error) {
            alert("Помилка сканування. Спробуйте інший ракурс.");
          } finally {
            setIsScanning(false);
            if (cameraInputRef.current) cameraInputRef.current.value = '';
            if (galleryInputRef.current) galleryInputRef.current.value = '';
          }
        }, 'image/jpeg', 0.8);
      };
    };
  };

  const handleCopyVin = (vin) => {
    if (!vin) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(vin).then(() => {
        setCopiedVin(vin); setTimeout(() => setCopiedVin(null), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = vin;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedVin(vin); setTimeout(() => setCopiedVin(null), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const changeDate = (days) => {
    let current = filterDate ? new Date(filterDate) : new Date();
    current.setDate(current.getDate() + days);
    setFilterDate(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  };

  const handlePlateBlur = async () => {
    if (!newVisitData.plate || newVisitData.plate.length < 3) return;
    try {
      const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers: { Authorization: `Bearer ${token}` } });
      const existing = res.data.find(v => v.plate.toUpperCase() === newVisitData.plate.toUpperCase());
      if (existing) {
        setNewVisitData(prev => ({ ...prev, client: existing.client, phone: existing.phone, vin_code: existing.vin_code || '' }));
        setFoundExisting(true); setTimeout(() => setFoundExisting(false), 4000); 
      }
    } catch (error) {}
  };

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    let scheduled_datetime = null;
    if (!isStore && newVisitData.date && newVisitData.time) {
      scheduled_datetime = new Date(`${newVisitData.date}T${newVisitData.time}`).toISOString();
    }
    const finalPlate = newVisitData.plate ? newVisitData.plate.toUpperCase() : (isStore ? `ORD-${Math.floor(Math.random()*100000)}` : '');

    const payload = {
        plate: finalPlate, vin_code: newVisitData.vin_code, client: newVisitData.client, phone: newVisitData.phone,
        scheduled_datetime: scheduled_datetime,
        delivery_type: isStore ? newVisitData.delivery_type : 'pickup',
        delivery_data: isStore ? newVisitData.delivery_data : '',
        payment_status: isStore ? newVisitData.payment_status : 'unpaid',
        prepayment_amount: isStore && newVisitData.payment_status === 'advance' ? (newVisitData.prepayment_amount || 0) : 0
    };
    
    if (!isStore) {
        payload.delivery_data = JSON.stringify({ brand: newVisitData.brand.trim(), model: newVisitData.model.trim(), year: newVisitData.year.trim(), engine: newVisitData.engine.trim(), fuel: newVisitData.fuel.trim() });
    } else {
        payload.comment = `[Марка: ${newVisitData.brand.trim()} | Модель: ${newVisitData.model.trim()} | Рік: ${newVisitData.year.trim()} | Дв: ${newVisitData.engine.trim()} | Паливо: ${newVisitData.fuel.trim()}]`.trim();
    }
    
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setIsCreatingVisit(false);
      setNewVisitData({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', brand: '', model: '', year: '', engine: '', fuel: '' });
      setSearchQuery(''); setFilterDate(''); fetchData();
    } catch (error) { alert("Помилка створення"); }
  };

  const updateVisitField = async (field, value) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { [field]: value }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, [field]: value }); fetchData();
    } catch (error) { alert("Помилка збереження"); }
  };

  const handleSaveComment = async () => {
    try {
      let finalComment = editComment;
      if (isStore) {
        finalComment = `[Марка: ${editCarData.brand} | Модель: ${editCarData.model} | Рік: ${editCarData.year} | Дв: ${editCarData.engine} | Паливо: ${editCarData.fuel}] ${editComment}`.trim();
      }
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { comment: finalComment }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, comment: finalComment }); fetchData();
    } catch (error) { alert("Помилка"); }
  };

  const updatePartStatus = async (id, newStatus) => {
    await axios.patch(`${API_BASE}/api/item/${id}/status/`, { logistics_status: newStatus }, { headers: { Authorization: `Bearer ${token}` } }); refreshSelectedVisit();
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
        await axios.post(`${API_BASE}/api/order-services/`, { 
            visit: selectedVisit.id, 
            name: newService.name,
            price: parseFloat(newService.price),
            quantity: parseFloat(newService.quantity)
        }, { headers: { Authorization: `Bearer ${token}` } });
        setNewService({ name: '', price: '', quantity: 1 }); setSelectedCatalogId(''); setShowServiceForm(false); refreshSelectedVisit();
    } catch(err) {
        alert("Помилка додавання послуги");
    }
  };

  const handlePrintPDF = async () => {
    try {
        window.open(`${API_BASE}/api/visits/${selectedVisit.id}/pdf/`, '_blank');
    } catch (error) {
        alert("Помилка генерації документа.");
    }
  };

  const refreshSelectedVisit = async () => {
    const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } }); setSelectedVisit(res.data); fetchData();
  };

  const pending = visits.filter(v => v.status === 'PENDING' || v.status === 'SELECTION' || v.status === 'DRAFT');
  const inProgress = visits.filter(v => v.status === 'IN_PROGRESS' || v.status === 'ORDERED');
  const done = visits.filter(v => v.status === 'DONE');
  const completed = visits.filter(v => v.status === 'COMPLETED'); 

  const Column = ({ title, icon, items, colorClass }) => (
    <div className="bg-slate-50/50 rounded-3xl p-4 flex flex-col border border-slate-100 no-print-area">
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${colorClass}`}>
        {icon} {title} <span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span>
      </h3>
      <div className="space-y-4 flex-1 pb-4">
        {items.map(visit => (
          <VisitCard key={visit.id} visit={visit} onClick={() => setSelectedVisit(visit)} isStore={isStore} />
        ))}
        {items.length === 0 && <div className="text-center text-slate-400 text-xs font-bold uppercase mt-10">Пусто</div>}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen flex flex-col w-full overflow-x-hidden">
      <style>{`
        input[type="date"], input[type="time"] { color: #334155 !important; -webkit-appearance: none; min-height: 42px; }
        @keyframes scan-laser { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .laser-line { position: absolute; left: 0; right: 0; height: 2px; background: #10b981; box-shadow: 0 0 15px 5px rgba(16, 185, 129, 0.4); animation: scan-laser 2s infinite linear; }
      `}</style>

      <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4 no-print-area shrink-0 mt-4 md:mt-0">
        <h1 className="text-2xl font-black uppercase italic w-full xl:w-auto">{isStore ? 'Замовлення' : 'Дошка Візитів'}</h1>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1 xl:justify-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Пошук (номер, клієнт)..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium shadow-sm transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm transition-all focus-within:border-blue-500 w-full md:w-auto">
            <button onClick={() => changeDate(-1)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ChevronLeft size={16}/></button>
            <input type="date" className="bg-transparent px-2 py-2 text-sm outline-none font-medium text-slate-700 cursor-pointer w-full text-center" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <button onClick={() => changeDate(1)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ChevronRight size={16}/></button>
          </div>
        </div>

        {(role === 'owner' || permissions?.can_create_visits) && (
           <button onClick={() => setIsCreatingVisit(true)} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] w-full xl:w-auto shrink-0">
             <Plus size={16}/> {isStore ? 'Нове замовлення' : 'Нове авто'}
           </button>
        )}
      </div>

      {isStore ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 flex-1 no-print-area">
          <Column title="Нові" icon={<Package size={18}/>} items={pending} colorClass="text-slate-600" />
          <Column title="Чекаємо деталі" icon={<Clock size={18}/>} items={inProgress} colorClass="text-orange-600" />
          <Column title="Відправка" icon={<Truck size={18}/>} items={done} colorClass="text-blue-600" />
          <Column title="Виконано" icon={<CheckCircle2 size={18}/>} items={completed} colorClass="text-green-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 no-print-area">
          <Column title="В черзі / Підбір" icon={<Clock size={18}/>} items={pending} colorClass="text-slate-600" />
          <Column title="В роботі / Замовлено" icon={<Wrench size={18}/>} items={inProgress} colorClass="text-blue-600" />
          <Column title="Готово" icon={<CheckCircle2 size={18}/>} items={done} colorClass="text-green-600" />
        </div>
      )}

      {/* МОДАЛКА СТВОРЕННЯ КАРТКИ */}
      {isCreatingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto no-print-area pt-10 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl relative overflow-hidden">
            {isScanning && (
              <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                <div className="relative w-48 h-32 border-2 border-emerald-500 rounded-lg mb-6 overflow-hidden bg-slate-800/50">
                  <div className="laser-line"></div>
                </div>
                <h3 className="text-white font-black text-xl mb-2">ШІ розпізнає документ...</h3>
                <p className="text-slate-400 text-sm font-medium">Читаємо дані з фотографії</p>
              </div>
            )}
            <button onClick={() => { setIsCreatingVisit(false); setFoundExisting(false); }} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 z-10"><X size={20} /></button>
            <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-blue-600">
              {isStore ? <><Package size={24}/> Нове замовлення</> : <><CarFront size={24}/> Новий візит</>}
            </h2>
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleScanDocument} />
            <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handleScanDocument} />
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <input required type="text" placeholder="ПІБ Клієнта" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm" value={newVisitData.client} onChange={e => setNewVisitData({...newVisitData, client: e.target.value})}/>
              <input required type="text" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm" value={newVisitData.phone} onChange={e => setNewVisitData({...newVisitData, phone: e.target.value})}/>
              <input required type="text" placeholder="Держ. Номер" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})} onBlur={handlePlateBlur} />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase text-xs mt-4">Створити</button>
            </form>
          </div>
        </div>
      )}

      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto no-print-area">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-4 md:p-6 shadow-2xl mt-4 sm:mt-8 mb-16 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-start mb-4 border-b border-slate-100 pb-3 gap-3">
              <div className="w-full">
                <h2 className="text-2xl md:text-3xl font-black uppercase leading-tight">{selectedVisit.plate}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Марка</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 uppercase" value={editCarData.brand} onChange={e => setEditCarData({...editCarData, brand: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Модель</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700" value={editCarData.model} onChange={e => setEditCarData({...editCarData, model: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Рік</label>
                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-600" value={editCarData.year} onChange={e => setEditCarData({...editCarData, year: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Дв. (см³)</label>
                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700" value={editCarData.engine} onChange={e => setEditCarData({...editCarData, engine: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Паливо</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700" value={editCarData.fuel} onChange={e => setEditCarData({...editCarData, fuel: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Пробіг (км)</label>
                    <input type="number" className="w-full bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs font-black text-amber-700" value={editCarData.mileage} onChange={e => setEditCarData({...editCarData, mileage: e.target.value})} onBlur={handleSaveCarData} placeholder="150000"/>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 justify-end w-full md:w-auto">
                <button onClick={handlePrintPDF} className="bg-blue-100 text-blue-600 p-2 rounded-xl hover:bg-blue-200 transition-colors flex items-center gap-2 font-bold text-xs"><Printer size={18} /> Друк</button>
                <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 rounded-xl hover:bg-slate-200 transition-colors"><X size={18} /></button>
              </div>
            </div>

            <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl mb-4 overflow-x-auto">
              <button onClick={() => updateVisitField('status', 'PENDING')} className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow' : 'text-slate-400'}`}>Черга</button>
              <button onClick={() => updateVisitField('status', 'IN_PROGRESS')} className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>В роботі</button>
              <button onClick={() => updateVisitField('status', 'DONE')} className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 text-white' : 'text-slate-400'}`}>Готово</button>
            </div>

            <div className={`grid grid-cols-1 ${!isStore ? 'lg:grid-cols-2' : ''} gap-6`}>
              {!isStore && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-black uppercase text-slate-700 text-sm"><Wrench size={16}/> Роботи</h3>
                    <button onClick={() => setShowServiceForm(!showServiceForm)} className="text-[10px] font-bold uppercase bg-slate-100 px-2 py-1 rounded">Додати</button>
                  </div>
                  {showServiceForm && (
                    <form onSubmit={handleAddService} className="bg-slate-50 p-3 rounded-xl mb-3 space-y-2">
                        <select className="w-full text-xs p-2" onChange={e => {
                            const s = catalogServices.find(x => x.id === parseInt(e.target.value));
                            if(s) setNewService({ name: s.name, price: s.price || s.default_price, quantity: 1 });
                        }}>
                            <option value="">Ввести вручну</option>
                            {catalogServices.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price || s.default_price} ₴)</option>)}
                        </select>
                        <input required type="text" placeholder="Назва" className="w-full p-2 text-xs border rounded" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})}/>
                        <input required type="number" placeholder="Ціна" className="w-full p-2 text-xs border rounded" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})}/>
                        <button type="submit" className="w-full bg-blue-600 text-white text-xs py-2 rounded">Зберегти</button>
                    </form>
                  )}
                  <div className="space-y-2">
                    {selectedVisit.services?.map(s => (
                        <div key={s.id} className="flex justify-between p-2 bg-slate-50 rounded text-xs">
                            <span>{s.name}</span>
                            <span className="font-bold">{(s.quantity * s.price).toFixed(2)} ₴</span>
                        </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                 <h3 className="font-black text-sm mb-3"><Store size={16}/> Запчастини</h3>
                 <div className="space-y-2">
                     {selectedVisit.items?.map(p => (
                         <div key={p.id} className="p-3 bg-slate-50 rounded text-xs flex justify-between">
                             <span>{p.name}</span>
                             <span className="font-bold">{p.sell_price} ₴</span>
                         </div>
                     ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
