import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Store, Pencil, List, Search, RefreshCcw, Trash2, Printer, MessageSquare, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import VisitCard from '../components/visits/VisitCard'; 
import { useNavigate } from 'react-router-dom';

const Visits = () => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]); 
  const [role, setRole] = useState(null); 
  const [companyInfo, setCompanyInfo] = useState(null); 
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false); 
  const [showManualPartForm, setShowManualPartForm] = useState(false); 
  
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeData, setEditTimeData] = useState({ date: '', time: '' });
  
  const [editComment, setEditComment] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);
  
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  const [newVisitData, setNewVisitData] = useState({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '' });
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
      setCatalogServices(servicesRes.data || []);
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
    if (selectedVisit) {
      setEditComment(selectedVisit.comment || '');
    }
  }, [selectedVisit?.id, selectedVisit?.comment]);

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
      } catch (err) {
        console.error('Помилка копіювання', err);
      }
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
    } catch (error) {
      console.error("Помилка автозаповнення", error);
    }
  };

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    let scheduled_datetime = null;
    if (newVisitData.date && newVisitData.time) {
      const localDate = new Date(`${newVisitData.date}T${newVisitData.time}`);
      scheduled_datetime = localDate.toISOString();
    }
    const payload = {
        plate: newVisitData.plate.toUpperCase(),
        vin_code: newVisitData.vin_code, 
        client: newVisitData.client,
        phone: newVisitData.phone,
        scheduled_datetime: scheduled_datetime
    };
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setIsCreatingVisit(false);
      setNewVisitData({ plate: '', vin_code: '', client: '', phone: '', date: '', time: '' });
      setSearchQuery(''); setFilterDate(''); fetchData();
    } catch (error) { alert("Помилка створення візиту"); }
  };

  const handleDeleteVisit = async () => {
    if (window.confirm("Ви дійсно хочете видалити це замовлення НАЗАВЖДИ?")) {
      try {
        await axios.delete(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } });
        setSelectedVisit(null); fetchData();
      } catch (error) { alert("Помилка видалення"); }
    }
  };

  const handleUpdateTime = async () => {
    if (!editTimeData.date || !editTimeData.time) {
      alert("Будь ласка, оберіть і дату, і час!");
      return;
    }
    let scheduled_datetime = null;
    const localDate = new Date(`${editTimeData.date}T${editTimeData.time}`);
    scheduled_datetime = localDate.toISOString();
    
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { scheduled_datetime }, { headers: { Authorization: `Bearer ${token}` } });
      setIsEditingTime(false); refreshSelectedVisit();
    } catch (error) { alert("Помилка збереження часу. Перевірте правильність дати."); }
  };

  const updateVisitStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, status: newStatus });
      fetchData();
    } catch (error) { alert("Помилка статусу"); }
  };

  const handleSaveComment = async () => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { comment: editComment }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, comment: editComment });
      fetchData();
    } catch (error) { alert("Помилка збереження коментаря"); }
  };

  const updateServiceStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/order-services/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const updatePartStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/order-services/`, { ...newService, visit: selectedVisit.id }, { headers: { Authorization: `Bearer ${token}` } });
      setNewService({ name: '', price: '' }); 
      setSelectedCatalogId(''); 
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/order-parts/`, { ...newPart, visit: selectedVisit.id, supplier: newPart.supplier || 'Вручну' }, { headers: { Authorization: `Bearer ${token}` } });
      setNewPart({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });
      setShowManualPartForm(false); refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const handleDeleteService = async (id) => {
    if(window.confirm("Видалити послугу?")) {
        await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
        refreshSelectedVisit();
    }
  };

  const handleDeletePart = async (id) => {
    if(window.confirm("Видалити запчастину?")) {
        await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
        refreshSelectedVisit();
    }
  };

  const refreshSelectedVisit = async () => {
    const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } });
    setSelectedVisit(res.data);
    fetchData();
  };

  const servicesTotal = selectedVisit?.services?.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) || 0;
  const partsTotal = selectedVisit?.parts?.reduce((sum, p) => sum + parseFloat(p.sell_price || 0), 0) || 0;
  const grandTotal = servicesTotal + partsTotal;

  const handlePrint = () => {
    const dateStr = new Date().toLocaleDateString();
    const logoHtml = companyInfo?.logo ? `<img src="${companyInfo.logo}" alt="Logo" style="max-height: 80px; margin-bottom: 10px;" />` : '';
    const servicesRows = selectedVisit?.services?.map(s => `<tr><td>${s.name}</td><td style="text-align: right;">${parseFloat(s.price).toLocaleString()}</td></tr>`).join('') || '';
    const servicesHtml = servicesRows ? `<div class="section-title">1. ПЕРЕЛІК РОБІТ ТА ПОСЛУГ</div><table><thead><tr><th style="width: 80%;">Назва послуги</th><th style="text-align: right;">Вартість, грн</th></tr></thead><tbody>${servicesRows}</tbody></table>` : '';
    const partsRows = selectedVisit?.parts?.map(p => `<tr><td>${p.name}</td><td>${p.brand} ${p.article}</td><td style="text-align: right;">${parseFloat(p.sell_price).toLocaleString()}</td></tr>`).join('') || '';
    const partsHtml = partsRows ? `<div class="section-title">2. ЗАПЧАСТИНИ ТА МАТЕРІАЛИ</div><table><thead><tr><th style="width: 40%;">Назва</th><th style="width: 40%;">Бренд/Артикул</th><th style="text-align: right;">Ціна, грн</th></tr></thead><tbody>${partsRows}</tbody></table>` : '';
    const footerHtml = companyInfo?.document_footer ? `<div class="footer">${companyInfo.document_footer}</div>` : '';

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Акт №${selectedVisit.id}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 30px; color: #000; margin: 0; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 25px; }
            .info-block { padding: 15px; border: 1px solid #000; border-radius: 8px; margin-bottom: 25px; }
            .info-block p { margin-bottom: 8px; font-size: 14px; margin-top: 0; }
            .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: left; font-size: 13px; }
            th { background-color: #f2f2f2; font-weight: bold; -webkit-print-color-adjust: exact; color-adjust: exact; }
            .total-block { margin-top: 30px; text-align: right; padding: 15px; border-top: 2px solid #000; }
            .total-block p { font-size: 15px; margin-bottom: 8px; margin-top: 0; }
            .total-block .grand-total { font-size: 22px; font-weight: 900; margin-top: 15px; }
            .footer { margin-top: 50px; font-size: 12px; color: #333; border-top: 1px solid #ddd; padding-top: 15px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              ${logoHtml}
              <h1 style="font-size: 24px; font-weight: 900; margin: 0;">${companyInfo?.name || 'СТО'}</h1>
              <p style="font-size: 14px; margin: 4px 0;">${companyInfo?.address || ''}</p>
              <p style="font-size: 14px; margin: 4px 0;">Тел: ${companyInfo?.phone || ''}</p>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 10px 0;">АКТ ВИКОНАНИХ РОБІТ №${selectedVisit.id}</h2>
              <p style="font-size: 14px; margin: 0;">Дата: ${dateStr}</p>
            </div>
          </div>
          <div class="info-block">
            <p><strong>Автомобіль:</strong> ${selectedVisit.plate} (${selectedVisit.client})</p>
            <p style="margin-bottom: 8px;"><strong>VIN-код:</strong> ${selectedVisit.vin_code || '—'}</p>
            <p style="margin-bottom: 0;"><strong>Телефон клієнта:</strong> ${selectedVisit.phone}</p>
          </div>
          ${servicesHtml}
          ${partsHtml}
          <div class="total-block">
            <p>Всього за роботи: ${servicesTotal.toLocaleString()} грн</p>
            <p>Всього за запчастини: ${partsTotal.toLocaleString()} грн</p>
            <p class="grand-total">ДО СПЛАТИ: ${grandTotal.toLocaleString()} грн</p>
          </div>
          ${footerHtml}
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 300); }
          </script>
        </body>
      </html>
    `);
    doc.close();
    setTimeout(() => { document.body.removeChild(iframe); }, 5000);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">R16 ЗАВАНТАЖЕННЯ...</div>;

  const pending = visits.filter(v => v.status === 'PENDING' || v.status === 'SELECTION');
  const inProgress = visits.filter(v => v.status === 'IN_PROGRESS');
  const done = visits.filter(v => v.status === 'DONE');

  const Column = ({ title, icon, items, colorClass }) => (
    <div className="bg-slate-50/50 rounded-3xl p-4 flex flex-col border border-slate-100 no-print-area">
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${colorClass}`}>
        {icon} {title} <span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span>
      </h3>
      <div className="space-y-4 flex-1 pb-4">
        {items.map(visit => (
          <VisitCard key={visit.id} visit={visit} onClick={() => setSelectedVisit(visit)} />
        ))}
        {items.length === 0 && <div className="text-center text-slate-400 text-xs font-bold uppercase mt-10">Пусто</div>}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen flex flex-col w-full overflow-x-hidden">
      <style>{`
        @media print {
          body * { display: none !important; }
          #root, #root *, #printable-act, #printable-act * { display: block !important; }
          .no-print-area, .no-print-area * { display: none !important; }
          html, body, #root { height: auto !important; min-height: auto !important; overflow: visible !important; background: white !important; }
          .fixed, .absolute { position: static !important; }
          .overflow-y-auto, .overflow-hidden { overflow: visible !important; }
          .h-screen { height: auto !important; }
          .max-w-4xl, .max-w-7xl { max-width: none !important; width: 100% !important; }
          #printable-act { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0 10mm !important; color: black !important; font-family: Arial, sans-serif !important; }
          table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; }
          th, td { border: 1px solid #000 !important; padding: 8px !important; text-align: left !important; font-size: 13px !important; color: black !important; display: table-cell !important; }
          th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; font-weight: bold !important; }
          tr { display: table-row !important; page-break-inside: avoid; }
          tbody { display: table-row-group !important; }
          thead { display: table-header-group !important; }
        }

        input[type="date"], input[type="time"] {
          color: #334155 !important;
          -webkit-appearance: none;
          min-height: 42px;
        }
      `}</style>

      <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4 no-print-area shrink-0 mt-4 md:mt-0">
        <h1 className="text-2xl font-black uppercase italic w-full xl:w-auto">Дошка Візитів</h1>
        
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

        {role !== 'mechanic' && (
           <button onClick={() => setIsCreatingVisit(true)} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] w-full xl:w-auto">
             <Plus size={16}/> Нове авто
           </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 no-print-area">
        <Column title="В черзі / Підбір" icon={<Clock size={18}/>} items={pending} colorClass="text-slate-600" />
        <Column title="В роботі" icon={<Wrench size={18}/>} items={inProgress} colorClass="text-blue-600" />
        <Column title="Готово" icon={<CheckCircle2 size={18}/>} items={done} colorClass="text-green-600" />
      </div>

      {isCreatingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto no-print-area">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl mt-4 md:mt-10 mb-10 relative">
            <button onClick={() => { setIsCreatingVisit(false); setFoundExisting(false); }} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X size={20} /></button>
            <h2 className="text-xl font-black mb-5 flex items-center gap-2"><CarFront className="text-blue-600"/> Новий візит</h2>
            <form onSubmit={handleCreateVisit} className="space-y-4">
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
              
              <div>
                <input required type="text" placeholder="НОМЕР АВТО (АА1234ВВ)" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase tracking-widest text-sm" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})} onBlur={handlePlateBlur} />
                {foundExisting && <p className="text-green-600 text-[10px] font-bold uppercase mt-1 ml-2">✓ Дані підтягнуто з бази</p>}
              </div>

              <input 
                type="text" 
                placeholder="VIN-КОД (Англ. букви та цифри)" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-sm tracking-widest uppercase" 
                value={newVisitData.vin_code} 
                onChange={e => setNewVisitData({...newVisitData, vin_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)})}
              />

              <input required type="text" placeholder="Клієнт / Марка" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={newVisitData.client} onChange={e => setNewVisitData({...newVisitData, client: e.target.value})}/>
              <input required type="text" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={newVisitData.phone} onChange={e => setNewVisitData({...newVisitData, phone: e.target.value})}/>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-sm transition-all tracking-widest text-xs mt-2">Відкрити замовлення</button>
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
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md border border-slate-200 break-all">
                      VIN: {selectedVisit.vin_code}
                    </span>
                    <button 
                      onClick={() => handleCopyVin(selectedVisit.vin_code)}
                      className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-md transition-colors border border-slate-200 hover:border-blue-200 shrink-0"
                      title="Скопіювати VIN"
                    >
                      {copiedVin === selectedVisit.vin_code ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                    {copiedVin === selectedVisit.vin_code && (
                      <span className="text-[9px] font-bold text-green-600 uppercase transition-all">Скопійовано!</span>
                    )}
                  </div>
                )}

                <p className="text-slate-500 text-[13px] font-bold flex flex-wrap items-center gap-2 mt-1"><CarFront size={14} className="shrink-0"/> {selectedVisit.client} <span className="hidden sm:inline">|</span> <Phone size={14} className="shrink-0"/> {selectedVisit.phone}</p>
                
                <div className="mt-3">
                  {!isEditingTime ? (
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold group">
                      <Clock size={12}/>
                      <span>Запис: {selectedVisit.scheduled_datetime ? new Date(selectedVisit.scheduled_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Без дати'}</span>
                      {role === 'owner' && (
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
                        <button onClick={() => setIsEditingTime(false)} className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-all">Скасувати</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 self-end md:self-start w-full md:w-auto justify-end">
                {role === 'owner' && (
                  <button onClick={handlePrint} className="bg-blue-600 text-white p-2 md:px-4 md:py-2.5 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-black text-xs uppercase shadow-md shadow-blue-200" title="Друкувати акт">
                    <Printer size={16} /> <span className="hidden md:inline">Друк</span>
                  </button>
                )}
                {role === 'owner' && (
                  <button onClick={handleDeleteVisit} className="bg-red-50 text-red-500 p-2 md:px-3 md:py-2.5 rounded-xl hover:bg-red-100 transition-colors" title="Видалити візит повністю">
                    <Trash2 size={16} />
                  </button>
                )}
                {role === 'owner' && (selectedVisit.status === 'DONE' || filterDate) && (
                  <button onClick={() => {
                      setNewVisitData({ plate: selectedVisit.plate, vin_code: selectedVisit.vin_code || '', client: selectedVisit.client, phone: selectedVisit.phone, date: '', time: '' });
                      setSelectedVisit(null);
                      setIsCreatingVisit(true);
                    }} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2.5 rounded-xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
                  >
                    <RefreshCcw size={14}/> <span className="hidden md:inline">Повтор</span>
                  </button>
                )}
                <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 md:py-2.5 md:px-3 rounded-xl hover:bg-slate-200 transition-colors"><X size={18} /></button>
              </div>
            </div>

            <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl mb-4 overflow-x-auto">
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'PENDING')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] sm:text-[11px] md:text-xs uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>В черзі</button>
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'IN_PROGRESS')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] sm:text-[11px] md:text-xs uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 shadow shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>В роботі</button>
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'DONE')} className={`flex-1 min-w-[80px] py-2.5 rounded-lg font-black text-[10px] sm:text-[11px] md:text-xs uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Готово</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-3 flex items-center gap-2 text-sm"><Wrench size={16}/> Завдання</h3>
                <div className="space-y-3 mb-3">
                  {selectedVisit.services?.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-3 group w-full shadow-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-700 text-sm">{s.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-100 text-xs">{s.price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeleteService(s.id)} className="text-slate-300 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                      </div>
                      
                      {/* ОНОВЛЕНО: Великий випадаючий список для телефонів */}
                      <select 
                        value={s.status || 'PENDING'} 
                        onChange={(e) => updateServiceStatus(s.id, e.target.value)} 
                        className={`text-[11px] md:text-xs font-black uppercase tracking-widest rounded-xl px-3 py-3 md:py-2 outline-none cursor-pointer w-full text-center shadow-sm border border-slate-200/50 ${serviceStatusColors[s.status || 'PENDING']}`}
                      >
                        <option value="PENDING">⏳ Очікує</option>
                        <option value="IN_PROGRESS">🔧 В роботі</option>
                        <option value="DONE">✅ Виконано</option>
                      </select>
                    </div>
                  ))}
                </div>
                {role === 'owner' && (
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

              <div>
                <h3 className="font-black uppercase text-slate-700 mb-3 flex items-center gap-2 text-sm"><Store size={16}/> Запчастини</h3>
                <div className="space-y-3 mb-3">
                  {selectedVisit.parts?.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-3 group w-full shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="overflow-hidden">
                          <p className="font-bold text-slate-700 text-sm leading-tight truncate">{p.name}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 truncate">{p.brand} | {p.article}</p>
                          {role === 'owner' && <p className="text-[10px] uppercase font-bold text-blue-500 truncate mt-0.5">Де: {p.supplier}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-100 text-xs">{p.sell_price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeletePart(p.id)} className="text-slate-300 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                      </div>
                      
                      {/* ОНОВЛЕНО: Великий випадаючий список для деталей */}
                      <select 
                        value={p.status || 'WAITING'} 
                        onChange={(e) => updatePartStatus(p.id, e.target.value)} 
                        className={`text-[11px] md:text-xs font-black uppercase tracking-widest rounded-xl px-3 py-3 md:py-2 outline-none cursor-pointer w-full text-center shadow-sm border border-slate-200/50 ${partStatusColors[p.status || 'WAITING']}`}
                      >
                        <option value="WAITING">⏳ Очікується</option>
                        <option value="IN_TRANSIT">🚚 В дорозі</option>
                        <option value="ARRIVED">✅ Приїхала</option>
                        <option value="UNAVAILABLE">❌ Не буде</option>
                      </select>
                    </div>
                  ))}
                </div>
                {role === 'owner' && (
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
                placeholder="Залиште нотатку для себе або майстра..."
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

            <div className="mt-6 bg-slate-50 border border-slate-200 p-4 md:p-5 rounded-2xl flex justify-between items-center">
               <div className="text-xs font-bold uppercase text-slate-500 tracking-wide">Загальна сума:</div>
               <div className="text-xl md:text-2xl font-black text-slate-800">{grandTotal.toLocaleString()} ₴</div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
