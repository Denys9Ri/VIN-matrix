import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Store, Pencil, List, Search, RefreshCcw, Trash2, Printer, MessageSquare, ChevronLeft, ChevronRight, Copy, Check, Truck, Package, CreditCard, Camera, ScanLine } from 'lucide-react';
import VisitCard from '../components/visits/VisitCard'; 
import { useNavigate, useSearchParams } from 'react-router-dom';

const Visits = () => {
  const navigate = useNavigate();
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
  
  // === СТАН ДЛЯ СКАНУВАННЯ ТЕХПАСПОРТА ===
  const fileInputRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeData, setEditTimeData] = useState({ date: '', time: '' });
  
  const [editComment, setEditComment] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);
  
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  const [newVisitData, setNewVisitData] = useState({ 
    plate: '', vin_code: '', client: '', phone: '', date: '', time: '',
    delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', brand_model: ''
  });
  
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newPart, setNewPart] = useState({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });

  const [copiedVin, setCopiedVin] = useState(null);

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  const partStatusColors = { 'WAITING': 'text-orange-600 bg-orange-100', 'IN_TRANSIT': 'text-blue-600 bg-blue-100', 'ARRIVED': 'text-green-600 bg-green-100', 'UNAVAILABLE': 'text-red-600 bg-red-100' };
  const serviceStatusColors = { 'PENDING': 'text-slate-600 bg-slate-100', 'IN_PROGRESS': 'text-blue-600 bg-blue-100', 'DONE': 'text-green-600 bg-green-100' };

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

      // Відкриваємо модалку автоматично, якщо прийшли з Панелі по кнопці "Скан"
      if (searchParams.get('scan') === 'true') {
        setIsCreatingVisit(true);
        setTimeout(() => {
          if (fileInputRef.current) fileInputRef.current.click();
        }, 500);
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

  // === ЛОГІКА СКАНУВАННЯ ===
  const handleScanDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await axios.post(`${API_BASE}/api/visits/recognize_document/`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (res.data.success) {
        console.log("ОРИГІНАЛЬНИЙ ТЕКСТ З ТЕХПАСПОРТА:", res.data.raw_text);
        
        setNewVisitData(prev => ({
          ...prev,
          plate: res.data.plate || prev.plate,
          vin_code: res.data.vin_code || prev.vin_code,
          brand_model: res.data.brand_model || prev.brand_model
        }));
        
        if (res.data.plate) {
           const checkRes = await axios.get(`${API_BASE}/api/visits/?search=${res.data.plate}`, { headers: { Authorization: `Bearer ${token}` } });
           const existing = checkRes.data.find(v => v.plate.toUpperCase() === res.data.plate.toUpperCase());
           if (existing) {
             setNewVisitData(prev => ({ ...prev, client: existing.client, phone: existing.phone }));
             setFoundExisting(true);
             setTimeout(() => setFoundExisting(false), 4000);
           }
        }
      }
    } catch (error) {
      alert("Не вдалося розпізнати документ. Спробуйте інше фото або введіть вручну.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopyVin = (vin) => {
    if (!vin) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(vin).then(() => {
        setCopiedVin(vin);
        setTimeout(() => setCopiedVin(null), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = vin;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedVin(vin);
        setTimeout(() => setCopiedVin(null), 2000);
      } catch (err) {}
      document.body.removeChild(textArea);
    }
  };

  const changeDate = (days) => {
    let current = filterDate ? new Date(filterDate) : new Date();
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setFilterDate(`${year}-${month}-${day}`);
  };

  const handlePlateBlur = async () => {
    if (!newVisitData.plate || newVisitData.plate.length < 3) return;
    try {
      const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers: { Authorization: `Bearer ${token}` } });
      const existing = res.data.find(v => v.plate.toUpperCase() === newVisitData.plate.toUpperCase());
      if (existing) {
        setNewVisitData(prev => ({ ...prev, client: existing.client, phone: existing.phone, vin_code: existing.vin_code || '' }));
        setFoundExisting(true);
        setTimeout(() => setFoundExisting(false), 4000); 
      }
    } catch (error) {}
  };

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    let scheduled_datetime = null;
    
    if (!isStore && newVisitData.date && newVisitData.time) {
      const localDate = new Date(`${newVisitData.date}T${newVisitData.time}`);
      scheduled_datetime = localDate.toISOString();
    }
    
    const finalPlate = newVisitData.plate ? newVisitData.plate.toUpperCase() : (isStore ? `ORD-${Math.floor(Math.random()*100000)}` : '');

    const payload = {
        plate: finalPlate,
        vin_code: newVisitData.vin_code, 
        client: newVisitData.client,
        phone: newVisitData.phone,
        scheduled_datetime: scheduled_datetime,
        delivery_type: isStore ? newVisitData.delivery_type : 'pickup',
        delivery_data: isStore ? newVisitData.delivery_data : '',
        payment_status: isStore ? newVisitData.payment_status : 'unpaid',
        prepayment_amount: isStore && newVisitData.payment_status === 'advance' ? (newVisitData.prepayment_amount || 0) : 0
    };
    
    if (newVisitData.brand_model && !payload.comment) {
        payload.comment = `Авто: ${newVisitData.brand_model}`;
    }
    
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setIsCreatingVisit(false);
      setNewVisitData({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '', delivery_type: 'pickup', delivery_data: '', payment_status: 'unpaid', prepayment_amount: '', brand_model: '' });
      
      if (searchParams.get('scan')) {
          navigate('/visits'); 
      } else {
          setSearchQuery(''); setFilterDate(''); fetchData();
      }
      
    } catch (error) { alert("Помилка створення"); }
  };

  const handleDeleteVisit = async () => {
    if (window.confirm("Ви дійсно хочете видалити НАЗАВЖДИ?")) {
      try {
        await axios.delete(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } });
        setSelectedVisit(null); fetchData();
      } catch (error) { alert("Помилка видалення"); }
    }
  };

  const handleUpdateTime = async () => {
    if (!editTimeData.date || !editTimeData.time) return alert("Оберіть дату і час!");
    let scheduled_datetime = new Date(`${editTimeData.date}T${editTimeData.time}`).toISOString();
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { scheduled_datetime }, { headers: { Authorization: `Bearer ${token}` } });
      setIsEditingTime(false); refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const updateVisitField = async (field, value) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { [field]: value }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, [field]: value });
      fetchData();
    } catch (error) { alert("Помилка збереження"); }
  };

  const handleSaveComment = async () => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { comment: editComment }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, comment: editComment });
      fetchData();
    } catch (error) { alert("Помилка"); }
  };

  const updateServiceStatus = async (id, newStatus) => {
    await axios.patch(`${API_BASE}/api/order-services/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
    refreshSelectedVisit();
  };

  const updatePartStatus = async (id, newStatus) => {
    await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
    refreshSelectedVisit();
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/api/order-services/`, { ...newService, visit: selectedVisit.id }, { headers: { Authorization: `Bearer ${token}` } });
    setNewService({ name: '', price: '' }); setSelectedCatalogId(''); refreshSelectedVisit();
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/api/order-parts/`, { ...newPart, visit: selectedVisit.id, supplier: newPart.supplier || 'Вручну' }, { headers: { Authorization: `Bearer ${token}` } });
    setNewPart({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });
    setShowManualPartForm(false); refreshSelectedVisit();
  };

  const handleDeleteService = async (id) => {
    if(window.confirm("Видалити?")) { await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers: { Authorization: `Bearer ${token}` } }); refreshSelectedVisit(); }
  };

  const handleDeletePart = async (id) => {
    if(window.confirm("Видалити?")) { await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers: { Authorization: `Bearer ${token}` } }); refreshSelectedVisit(); }
  };

  const refreshSelectedVisit = async () => {
    const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } });
    setSelectedVisit(res.data); fetchData();
  };

  const servicesTotal = selectedVisit?.services?.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) || 0;
  const partsTotal = selectedVisit?.parts?.reduce((sum, p) => sum + parseFloat(p.sell_price || 0), 0) || 0;
  const grandTotal = servicesTotal + partsTotal;

  const handlePrint = () => { window.print(); };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">VIN-MATRIX ЗАВАНТАЖЕННЯ...</div>;

  const pending = visits.filter(v => v.status === 'PENDING' || v.status === 'SELECTION');
  const inProgress = visits.filter(v => v.status === 'IN_PROGRESS');
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
        
        /* Анімація лазера для сканера */
        @keyframes scan-laser {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .laser-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: #10b981;
          box-shadow: 0 0 15px 5px rgba(16, 185, 129, 0.4);
          animation: scan-laser 2s infinite linear;
        }
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

          {(searchQuery || filterDate) && (
            <button onClick={() => {setSearchQuery(''); setFilterDate('');}} className="bg-slate-100 text-slate-500 px-4 py-3 rounded-xl hover:bg-slate-200 transition-all font-black text-xs uppercase w-full md:w-auto">Скинути</button>
          )}
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
          <Column title="В роботі" icon={<Wrench size={18}/>} items={inProgress} colorClass="text-blue-600" />
          <Column title="Готово" icon={<CheckCircle2 size={18}/>} items={done} colorClass="text-green-600" />
        </div>
      )}

      {/* МОДАЛКА СТВОРЕННЯ ВІЗИТУ */}
      {isCreatingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto no-print-area pt-10 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl relative overflow-hidden">
            
            {/* Оверлей Сканування */}
            {isScanning && (
              <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                <div className="relative w-48 h-32 border-2 border-emerald-500 rounded-lg mb-6 overflow-hidden bg-slate-800/50">
                  <div className="laser-line"></div>
                  <ScanLine size={48} className="text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30" />
                </div>
                <h3 className="text-white font-black text-xl mb-2">ШІ розпізнає документ...</h3>
                <p className="text-slate-400 text-sm font-medium">Читаємо VIN, номер та модель авто</p>
              </div>
            )}

            <button onClick={() => { 
              setIsCreatingVisit(false); 
              setFoundExisting(false); 
              if (searchParams.get('scan')) navigate('/visits');
            }} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 z-10"><X size={20} /></button>
            
            <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-blue-600">
              {isStore ? <><Package size={24}/> Нове замовлення</> : <><CarFront size={24}/> Новий візит</>}
            </h2>
            
            {/* ПРИХОВАНИЙ ІНПУТ ДЛЯ ФАЙЛУ/КАМЕРИ */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleScanDocument} 
            />

            <form onSubmit={handleCreateVisit} className="space-y-4">
              
              {!isStore && (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 py-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors mb-4 group"
                >
                  <Camera size={28} className="group-hover:scale-110 transition-transform" />
                  <span className="font-black uppercase tracking-widest text-[10px]">Сканувати техпаспорт (ШІ)</span>
                </button>
              )}

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

              <div>
                <input required={!isStore} type="text" placeholder={isStore ? "Номер замовлення / авто (необов'язково)" : "НОМЕР АВТО (АА1234ВВ)"} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase tracking-widest text-sm" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})} onBlur={handlePlateBlur} />
                {foundExisting && <p className="text-emerald-600 text-[10px] font-bold uppercase mt-1 ml-2">✓ Дані підтягнуто з бази</p>}
              </div>

              {!isStore && (
                <>
                  <input type="text" placeholder="VIN-КОД (Англ. букви та цифри)" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-sm tracking-widest uppercase" value={newVisitData.vin_code} onChange={e => setNewVisitData({...newVisitData, vin_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)})}/>
                  {newVisitData.brand_model && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                      <CarFront size={16}/> Розпізнано: {newVisitData.brand_model}
                    </div>
                  )}
                </>
              )}

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-sm transition-all tracking-widest text-xs mt-4">
                Створити
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Далі йде блок детального перегляду візиту (selectedVisit) - залишається без змін */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto no-print-area">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-4 md:p-6 shadow-2xl mt-4 sm:mt-8 mb-16 relative">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-start mb-4 border-b border-slate-100 pb-3 gap-3">
              <div className="w-full">
                <h2 className="text-2xl md:text-3xl font-black uppercase leading-tight">{selectedVisit.plate}</h2>
                
                {selectedVisit.vin_code && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 mb-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md border border-slate-200 break-all">
                      VIN: {selectedVisit.vin_code}
                    </span>
                    <button onClick={() => handleCopyVin(selectedVisit.vin_code)} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-md transition-colors border border-slate-200 hover:border-blue-200 shrink-0">
                      {copiedVin === selectedVisit.vin_code ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}

                <p className="text-slate-500 text-[13px] font-bold flex flex-wrap items-center gap-2 mt-1"><CarFront size={14} className="shrink-0"/> {selectedVisit.client} <span className="hidden sm:inline">|</span> <Phone size={14} className="shrink-0"/> {selectedVisit.phone}</p>
                
                {isStore ? (
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
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Аванс (Внесена сума)</label>
                          <input 
                            type="number" 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-black text-blue-600 outline-none"
                            value={selectedVisit.prepayment_amount || ''}
                            onChange={(e) => updateVisitField('prepayment_amount', e.target.value)}
                            placeholder="Наприклад: 500"
                          />
                          <div className="mt-2 flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-black uppercase text-slate-500">Залишок до сплати:</span>
                            <span className="text-sm font-black text-red-500">
                              {(grandTotal - (parseFloat(selectedVisit.prepayment_amount) || 0)).toLocaleString()} ₴
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    {!isEditingTime ? (
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold group">
                        <Clock size={12}/>
                        <span>Запис: {selectedVisit.scheduled_datetime ? new Date(selectedVisit.scheduled_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Без дати'}</span>
                        {(role === 'owner' || permissions?.can_create_visits) && (
                          <button onClick={() => {
                            const d = selectedVisit.scheduled_datetime ? new Date(selectedVisit.scheduled_datetime) : new Date();
                            setEditTimeData({ date: d.toLocaleDateString('en-CA'), time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
                            setIsEditingTime(true);
                          }} className="text-blue-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 p-1 rounded">
                            <Pencil size={12}/> Редагувати
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 max-w-sm mt-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Новий час візиту</label>
                        <div className="flex gap-2 mb-2">
                          <input type="date" className="flex-1 bg-white border border-slate-200 outline-none text-slate-700 rounded-lg p-2 text-xs font-bold" value={editTimeData.date} onChange={e => setEditTimeData({...editTimeData, date: e.target.value})} />
                          <input type="time" className="w-24 bg-white border border-slate-200 outline-none text-slate-700 rounded-lg p-2 text-xs font-bold" value={editTimeData.time} onChange={e => setEditTimeData({...editTimeData, time: e.target.value})} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleUpdateTime} className="flex-1 bg-green-500 text-white hover:bg-green-600 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-all">Зберегти</button>
                          <button onClick={() => setIsEditingTime(false)} className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-all">Скас</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
              
              <div className="flex items-center gap-2 shrink-0 self-end md:self-start w-full md:w-auto justify-end">
                {(role === 'owner' || permissions?.can_view_finances) && (
                  <button onClick={handlePrint} className="bg-blue-600 text-white p-2 md:px-4 md:py-2.5 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-black text-xs uppercase shadow-md shadow-blue-200" title="Друкувати акт">
                    <Printer size={16} /> <span className="hidden md:inline">Друк</span>
                  </button>
                )}
                {role === 'owner' && (
                  <button onClick={handleDeleteVisit} className="bg-red-50 text-red-500 p-2 md:px-3 md:py-2.5 rounded-xl hover:bg-red-100 transition-colors" title="Видалити повністю">
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 md:py-2.5 md:px-3 rounded-xl hover:bg-slate-200 transition-colors"><X size={18} /></button>
              </div>
            </div>

            {isStore ? (
              <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl mb-4 overflow-x-auto">
                <button onClick={() => updateVisitField('status', 'PENDING')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>Нове</button>
                <button onClick={() => updateVisitField('status', 'IN_PROGRESS')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-orange-500 shadow shadow-orange-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Чекаємо</button>
                <button onClick={() => updateVisitField('status', 'DONE')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-blue-600 shadow shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Відправка</button>
                <button onClick={() => updateVisitField('status', 'COMPLETED')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'COMPLETED' ? 'bg-green-500 shadow shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Виконано</button>
              </div>
            ) : (
              <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl mb-4 overflow-x-auto">
                <button onClick={() => updateVisitField('status', 'PENDING')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>В черзі</button>
                <button onClick={() => updateVisitField('status', 'IN_PROGRESS')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 shadow shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>В роботі</button>
                <button onClick={() => updateVisitField('status', 'DONE')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] md:text-xs uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Готово</button>
              </div>
            )}

            <div className={`grid grid-cols-1 ${!isStore ? 'md:grid-cols-2' : ''} gap-6`}>
              {!isStore && (
                <div>
                  <h3 className="font-black uppercase text-slate-700 mb-3 flex items-center gap-2 text-sm"><Wrench size={16}/> Завдання</h3>
                  <div className="space-y-3 mb-3">
                    {selectedVisit.services?.map(s => (
                      <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-3 group w-full shadow-sm">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-700 text-sm">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {(role === 'owner' || permissions?.can_view_finances) && <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-100 text-xs">{s.price} ₴</span>}
                            {role === 'owner' && <button onClick={() => handleDeleteService(s.id)} className="text-slate-300 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                          </div>
                        </div>
                        <div className="mt-1">
                          <select value={s.status || 'PENDING'} onChange={(e) => updateServiceStatus(s.id, e.target.value)} className={`appearance-none block w-full text-[11px] md:text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none cursor-pointer text-center shadow-sm border border-slate-200/50 ${serviceStatusColors[s.status || 'PENDING']}`}>
                            <option value="PENDING">⏳ Очікує</option>
                            <option value="IN_PROGRESS">🔧 В роботі</option>
                            <option value="DONE">✅ Виконано</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(role === 'owner' || permissions?.can_create_visits) && (
                    <form onSubmit={handleAddService} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 mt-4">
                      <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none cursor-pointer text-slate-600 font-bold truncate" value={selectedCatalogId} onChange={(e) => { 
                          setSelectedCatalogId(e.target.value);
                          const s = catalogServices.find(cat => cat.id === parseInt(e.target.value)); 
                          if (s) setNewService({ name: s.name, price: s.price }); 
                        }}>
                          <option value="" disabled>Оберіть з прайсу...</option>
                          {catalogServices.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price} ₴</option>)}
                      </select>
                      <div className="flex gap-2">
                        <input required type="text" placeholder="Назва" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                        <input required type="number" placeholder="Ціна" className="w-20 sm:w-24 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none font-bold" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-colors shadow-sm"><Plus size={18}/></button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <div>
                <h3 className="font-black uppercase text-slate-700 mb-3 flex items-center gap-2 text-sm"><Store size={16}/> Запчастини</h3>
                <div className="space-y-3 mb-3">
                  {selectedVisit.parts?.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-3 group w-full shadow-sm">
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-slate-700 text-sm leading-tight truncate">{p.name}</p>
                        <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 truncate">{p.brand} | {p.article}</p>
                        {role === 'owner' && <p className="text-[10px] uppercase font-bold text-blue-500 truncate mt-0.5">Де: {p.supplier}</p>}
                      </div>
                      
                      <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto shrink-0">
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full">
                          {(role === 'owner' || permissions?.can_view_finances) && <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-100 text-xs">{p.sell_price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeletePart(p.id)} className="text-slate-300 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                        <select value={p.status || 'WAITING'} onChange={(e) => updatePartStatus(p.id, e.target.value)} className={`appearance-none block text-[11px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none cursor-pointer w-full sm:w-36 text-center shadow-sm border border-slate-200/50 mt-1 ${partStatusColors[p.status || 'WAITING']}`}>
                          <option value="WAITING">⏳ Очікується</option>
                          <option value="IN_TRANSIT">🚚 В дорозі</option>
                          <option value="ARRIVED">✅ Приїхала</option>
                          <option value="UNAVAILABLE">❌ Не буде</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                {(role === 'owner' || permissions?.can_create_visits) && (
                  <div className="mt-4">
                    {!showManualPartForm ? (
                      <button onClick={() => setShowManualPartForm(true)} className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">✏️ Додати вручну</button>
                    ) : (
                      <form onSubmit={handleAddPart} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative shadow-sm">
                        <button type="button" onClick={() => setShowManualPartForm(false)} className="absolute right-3 top-3 text-slate-400 bg-white rounded-full p-1 border border-slate-100 hover:text-slate-600"><X size={16}/></button>
                        <input required type="text" placeholder="Назва деталі" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none font-bold" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                        <input required type="text" placeholder="Де замовлено" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none" value={newPart.supplier} onChange={e => setNewPart({...newPart, supplier: e.target.value})} />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input type="text" placeholder="Бренд" className="w-full sm:w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none" value={newPart.brand} onChange={e => setNewPart({...newPart, brand: e.target.value})} />
                          <input type="text" placeholder="Артикул" className="w-full sm:w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none" value={newPart.article} onChange={e => setNewPart({...newPart, article: e.target.value})} />
                        </div>
                        <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                          <input type="number" placeholder="Закупка" className="w-1/2 bg-transparent border-none text-sm outline-none px-2" value={newPart.buy_price} onChange={e => setNewPart({...newPart, buy_price: e.target.value})} />
                          <div className="w-[1px] h-6 bg-slate-200"></div>
                          <input type="number" placeholder="Продаж" className="w-1/2 bg-transparent border-none text-sm outline-none font-black text-blue-600 px-2 text-right" value={newPart.sell_price} onChange={e => setNewPart({...newPart, sell_price: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase text-xs py-3 rounded-lg mt-2 tracking-widest hover:bg-blue-700 shadow-sm transition-all">Зберегти</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 bg-amber-50 p-4 md:p-5 rounded-2xl border border-amber-100 relative">
              <h3 className="font-black uppercase text-amber-800 mb-3 flex items-center gap-2 text-xs"><MessageSquare size={16}/> Внутрішній коментар</h3>
              <textarea 
                className="w-full bg-white border border-amber-200 rounded-xl p-3 md:p-4 text-sm outline-none focus:border-amber-400 min-h-[70px] font-medium text-slate-700 placeholder:text-slate-400"
                placeholder="Нотатка (напр. номер ТТН)..."
                value={editComment}
                onChange={e => setEditComment(e.target.value)}
              />
              {editComment !== (selectedVisit.comment || '') && (
                <div className="flex justify-end mt-3">
                  <button onClick={handleSaveComment} className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm w-full sm:w-auto">
                    Зберегти
                  </button>
                </div>
              )}
            </div>

            {(role === 'owner' || permissions?.can_view_finances) && (
              <div className="mt-6 bg-slate-50 border border-slate-200 p-4 md:p-5 rounded-2xl flex justify-between items-center">
                 <div className="text-xs font-bold uppercase text-slate-500 tracking-wide">Загальна сума:</div>
                 <div className="text-xl md:text-2xl font-black text-slate-800">{grandTotal.toLocaleString()} ₴</div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
