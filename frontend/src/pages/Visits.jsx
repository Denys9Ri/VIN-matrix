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
          const parsedData = JSON.parse(selectedVisit.delivery_data);
          setEditCarData({ ...parsedData, mileage: parsedData.mileage || '' });
        } else {
          setEditCarData({ brand: '', model: '', year: '', engine: '', fuel: '', mileage: '' });
        }
      } catch (e) {
        setEditCarData({ brand: '', model: '', year: '', engine: '', fuel: '', mileage: '' });
      }
    }
  }, [selectedVisit?.id, selectedVisit?.delivery_data, isStore]);

  const handleSaveCarData = async () => {
    if (!isStore) {
      // ПРАВИЛЬНЕ ЗБЕРЕЖЕННЯ ПРОБІГУ В JSON
      const carDataToSave = { ...editCarData };
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

  // ФІКС КОПІЮВАННЯ VIN (Безпечно)
  const handleCopyVin = (vin) => {
    if (!vin) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(vin).then(() => {
        setCopiedVin(vin); setTimeout(() => setCopiedVin(null), 2000);
      }).catch(() => fallbackCopy(vin));
    } else {
      fallbackCopy(vin);
    }
  };

  const fallbackCopy = (text) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedVin(text); setTimeout(() => setCopiedVin(null), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
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
        payload.delivery_data = JSON.stringify({ brand: newVisitData.brand.trim(), model: newVisitData.model.trim(), year: newVisitData.year.trim(), engine: newVisitData.engine.trim(), fuel: newVisitData.fuel.trim(), mileage: '' });
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

  // ФІКС 3: Оновлення статусу запчастини йде у вірну таблицю
  const updatePartStatus = async (id, newStatus) => {
    try {
        await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } }); 
        refreshSelectedVisit();
    } catch (e) {
        alert("Помилка оновлення статусу");
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
        await axios.post(`${API_BASE}/api/order-services/`, { 
            visit: selectedVisit.id, 
            name: newService.name,
            price: parseFloat(newService.price || 0),
            quantity: parseFloat(newService.quantity || 1)
        }, { headers: { Authorization: `Bearer ${token}` } });
        setNewService({ name: '', price: '', quantity: 1 }); setSelectedCatalogId(''); setShowServiceForm(false); refreshSelectedVisit();
    } catch(err) {
        alert("Помилка додавання послуги");
    }
  };

  const handleDeleteService = async (id) => {
    if (window.confirm("Видалити цю роботу?")) {
        try {
            await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
            refreshSelectedVisit();
        } catch(e) { alert("Помилка видалення роботи"); }
    }
  };

  const handleDeletePart = async (id) => {
    if (window.confirm("Видалити цю запчастину?")) {
        try {
            await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
            refreshSelectedVisit();
        } catch(e) { alert("Помилка видалення запчастини"); }
    }
  };

  const handlePrintPDF = async () => {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      alert('Браузер заблокував вікно друку. Дозвольте pop-up для цього сайту.');
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/pdf/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
      });

      printWindow.document.open();
      printWindow.document.write(response.data);
      printWindow.document.close();
    } catch (error) {
      printWindow.close();
      alert('Не вдалося згенерувати документ для друку.');
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
              
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col gap-3 mb-2 shadow-sm">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-emerald-600 shrink-0 mt-0.5"/>
                  <p className="text-[10px] md:text-[11px] font-bold text-emerald-800 leading-tight">
                    Зробіть <strong>два фото</strong>: спочатку лицьову сторону (Держ. номер, Рік), потім зворотну (VIN, Марка, Двигун, Паливо).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button type="button" onClick={() => cameraInputRef.current && cameraInputRef.current.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm font-black text-[10px] uppercase">
                    <Camera size={16} /> Камера
                  </button>
                  <button type="button" onClick={() => galleryInputRef.current && galleryInputRef.current.click()} className="bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm font-black text-[10px] uppercase">
                    <ImagePlus size={16} /> З галереї
                  </button>
                </div>
              </div>

              {!isStore && (
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Дата приїзду</label>
                    <input required type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 font-bold text-slate-700 text-sm" value={newVisitData.date} onChange={e => setNewVisitData({...newVisitData, date: e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Час</label>
                    <input required type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 font-bold text-slate-700 text-sm" value={newVisitData.time} onChange={e => setNewVisitData({...newVisitData, time: e.target.value})}/>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required type="text" placeholder="ПІБ Клієнта" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={newVisitData.client} onChange={e => setNewVisitData({...newVisitData, client: e.target.value})}/>
                <input required type="text" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={newVisitData.phone} onChange={e => setNewVisitData({...newVisitData, phone: e.target.value})}/>
              </div>

              {isStore && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex gap-2">
                    <select className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none" value={newVisitData.delivery_type} onChange={e => setNewVisitData({...newVisitData, delivery_type: e.target.value})}>
                      <option value="pickup">Самовивіз</option>
                      <option value="np">Нова Пошта</option>
                      <option value="courier">Кур'єр</option>
                    </select>
                    <select className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none" value={newVisitData.payment_status} onChange={e => setNewVisitData({...newVisitData, payment_status: e.target.value})}>
                      <option value="unpaid">Не оплачено</option>
                      <option value="advance">Передоплата</option>
                      <option value="paid">Оплачено</option>
                      <option value="cod">Накладений платіж</option>
                    </select>
                  </div>
                  {newVisitData.payment_status === 'advance' && (
                    <input type="number" placeholder="Внесена сума (₴)" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-black text-blue-600 outline-none" value={newVisitData.prepayment_amount} onChange={e => setNewVisitData({...newVisitData, prepayment_amount: e.target.value})}/>
                  )}
                  {newVisitData.delivery_type === 'np' && (
                    <textarea placeholder="Місто, Відділення..." className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm outline-none resize-none font-medium" rows="2" value={newVisitData.delivery_data} onChange={e => setNewVisitData({...newVisitData, delivery_data: e.target.value})}/>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Держ. Номер</label>
                  <input required={!isStore} type="text" placeholder="АА1234ВВ" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase tracking-widest text-sm" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})} onBlur={handlePlateBlur} />
                  {foundExisting && <p className="text-emerald-600 text-[10px] font-black uppercase mt-1 ml-1">✓ З бази</p>}
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">VIN-Код</label>
                  <input type="text" placeholder="17 знаків" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-sm tracking-wider uppercase" value={newVisitData.vin_code} onChange={e => setNewVisitData({...newVisitData, vin_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)})}/>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-inner">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1.5 mb-3">Дані автомобіля</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 ml-0.5">Марка</label>
                    <input type="text" placeholder="HONDA" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500 uppercase" value={newVisitData.brand} onChange={e => setNewVisitData({...newVisitData, brand: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 ml-0.5">Модель</label>
                    <input type="text" placeholder="CR-V" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500" value={newVisitData.model} onChange={e => setNewVisitData({...newVisitData, model: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 ml-0.5">Рік</label>
                    <input type="number" placeholder="2011" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-blue-600 outline-none focus:border-blue-500" value={newVisitData.year} onChange={e => setNewVisitData({...newVisitData, year: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 ml-0.5">Двигун (см³)</label>
                    <input type="number" placeholder="1995" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500" value={newVisitData.engine} onChange={e => setNewVisitData({...newVisitData, engine: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 ml-0.5">Паливо</label>
                  <input type="text" placeholder="Газ/Бензин" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-500" value={newVisitData.fuel} onChange={e => setNewVisitData({...newVisitData, fuel: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-sm transition-all tracking-widest text-xs mt-4">
                Створити {isStore ? 'замовлення' : 'візит'}
              </button>
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
                {selectedVisit.vin_code && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 mb-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md border border-slate-200 break-all">VIN: {selectedVisit.vin_code}</span>
                    <button onClick={() => handleCopyVin(selectedVisit.vin_code)} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-md transition-colors border border-slate-200 hover:border-blue-200 shrink-0">
                      {copiedVin === selectedVisit.vin_code ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Марка</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 uppercase" value={editCarData.brand} onChange={e => setEditCarData({...editCarData, brand: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Модель</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500" value={editCarData.model} onChange={e => setEditCarData({...editCarData, model: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Рік</label>
                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-600 outline-none focus:border-blue-500" value={editCarData.year} onChange={e => setEditCarData({...editCarData, year: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Дв. (см³)</label>
                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500" value={editCarData.engine} onChange={e => setEditCarData({...editCarData, engine: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Паливо</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500" value={editCarData.fuel} onChange={e => setEditCarData({...editCarData, fuel: e.target.value})} onBlur={handleSaveCarData}/>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1 block">Пробіг (км)</label>
                    <input type="number" className="w-full bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs font-black text-amber-700 outline-none focus:border-amber-500" value={editCarData.mileage} onChange={e => setEditCarData({...editCarData, mileage: e.target.value})} onBlur={handleSaveCarData} placeholder="150000"/>
                  </div>
                </div>

                <p className="text-slate-500 text-[13px] font-bold flex flex-wrap items-center gap-2 mt-1"><CarFront size={14} className="shrink-0"/> {selectedVisit.client} | <Phone size={14} className="shrink-0"/> {selectedVisit.phone}</p>
                
                {isStore && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1"><Truck size={12}/> Доставка</p>
                      <select value={selectedVisit.delivery_type || 'pickup'} onChange={e => updateVisitField('delivery_type', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none cursor-pointer mb-2">
                        <option value="pickup">Самовивіз</option>
                        <option value="np">Нова Пошта</option>
                        <option value="courier">Кур'єр</option>
                      </select>
                      {selectedVisit.delivery_type === 'np' && (
                        <textarea value={selectedVisit.delivery_data || ''} onChange={e => updateVisitField('delivery_data', e.target.value)} placeholder="Місто, Відділення..." className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none resize-none" rows="2" />
                      )}
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5 flex items-center gap-1"><CreditCard size={12}/> Статус оплати</p>
                      <select value={selectedVisit.payment_status || 'unpaid'} onChange={e => updateVisitField('payment_status', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none cursor-pointer">
                        <option value="unpaid">❌ Не оплачено</option>
                        <option value="advance">💳 Передоплата</option>
                        <option value="paid">✅ Оплачено повністю</option>
                        <option value="cod">📦 Накладений платіж</option>
                      </select>
                      
                      {selectedVisit.payment_status === 'advance' && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Аванс</label>
                          <input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-black text-blue-600 outline-none" value={selectedVisit.prepayment_amount || ''} onChange={(e) => updateVisitField('prepayment_amount', e.target.value)} placeholder="500"/>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 justify-end w-full md:w-auto">
                <button onClick={handlePrintPDF} className="bg-blue-100 text-blue-600 p-2 rounded-xl hover:bg-blue-200 transition-colors flex items-center gap-2 font-bold text-xs"><Printer size={18} /> Друк</button>
                <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 rounded-xl hover:bg-slate-200 transition-colors"><X size={18} /></button>
              </div>
            </div>

            <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl mb-4 overflow-x-auto">
              <button onClick={() => updateVisitField('status', 'PENDING')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'PENDING' || selectedVisit.status === 'DRAFT' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>{isStore ? 'Нове' : 'В черзі'}</button>
              <button onClick={() => updateVisitField('status', 'IN_PROGRESS')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' || selectedVisit.status === 'ORDERED' ? 'bg-blue-600 shadow shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>{isStore ? 'Чекаємо' : 'В роботі'}</button>
              <button onClick={() => updateVisitField('status', 'DONE')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>{isStore ? 'Відправка' : 'Готово'}</button>
              {isStore && <button onClick={() => updateVisitField('status', 'COMPLETED')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'COMPLETED' ? 'bg-green-500 shadow shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Виконано</button>}
            </div>

            <div className={`grid grid-cols-1 ${!isStore ? 'lg:grid-cols-2' : ''} gap-6`}>
              
              {/* РОБОТИ / ПОСЛУГИ */}
              {!isStore && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-black uppercase text-slate-700 flex items-center gap-2 text-sm"><Wrench size={16}/> Роботи</h3>
                    <button onClick={() => setShowServiceForm(!showServiceForm)} className="text-[10px] font-bold uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded">Додати роботу</button>
                  </div>
                  
                  {showServiceForm && (
                    <form onSubmit={handleAddService} className="bg-slate-50 border border-slate-200 p-3 rounded-xl mb-3 space-y-2">
                      <select className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none" value={selectedCatalogId} onChange={e => {
                          setSelectedCatalogId(e.target.value);
                          const s = catalogServices.find(x => x.id === parseInt(e.target.value));
                          if (s) setNewService({ name: s.name, price: s.price || s.default_price || '', quantity: 1 });
                      }}>
                        <option value="">-- Ввести вручну --</option>
                        {catalogServices.map(s => <option key={s.id} value={s.id}>{s.name} ({(s.price || s.default_price)} ₴)</option>)}
                      </select>
                      {!selectedCatalogId && (
                        <input required type="text" placeholder="Назва роботи" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none" value={newService.name || ''} onChange={e => setNewService({...newService, name: e.target.value})}/>
                      )}
                      <div className="flex gap-2">
                        <input required type="number" placeholder="Ціна (₴)" className="w-1/2 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})}/>
                        <input required type="number" step="0.1" placeholder="К-сть / Н-Г" className="w-1/2 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={newService.quantity} onChange={e => setNewService({...newService, quantity: e.target.value})}/>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase py-2 rounded-lg">Зберегти роботу</button>
                    </form>
                  )}

                  <div className="space-y-2 mb-3">
                    {(selectedVisit.services || selectedVisit.orderservice_set) && (selectedVisit.services || selectedVisit.orderservice_set).length > 0 ? (
                      (selectedVisit.services || selectedVisit.orderservice_set).map(s => (
                        <div key={s.id} className="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                          <div className="flex-1 pr-2">
                            <p className="font-bold text-slate-700 text-xs">{s.name || s.custom_name}</p>
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">{parseFloat(s.quantity || 1)} од. × {parseFloat(s.price || 0)} ₴</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-black text-sm text-slate-800">
                              {(parseFloat(s.quantity || 1) * parseFloat(s.price || 0)).toFixed(2)} ₴
                            </div>
                            <button onClick={() => handleDeleteService(s.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors" title="Видалити роботу">
                                <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-center text-slate-400 italic py-4">Немає доданих робіт</p>
                    )}
                  </div>
                </div>
              )}

              {/* ЗАПЧАСТИНИ */}
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-3 flex items-center gap-2 text-sm"><Store size={16}/> Запчастини</h3>
                <div className="space-y-3 mb-3">
                  {(selectedVisit.parts || selectedVisit.items) && (selectedVisit.parts || selectedVisit.items).length > 0 ? (
                    (selectedVisit.parts || selectedVisit.items).map(p => (
                      <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-3 group w-full shadow-sm">
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-slate-700 text-sm leading-tight truncate">{p.name}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 truncate">{p.brand} | {p.part_number || p.article}</p>
                          {(p.supplier_name || p.supplier) && (
                            <p className={`text-[10px] font-bold mt-1 inline-flex items-center border px-2 py-0.5 rounded-full ${getSupplierBadgeStyle(p.supplier_name || p.supplier)}`}>
                              Постачальник: {p.supplier_name || p.supplier}
                            </p>
                          )}
                          <p className="text-[11px] font-black text-blue-600 mt-1">{p.sell_price} ₴</p>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto shrink-0">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <select value={p.status || p.logistics_status || 'WAITING'} onChange={(e) => updatePartStatus(p.id, e.target.value)} className={`appearance-none block text-[11px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none cursor-pointer flex-1 sm:w-36 text-center shadow-sm border border-slate-200/50 mt-1 ${partStatusColors[p.status || p.logistics_status || 'WAITING'] || partStatusColors['WAITING']}`}>
                              <option value="WAITING">⏳ Очікується</option>
                              <option value="IN_TRANSIT">🚚 В дорозі</option>
                              <option value="ARRIVED">📦 Доставлено</option>
                              <option value="UNAVAILABLE">❌ Відмова</option>
                            </select>
                            <button onClick={() => handleDeletePart(p.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1" title="Видалити запчастину">
                                <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                     <p className="text-xs text-center text-slate-400 italic py-4">Кошик запчастин порожній</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 bg-amber-50 p-4 md:p-5 rounded-2xl border border-amber-100 relative">
              <h3 className="font-black uppercase text-amber-800 mb-3 flex items-center gap-2 text-xs"><MessageSquare size={16}/> Внутрішній коментар</h3>
              <textarea className="w-full bg-white border border-amber-200 rounded-xl p-3 md:p-4 text-sm outline-none focus:border-amber-400 min-h-[70px] font-medium text-slate-700" placeholder="Нотатка (напр. номер ТТН)..." value={editComment} onChange={e => setEditComment(e.target.value)} />
              <div className="flex justify-between items-center mt-3">
                <button onClick={handlePrintPDF} className="text-blue-600 font-black text-xs uppercase hover:underline flex items-center gap-1"><Printer size={14}/> Друкувати</button>
                <button onClick={handleSaveComment} className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm w-full sm:w-auto">Зберегти коментар</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
