import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ClipboardList, FileSpreadsheet, History, Package, Plus, Search, Tag, Trash2, Truck, Upload, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
const emptyReceipt = { brand: '', article: '', name: '', quantity: 1, buy_price: '', sell_price: '', supplier: '', supplier_name: '', category: '', note: '', order_part_id: '' };
const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const dateText = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };
  const [activeTab, setActiveTab] = useState('stock');
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newSupplier, setNewSupplier] = useState({ name: '', api_key: '', price_file: null });
  const [receipt, setReceipt] = useState({ ...emptyReceipt });
  const [importData, setImportData] = useState({ file: null, supplier_name: '' });
  const [message, setMessage] = useState('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const draft = location.state?.receiptDraft;
    if (draft) {
      setActiveTab('receipts');
      setReceipt({
        ...emptyReceipt,
        brand: draft.brand || '',
        article: draft.article || '',
        name: draft.name || '',
        quantity: draft.quantity || 1,
        buy_price: draft.buy_price || '',
        sell_price: draft.sell_price || draft.price || '',
        supplier_name: draft.supplier || '',
        order_part_id: draft.id || '',
        note: draft.visit_id ? `З замовлення постачальнику, візит №${draft.visit_id}` : '',
      });
      setIsReceiptModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const normalizeList = (data) => Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);

  const fetchData = async () => {
    const [catRes, itemRes, supRes, movRes] = await Promise.all([
      axios.get(`${API_BASE}/api/categories/`, { headers }).catch((error) => ({ error, data: [] })),
      axios.get(`${API_BASE}/api/inventory/`, { headers }).catch((error) => ({ error, data: [] })),
      axios.get(`${API_BASE}/api/suppliers/`, { headers }).catch((error) => ({ error, data: [] })),
      axios.get(`${API_BASE}/api/stock-movements/`, { headers }).catch(() => ({ data: [] })),
    ]);
    if (catRes.error?.response?.status === 401 || itemRes.error?.response?.status === 401 || supRes.error?.response?.status === 401) navigate('/login');
    setCategories(normalizeList(catRes.data));
    setItems(normalizeList(itemRes.data));
    setSuppliers(normalizeList(supRes.data));
    setMovements(normalizeList(movRes.data));
    if (catRes.error || itemRes.error || supRes.error) setMessage('Частину складу не вдалося завантажити. Перевірте міграції та оновіть сторінку.');
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const byCategory = !selectedCategory || String(item.category || '') === String(selectedCategory);
      const text = [item.brand, item.article, item.name, item.category_name, item.supplier_name].filter(Boolean).join(' ').toLowerCase();
      return byCategory && (!q || text.includes(q));
    });
  }, [items, selectedCategory, searchQuery]);

  const stockTotal = useMemo(() => items.reduce((s, i) => s + Number(i.buy_price || 0) * Number(i.quantity || 0), 0), [items]);
  const lowStock = useMemo(() => items.filter((i) => Number(i.quantity || 0) <= 1).length, [items]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/api/categories/`, { name: newCatName }, { headers });
    setNewCatName(''); setIsCategoryModalOpen(false); fetchData();
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Видалити категорію? Товари залишаться без категорії.')) return;
    await axios.delete(`${API_BASE}/api/categories/${id}/`, { headers });
    if (String(selectedCategory) === String(id)) setSelectedCategory('');
    fetchData();
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Видалити товар?')) return;
    await axios.delete(`${API_BASE}/api/inventory/${id}/`, { headers });
    fetchData();
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('name', newSupplier.name);
    if (newSupplier.api_key) form.append('api_key', newSupplier.api_key);
    if (newSupplier.price_file) form.append('price_file', newSupplier.price_file);
    await axios.post(`${API_BASE}/api/suppliers/`, form, { headers });
    setNewSupplier({ name: '', api_key: '', price_file: null });
    setIsSupplierModalOpen(false);
    fetchData();
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Видалити постачальника?')) return;
    await axios.delete(`${API_BASE}/api/suppliers/${id}/`, { headers });
    fetchData();
  };

  const openReceipt = (draft = {}) => { setReceipt({ ...emptyReceipt, ...draft }); setIsReceiptModalOpen(true); };

  const handleReceive = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/stock/receive/`, receipt, { headers });
      setReceipt({ ...emptyReceipt });
      setIsReceiptModalOpen(false);
      setMessage('Прихід збережено. Залишок оновлено.');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося провести прихід.');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importData.file) { setMessage('Додайте Excel-файл.'); return; }
    const form = new FormData();
    form.append('file', importData.file);
    if (importData.supplier_name) form.append('supplier_name', importData.supplier_name);
    try {
      const res = await axios.post(`${API_BASE}/api/stock/receive/import-file/`, form, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      setIsImportModalOpen(false);
      setImportData({ file: null, supplier_name: '' });
      setMessage(`Імпорт готовий: створено ${res.data.created || 0}, оновлено ${res.data.updated || 0}, пропущено ${res.data.skipped || 0}.`);
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося імпортувати Excel.');
    }
  };

  return <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen overflow-x-hidden">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><Package className="text-blue-600"/> Склад</h1>
        <p className="text-slate-500 font-semibold text-sm mt-1">Залишки, прихід, історія руху та постачальники.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-blue-100 text-blue-700 rounded-2xl px-5 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Upload size={16}/> Імпорт Excel</button>
        <button onClick={() => openReceipt()} className="bg-blue-600 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-100"><Plus size={16}/> Новий прихід</button>
      </div>
    </div>

    <div className="bg-white border border-slate-200 rounded-3xl p-2 mb-5 shadow-sm overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        <Tab active={activeTab === 'stock'} onClick={() => setActiveTab('stock')} icon={<Package size={16}/>} label="Товари" />
        <Tab active={activeTab === 'receipts'} onClick={() => setActiveTab('receipts')} icon={<ClipboardList size={16}/>} label="Прихід" />
        <Tab active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={16}/>} label="Історія" />
        <Tab active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')} icon={<Truck size={16}/>} label="Постачальники" />
      </div>
    </div>

    {message && <div className="mb-5 bg-blue-50 text-blue-700 border border-blue-100 rounded-2xl px-4 py-3 text-sm font-bold flex justify-between gap-3"><span>{message}</span><button onClick={() => setMessage('')}><X size={16}/></button></div>}

    {activeTab === 'stock' && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"><Stat label="Товарів" value={items.length}/><Stat label="На суму" value={money(stockTotal)}/><Stat label="Мало залишку" value={lowStock}/><Stat label="Постачальників" value={suppliers.length}/></div>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5"><aside className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm h-fit"><div className="flex justify-between items-center mb-3"><h3 className="font-black uppercase text-xs text-slate-500 flex gap-2"><Tag size={15}/> Категорії</h3><button onClick={() => setIsCategoryModalOpen(true)} className="bg-blue-50 text-blue-600 rounded-xl p-2"><Plus size={15}/></button></div><div className="flex lg:flex-col gap-2 overflow-x-auto pb-1"><CategoryBtn active={!selectedCategory} onClick={() => setSelectedCategory('')} label="Усі товари" />{categories.map((c) => <div key={c.id} className="flex items-center gap-1 shrink-0 lg:shrink"><CategoryBtn active={String(selectedCategory) === String(c.id)} onClick={() => setSelectedCategory(c.id)} label={c.name}/><button onClick={() => handleDeleteCategory(c.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={14}/></button></div>)}</div></aside><main className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm min-w-0"><div className="flex flex-col md:flex-row gap-3 justify-between mb-4"><div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Пошук по артикулу, бренду, назві..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold outline-none"/></div><button onClick={() => openReceipt()} className="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><Plus size={15}/> Прихід</button></div><div className="hidden md:block overflow-x-auto"><table className="w-full text-left min-w-[720px]"><thead><tr className="border-b-2 border-slate-100"><Th>Артикул / бренд</Th><Th>Товар</Th><Th>К-сть</Th><Th>Закупка</Th><Th>Продаж</Th><Th></Th></tr></thead><tbody>{filteredItems.map((item)=><tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="p-3"><p className="font-black text-slate-800">{item.article}</p><p className="text-[10px] font-black uppercase text-blue-600">{item.brand}</p></td><td className="p-3"><p className="font-bold text-slate-700">{item.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{item.category_name || 'Без категорії'} {item.supplier_name ? `· ${item.supplier_name}` : ''}</p></td><td className="p-3"><span className="bg-slate-100 rounded-xl px-3 py-1 font-black">{item.quantity} шт</span></td><td className="p-3 font-black">{money(item.buy_price)}</td><td className="p-3 font-black text-blue-600">{money(item.sell_price)}</td><td className="p-3 text-right"><button onClick={()=>handleDeleteItem(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td></tr>)}{!filteredItems.length&&<tr><td colSpan="6" className="p-10 text-center text-slate-400 font-black uppercase">Товарів не знайдено</td></tr>}</tbody></table></div><div className="md:hidden space-y-3">{filteredItems.map((item)=><StockCard key={item.id} item={item} onDelete={()=>handleDeleteItem(item.id)}/>)}</div></main></div>
    </>}

    {activeTab === 'receipts' && <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><h2 className="text-xl font-black uppercase text-slate-900">Прихід</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-blue-100 text-blue-700 rounded-xl px-5 py-3 text-xs font-black uppercase flex justify-center gap-2"><FileSpreadsheet size={15}/> Завантажити файл</button><button onClick={() => openReceipt()} className="bg-blue-600 text-white rounded-xl px-5 py-3 text-xs font-black uppercase flex justify-center gap-2"><Plus size={15}/> Новий прихід</button></div></div><ReceiptForm receipt={receipt} setReceipt={setReceipt} suppliers={suppliers} categories={categories} onSubmit={handleReceive}/></div>}

    {activeTab === 'history' && <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm"><h2 className="text-xl font-black uppercase text-slate-900 mb-4">Історія приходу</h2><div className="space-y-3">{movements.map((m)=><MovementCard key={m.id} m={m}/>) }{!movements.length&&<Empty text="Приходів ще немає"/>}</div></div>}

    {activeTab === 'suppliers' && <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm"><div className="flex flex-col md:flex-row justify-between gap-3 mb-5"><div><h2 className="text-xl font-black uppercase text-slate-900">Постачальники</h2><p className="text-xs font-bold text-slate-400 mt-1">Тут видно всі збережені постачальники компанії.</p></div><button onClick={() => setIsSupplierModalOpen(true)} className="bg-blue-600 text-white rounded-xl px-5 py-3 text-xs font-black uppercase flex justify-center gap-2"><Plus size={15}/> Додати постачальника</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{suppliers.map((s)=><div key={s.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4"><div className="flex justify-between gap-3"><h3 className="font-black text-slate-800 break-words">{s.name}</h3><button onClick={()=>handleDeleteSupplier(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div><p className="text-xs font-bold text-slate-400 mt-2">{s.api_key ? 'Підключення по API' : s.price_file ? 'Файл прайсу' : 'Ручний постачальник'}</p></div>)}{!suppliers.length&&<Empty text="Постачальників ще немає або API не повернув список"/>}</div></div>}

    {isCategoryModalOpen && <SimpleModal title="Нова категорія" onClose={()=>setIsCategoryModalOpen(false)}><form onSubmit={handleAddCategory} className="space-y-3"><Input required placeholder="Назва категорії" value={newCatName} onChange={(v)=>setNewCatName(v)}/><Submit>Зберегти</Submit></form></SimpleModal>}
    {isSupplierModalOpen && <SimpleModal title="Новий постачальник" onClose={()=>setIsSupplierModalOpen(false)}><form onSubmit={handleAddSupplier} className="space-y-3"><Input required placeholder="Назва постачальника" value={newSupplier.name} onChange={(v)=>setNewSupplier({...newSupplier,name:v})}/><Input placeholder="API ключ, якщо є" value={newSupplier.api_key} onChange={(v)=>setNewSupplier({...newSupplier,api_key:v})}/><input type="file" accept=".xls,.xlsx" onChange={(e)=>setNewSupplier({...newSupplier,price_file:e.target.files?.[0] || null})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"/><Submit>Додати</Submit></form></SimpleModal>}
    {isReceiptModalOpen && <SimpleModal title="Новий прихід" onClose={()=>setIsReceiptModalOpen(false)} wide><ReceiptForm receipt={receipt} setReceipt={setReceipt} suppliers={suppliers} categories={categories} onSubmit={handleReceive}/></SimpleModal>}
    {isImportModalOpen && <SimpleModal title="Імпорт Excel" onClose={()=>setIsImportModalOpen(false)}><form onSubmit={handleImport} className="space-y-3"><p className="text-sm font-bold text-slate-500">Колонки у файлі: бренд, артикул, назва, кількість, закупка, продаж. Можна також додати постачальник і категорія.</p><input type="file" accept=".xlsx,.xls" onChange={(e)=>setImportData({...importData,file:e.target.files?.[0] || null})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"/><Input placeholder="Постачальник для файлу, якщо його немає в Excel" value={importData.supplier_name} onChange={(v)=>setImportData({...importData,supplier_name:v})}/><Submit>Імпортувати</Submit></form></SimpleModal>}
  </div>;
}

function Tab({ active, onClick, icon, label }) { return <button onClick={onClick} className={`px-4 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>{icon}{label}</button>; }
function Stat({ label, value }) { return <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p></div>; }
function CategoryBtn({ active, onClick, label }) { return <button onClick={onClick} className={`px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap ${active ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}>{label}</button>; }
function Th({ children }) { return <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">{children}</th>; }
function StockCard({ item, onDelete }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div className="flex justify-between gap-3"><div><p className="font-black text-slate-900">{item.article}</p><p className="text-[10px] font-black uppercase text-blue-600">{item.brand}</p></div><button onClick={onDelete} className="text-red-400"><Trash2 size={16}/></button></div><p className="text-sm font-bold text-slate-700 mt-2">{item.name}</p><div className="grid grid-cols-3 gap-2 mt-3"><Small label="К-сть" value={`${item.quantity} шт`}/><Small label="Закупка" value={money(item.buy_price)}/><Small label="Продаж" value={money(item.sell_price)}/></div></div>; }
function Small({ label, value }) { return <div className="bg-white rounded-xl p-2 border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="text-xs font-black text-slate-800 break-words">{value}</p></div>; }
function ReceiptForm({ receipt, setReceipt, suppliers, categories, onSubmit }) { return <form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Select label="Постачальник" value={receipt.supplier} onChange={(v)=>setReceipt({...receipt,supplier:v,supplier_name:''})}><option value="">Ручний / новий</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>{!receipt.supplier&&<Labeled label="Назва постачальника"><Input placeholder="Напр. місцевий магазин" value={receipt.supplier_name} onChange={(v)=>setReceipt({...receipt,supplier_name:v})}/></Labeled>}<Select label="Категорія" value={receipt.category} onChange={(v)=>setReceipt({...receipt,category:v})}><option value="">Без категорії</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Labeled label="Бренд"><Input required value={receipt.brand} onChange={(v)=>setReceipt({...receipt,brand:v.toUpperCase()})}/></Labeled><Labeled label="Артикул"><Input required value={receipt.article} onChange={(v)=>setReceipt({...receipt,article:v.toUpperCase()})}/></Labeled><Labeled label="Кількість"><Input required type="number" min="1" value={receipt.quantity} onChange={(v)=>setReceipt({...receipt,quantity:v})}/></Labeled><Labeled label="Назва" span><Input required value={receipt.name} onChange={(v)=>setReceipt({...receipt,name:v})}/></Labeled><Labeled label="Закупка"><Input required type="number" step="0.01" value={receipt.buy_price} onChange={(v)=>setReceipt({...receipt,buy_price:v})}/></Labeled><Labeled label="Продаж"><Input type="number" step="0.01" value={receipt.sell_price} onChange={(v)=>setReceipt({...receipt,sell_price:v})}/></Labeled><label className="block md:col-span-3"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Примітка</span><textarea value={receipt.note || ''} onChange={(e)=>setReceipt({...receipt,note:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none min-h-[80px]"/></label></div><Submit>Провести прихід</Submit></form>; }
function MovementCard({ m }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><div className="flex flex-col md:flex-row md:items-center justify-between gap-2"><div><p className="font-black text-slate-900">{m.brand} {m.article}</p><p className="text-sm font-bold text-slate-600">{m.name}</p><p className="text-[10px] font-black uppercase text-slate-400 mt-1">{m.supplier_name || 'Без постачальника'} · {dateText(m.created_at)}</p></div><div className="grid grid-cols-3 gap-2 md:w-72"><Small label="К-сть" value={`${m.quantity} шт`}/><Small label="Закупка" value={money(m.buy_price)}/><Small label="Сума" value={money(m.total_sum)}/></div></div>{m.note&&<p className="text-xs font-semibold text-slate-500 mt-2">{m.note}</p>}</div>; }
function SimpleModal({ title, onClose, children, wide }) { return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4 flex items-start justify-center"><div className={`bg-white rounded-3xl w-full ${wide?'max-w-3xl':'max-w-md'} p-5 md:p-6 relative shadow-2xl my-8`}><button onClick={onClose} className="absolute right-4 top-4 bg-slate-100 rounded-full p-2 text-slate-400"><X size={18}/></button><h2 className="text-xl font-black uppercase text-slate-900 mb-5">{title}</h2>{children}</div></div>; }
function Input({ value, onChange, ...props }) { return <input {...props} value={value || ''} onChange={(e)=>onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500"/>; }
function Labeled({ label, children, span }) { return <label className={`block ${span?'md:col-span-3':''}`}><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">{label}</span>{children}</label>; }
function Select({ label, value, onChange, children }) { return <label className="block"><span className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">{label}</span><select value={value || ''} onChange={(e)=>onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none">{children}</select></label>; }
function Submit({ children }) { return <button className="w-full bg-blue-600 text-white rounded-xl p-3 font-black uppercase text-xs shadow-lg shadow-blue-100">{children}</button>; }
function Empty({ text }) { return <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-black uppercase text-xs">{text}</div>; }
