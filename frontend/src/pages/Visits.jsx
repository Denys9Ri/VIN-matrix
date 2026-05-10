import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Store, Pencil, List, Search, RefreshCcw, Trash2, Printer, MessageSquare } from 'lucide-react';
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
  
  // Стан для внутрішнього коментаря
  const [editComment, setEditComment] = useState('');
  const [foundExisting, setFoundExisting] = useState(false);

  const [newVisitData, setNewVisitData] = useState({ plate: '', client: '', phone: '', date: '', time: '' });
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newPart, setNewPart] = useState({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });

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

  // Коли відкриваємо візит - підтягуємо його коментар
  useEffect(() => {
    if (selectedVisit) {
      setEditComment(selectedVisit.comment || '');
    }
  }, [selectedVisit?.id, selectedVisit?.comment]);

  const handlePlateBlur = async () => {
    if (!newVisitData.plate || newVisitData.plate.length < 3) return;
    try {
      const res = await axios.get(`${API_BASE}/api/visits/?search=${newVisitData.plate}`, { headers: { Authorization: `Bearer ${token}` } });
      const existing = res.data.find(v => v.plate.toUpperCase() === newVisitData.plate.toUpperCase());
      if (existing) {
        setNewVisitData(prev => ({ ...prev, client: existing.client, phone: existing.phone }));
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
        client: newVisitData.client,
        phone: newVisitData.phone,
        scheduled_datetime: scheduled_datetime
    };
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setIsCreatingVisit(false);
      setNewVisitData({ plate: '', client: '', phone: '', date: '', time: '' });
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
    let scheduled_datetime = null;
    if (editTimeData.date && editTimeData.time) {
      const localDate = new Date(`${editTimeData.date}T${editTimeData.time}`);
      scheduled_datetime = localDate.toISOString();
    }
    try {
      await axios.patch(`${API_BASE}/api/visits/${selectedVisit.id}/`, { scheduled_datetime }, { headers: { Authorization: `Bearer ${token}` } });
      setIsEditingTime(false); refreshSelectedVisit();
    } catch (error) { alert("Помилка збереження часу"); }
  };

  const updateVisitStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedVisit({ ...selectedVisit, status: newStatus });
      fetchData();
    } catch (error) { alert("Помилка статусу"); }
  };

  // ЗБЕРЕЖЕННЯ КОМЕНТАРЯ
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
      setNewService({ name: '', price: '' }); refreshSelectedVisit();
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
    <div className="bg-slate-50/50 rounded-3xl p-4 flex flex-col h-full border border-slate-100">
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${colorClass}`}>
        {icon} {title} <span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span>
      </h3>
      <div className="space-y-4 flex-1 overflow-y-auto pr-1 pb-10">
        {items.map(visit => (
          <VisitCard key={visit.id} visit={visit} onClick={() => setSelectedVisit(visit)} />
        ))}
        {items.length === 0 && <div className="text-center text-slate-400 text-xs font-bold uppercase mt-10">Пусто</div>}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 h-screen flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-black uppercase italic w-full xl:w-auto">Дошка Візитів</h1>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1 xl:justify-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Пошук (номер, телефон, клієнт)..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium shadow-sm transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="relative w-full md:w-auto">
            <input type="date" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 font-medium text-slate-600 shadow-sm cursor-pointer transition-all" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <Column title="В черзі / Підбір" icon={<Clock size={18}/>} items={pending} colorClass="text-slate-600" />
        <Column title="В роботі" icon={<Wrench size={18}/>} items={inProgress} colorClass="text-blue-600" />
        <Column title="Готово" icon={<CheckCircle2 size={18}/>} items={done} colorClass="text-green-600" />
      </div>

      {isCreatingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => { setIsCreatingVisit(false); setFoundExisting(false); }} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><CarFront className="text-blue-600"/> Новий візит</h2>
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Дата приїзду</label>
                  <input required type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-slate-700" value={newVisitData.date} onChange={e => setNewVisitData({...newVisitData, date: e.target.value})}/>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Час</label>
                  <input required type="time" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-slate-700" value={newVisitData.time} onChange={e => setNewVisitData({...newVisitData, time: e.target.value})}/>
                </div>
              </div>
              
              <div>
                <input required type="text" placeholder="Номер авто (АА1234ВВ)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase tracking-widest" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})} onBlur={handlePlateBlur} />
                {foundExisting && <p className="text-green-600 text-[10px] font-bold uppercase mt-1 ml-2">✓ Дані підтягнуто з бази</p>}
              </div>

              <input required type="text" placeholder="Клієнт / Марка" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={newVisitData.client} onChange={e => setNewVisitData({...newVisitData, client: e.target.value})}/>
              <input required type="text" placeholder="Телефон" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={newVisitData.phone} onChange={e => setNewVisitData({...newVisitData, phone: e.target.value})}/>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-200 transition-all tracking-widest text-sm">Відкрити замовлення</button>
            </form>
          </div>
        </div>
      )}

      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl my-8 relative">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-start mb-6 border-b border-slate-100 pb-4 gap-4">
              <div className="w-full">
                <h2 className="text-3xl font-black uppercase">{selectedVisit.plate}</h2>
                <p className="text-slate-500 font-bold flex items-center gap-2 mt-1"><CarFront size={16}/> {selectedVisit.client} | <Phone size={16}/> {selectedVisit.phone}</p>
                
                <div className="text-slate-500 text-xs font-bold mt-2 flex items-center gap-2 group">
                  <Clock size={14}/>
                  {isEditingTime ? (
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                      <input type="date" className="bg-transparent outline-none text-slate-700" value={editTimeData.date} onChange={e => setEditTimeData({...editTimeData, date: e.target.value})} />
                      <input type="time" className="bg-transparent outline-none text-slate-700" value={editTimeData.time} onChange={e => setEditTimeData({...editTimeData, time: e.target.value})} />
                      <button onClick={handleUpdateTime} className="text-green-600 hover:bg-green-100 p-1 rounded"><CheckCircle2 size={14}/></button>
                      <button onClick={() => setIsEditingTime(false)} className="text-slate-400 hover:bg-slate-200 p-1 rounded"><X size={14}/></button>
                    </div>
                  ) : (
                    <>
                      <span>Запис: {selectedVisit.scheduled_datetime ? new Date(selectedVisit.scheduled_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Без дати'}</span>
                      {role === 'owner' && (
                        <button onClick={() => {
                          const d = selectedVisit.scheduled_datetime ? new Date(selectedVisit.scheduled_datetime) : new Date();
                          setEditTimeData({ date: d.toLocaleDateString('en-CA'), time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
                          setIsEditingTime(true);
                        }} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil size={14}/>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {role === 'owner' && (
                  <button onClick={handlePrint} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 px-3 font-black text-xs uppercase shadow-md shadow-blue-200" title="Друкувати акт">
                    <Printer size={18} /> Друк
                  </button>
                )}
                {role === 'owner' && (
                  <button onClick={handleDeleteVisit} className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100 transition-colors" title="Видалити візит повністю">
                    <Trash2 size={20} />
                  </button>
                )}
                {role === 'owner' && (selectedVisit.status === 'DONE' || filterDate) && (
                  <button onClick={() => {
                      setNewVisitData({ plate: selectedVisit.plate, client: selectedVisit.client, phone: selectedVisit.phone, date: '', time: '' });
                      setSelectedVisit(null);
                      setIsCreatingVisit(true);
                    }} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-black uppercase text-xs hover:bg-blue-100 transition-all"
                  >
                    <RefreshCcw size={16}/> Повторний
                  </button>
                )}
                <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
              </div>
            </div>

            <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl mb-6">
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'PENDING')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow-md text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>В черзі</button>
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'IN_PROGRESS')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 shadow-md shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>В роботі</button>
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'DONE')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow-md shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Готово</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Wrench size={18}/> Завдання</h3>
                <div className="space-y-3 mb-4">
                  {selectedVisit.services?.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 group">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-700 text-sm">{s.name}</span>
                        <div className="flex items-center gap-3">
                          {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-1 rounded-md text-sm">{s.price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeleteService(s.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                      </div>
                      <select value={s.status || 'PENDING'} onChange={(e) => updateServiceStatus(s.id, e.target.value)} className={`text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none cursor-pointer border-none w-full ${serviceStatusColors[s.status || 'PENDING']}`}>
                        <option value="PENDING">⏳ Очікує</option>
                        <option value="IN_PROGRESS">🔧 В роботі</option>
                        <option value="DONE">✅ Виконано</option>
                      </select>
                    </div>
                  ))}
                </div>
                {role === 'owner' && (
                  <form onSubmit={handleAddService} className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-2">
                    <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer text-slate-600" onChange={(e) => { const s = catalogServices.find(cat => cat.id === parseInt(e.target.value)); if (s) setNewService({ name: s.name, price: s.price }); }} defaultValue="">
                        <option value="" disabled>Оберіть з прайсу...</option>
                        {catalogServices.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price} ₴</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input required type="text" placeholder="Назва" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                      <input required type="number" placeholder="Ціна" className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-bold" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                      <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={18}/></button>
                    </div>
                  </form>
                )}
              </div>

              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Store size={18}/> Запчастини</h3>
                <div className="space-y-3 mb-4">
                  {selectedVisit.parts?.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{p.name}</p>
                          <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">{p.brand} | {p.article}</p>
                          {role === 'owner' && <p className="text-[9px] uppercase font-bold text-blue-500 mt-1">Де: {p.supplier}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-1 rounded-md text-sm">{p.sell_price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeletePart(p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                      </div>
                      <select value={p.status || 'WAITING'} onChange={(e) => updatePartStatus(p.id, e.target.value)} className={`text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none cursor-pointer border-none w-full ${partStatusColors[p.status || 'WAITING']}`}>
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
                      <button onClick={() => setShowManualPartForm(true)} className="w-full p-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all">✏️ Додати вручну</button>
                    ) : (
                      <form onSubmit={handleAddPart} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                        <button type="button" onClick={() => setShowManualPartForm(false)} className="absolute right-2 top-2 text-slate-400"><X size={14}/></button>
                        <input required type="text" placeholder="Назва деталі" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-bold" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                        <input required type="text" placeholder="Постачальник / Де замовлено" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.supplier} onChange={e => setNewPart({...newPart, supplier: e.target.value})} />
                        <div className="flex gap-2">
                          <input type="text" placeholder="Бренд" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.brand} onChange={e => setNewPart({...newPart, brand: e.target.value})} />
                          <input type="text" placeholder="Артикул" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.article} onChange={e => setNewPart({...newPart, article: e.target.value})} />
                        </div>
                        <div className="flex gap-2 items-center bg-white p-2 rounded-lg">
                          <input type="number" placeholder="Закупка" className="w-1/2 bg-transparent border-none text-sm outline-none" value={newPart.buy_price} onChange={e => setNewPart({...newPart, buy_price: e.target.value})} />
                          <input type="number" placeholder="Продаж" className="w-1/2 bg-transparent border-none text-sm outline-none font-black text-blue-600" value={newPart.sell_price} onChange={e => setNewPart({...newPart, sell_price: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase text-xs py-3 rounded-lg mt-2 tracking-widest hover:bg-blue-700 shadow-sm transition-all">Зберегти</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ДОДАНО: ВНУТРІШНІЙ КОМЕНТАР */}
            <div className="mt-8 bg-amber-50 p-6 rounded-3xl border border-amber-100 relative">
              <h3 className="font-black uppercase text-amber-800 mb-3 flex items-center gap-2 text-sm"><MessageSquare size={16}/> Внутрішній коментар (не друкується)</h3>
              <textarea 
                className="w-full bg-white border border-amber-200 rounded-xl p-4 text-sm outline-none focus:border-amber-400 min-h-[80px] font-medium text-slate-700 placeholder:text-slate-400"
                placeholder="Залиште нотатку для себе або майстра..."
                value={editComment}
                onChange={e => setEditComment(e.target.value)}
              />
              {editComment !== (selectedVisit.comment || '') && (
                <div className="flex justify-end mt-3">
                  <button onClick={handleSaveComment} className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm">
                    Зберегти
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 bg-blue-600 p-6 rounded-3xl text-white flex justify-between items-center shadow-xl shadow-blue-100">
               <div className="text-xs font-bold uppercase opacity-80">Загальна сума до сплати:</div>
               <div className="text-3xl font-black italic">{grandTotal.toLocaleString()} ₴</div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
