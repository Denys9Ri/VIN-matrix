import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Truck, Search, Plus, Trash2, Tag, Key, FileSpreadsheet, X, Settings2, Download, Save, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Inventory = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stock'); 
  
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [suppliers, setSuppliers] = useState([]);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [selectedSupplierForWarehouses, setSelectedSupplierForWarehouses] = useState(null);
  const [warehousePrefs, setWarehousePrefs] = useState([]);
  const [isFetchingWarehouses, setIsFetchingWarehouses] = useState(false);
  
  const [newCatName, setNewCatName] = useState('');
  const [newItem, setNewItem] = useState({ brand: '', article: '', name: '', quantity: 1, buy_price: '', category: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', type: 'api', api_key: '', file: null });

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editingApiKey, setEditingApiKey] = useState('');


  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    fetchData();
  }, [selectedCategory, searchQuery, activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'stock') {
        const catRes = await axios.get(`${API_BASE}/api/categories/`, { headers: { Authorization: `Bearer ${token}` }});
        setCategories(catRes.data);
        
        let url = `${API_BASE}/api/inventory/?`;
        if (selectedCategory) url += `category=${selectedCategory}&`;
        if (searchQuery) url += `search=${searchQuery}`;
        
        const itemRes = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }});
        setItems(itemRes.data);
      } else {
        const supRes = await axios.get(`${API_BASE}/api/suppliers/`, { headers: { Authorization: `Bearer ${token}` }});
        setSuppliers(supRes.data);
      }
    } catch (error) {
      if (error.response?.status === 401) navigate('/login');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/api/categories/`, { name: newCatName }, { headers: { Authorization: `Bearer ${token}` }});
    setNewCatName(''); setIsCategoryModalOpen(false); fetchData();
  };

  const handleDeleteCategory = async (id) => {
    if(window.confirm("Видалити категорію? Товари залишаться без категорії.")) {
      await axios.delete(`${API_BASE}/api/categories/${id}/`, { headers: { Authorization: `Bearer ${token}` }});
      if(selectedCategory === id) setSelectedCategory('');
      fetchData();
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/api/inventory/`, newItem, { headers: { Authorization: `Bearer ${token}` }});
    setNewItem({ brand: '', article: '', name: '', quantity: 1, buy_price: '', category: selectedCategory || '' });
    setIsItemModalOpen(false); fetchData();
  };

  const handleDeleteItem = async (id) => {
    if(window.confirm("Видалити товар?")) {
      await axios.delete(`${API_BASE}/api/inventory/${id}/`, { headers: { Authorization: `Bearer ${token}` }});
      fetchData();
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', newSupplier.name);
    if (newSupplier.type === 'api') formData.append('api_key', newSupplier.api_key);
    if (newSupplier.type === 'file' && newSupplier.file) formData.append('price_file', newSupplier.file);

    await axios.post(`${API_BASE}/api/suppliers/`, formData, { headers: { Authorization: `Bearer ${token}` }});
    setNewSupplier({ name: '', type: 'api', api_key: '', file: null });
    setIsSupplierModalOpen(false); fetchData();
  };

  const handleDeleteSupplier = async (id) => {
    if(window.confirm("Видалити постачальника?")) {
      await axios.delete(`${API_BASE}/api/suppliers/${id}/`, { headers: { Authorization: `Bearer ${token}` }});
      fetchData();
    }
  };


  const openApiKeyModal = (supplier) => {
    setEditingSupplier(supplier);
    setEditingApiKey(supplier.api_key || '');
    setIsApiKeyModalOpen(true);
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!editingSupplier) return;
    await axios.patch(`${API_BASE}/api/suppliers/${editingSupplier.id}/`, { api_key: editingApiKey }, { headers: { Authorization: `Bearer ${token}` }});
    setIsApiKeyModalOpen(false);
    setEditingSupplier(null);
    setEditingApiKey('');
    fetchData();
  };

  const openWarehouseModal = (supplier) => {
    setSelectedSupplierForWarehouses(supplier);
    setWarehousePrefs(supplier.warehouse_prefs || []);
    setIsWarehouseModalOpen(true);
  };

  const handleFetchWarehouses = async () => {
    setIsFetchingWarehouses(true);
    try {
      const res = await axios.post(`${API_BASE}/api/suppliers/${selectedSupplierForWarehouses.id}/fetch_warehouses/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setWarehousePrefs(res.data.warehouses);
      alert(res.data.message);
    } catch (error) {
      alert(error.response?.data?.error || "Помилка завантаження складів.");
    } finally {
      setIsFetchingWarehouses(false);
    }
  };

  const handleAddManualWarehouse = () => {
    const newId = `manual_${Date.now()}`;
    setWarehousePrefs([...warehousePrefs, { id: newId, name: '', priority: 99, is_active: true }]);
  };

  const handleUpdateWarehousePref = (index, field, value) => {
    const newPrefs = [...warehousePrefs];
    newPrefs[index][field] = value;
    setWarehousePrefs(newPrefs);
  };

  const handleRemoveWarehousePref = (index) => {
    const newPrefs = warehousePrefs.filter((_, i) => i !== index);
    setWarehousePrefs(newPrefs);
  };

  const handleSaveWarehousePrefs = async () => {
    try {
      await axios.patch(`${API_BASE}/api/suppliers/${selectedSupplierForWarehouses.id}/`, { warehouse_prefs: warehousePrefs }, { headers: { Authorization: `Bearer ${token}` } });
      setIsWarehouseModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Помилка збереження налаштувань.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 h-screen flex flex-col overflow-x-hidden">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 shrink-0 mt-4 md:mt-0">
        <h1 className="text-xl md:text-3xl font-black uppercase italic text-slate-800">Управління</h1>
        
        {/* Адаптивні вкладки для мобільного */}
        <div className="flex bg-slate-100 p-1 md:p-1.5 rounded-xl md:rounded-2xl w-full md:w-auto">
          <button onClick={() => setActiveTab('stock')} className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <Package size={16}/> <span className="truncate">Склад наявності</span>
          </button>
          <button onClick={() => setActiveTab('suppliers')} className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-all ${activeTab === 'suppliers' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <Truck size={16}/> <span className="truncate">Постачальники</span>
          </button>
        </div>
      </div>

      {activeTab === 'stock' && (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-0 pb-10 md:pb-0">
          <div className="w-full lg:w-64 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-col shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black uppercase text-slate-700 text-xs md:text-sm tracking-widest flex items-center gap-2"><Tag size={16}/> Категорії</h3>
              <button onClick={() => setIsCategoryModalOpen(true)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={16}/></button>
            </div>
            
            {/* На мобільному робимо категорії горизонтальними або компактними */}
            <div className="flex flex-row lg:flex-col gap-2 lg:gap-0 lg:space-y-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 lg:pr-2 flex-nowrap">
              <button onClick={() => setSelectedCategory('')} className={`shrink-0 lg:w-full text-left px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${selectedCategory === '' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600 bg-slate-50 lg:bg-transparent'}`}>
                Усі товари
              </button>
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-1 group shrink-0 lg:w-full">
                  <button onClick={() => setSelectedCategory(c.id)} className={`flex-1 text-left px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all truncate ${selectedCategory === c.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600 bg-slate-50 lg:bg-transparent'}`}>
                    {c.name}
                  </button>
                  <button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-slate-300 hover:text-red-500 lg:opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Пошук по артикулу, бренду..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs md:text-sm outline-none focus:border-blue-500 font-medium transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button onClick={() => setIsItemModalOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all shrink-0">
                <Plus size={16}/> Додати товар
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b-2 border-slate-100">
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Артикул / Бренд</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Опис товару</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Кіл-ть</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Собівартість</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                      <td className="p-3">
                        <p className="font-black text-sm text-slate-800">{item.article}</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase">{item.brand}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-sm text-slate-700">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{item.category_name || 'Без категорії'}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-black text-sm">{item.quantity} шт</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-black text-slate-800">{item.buy_price} ₴</span>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors md:opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan="5" className="text-center p-10 text-slate-400 font-bold uppercase text-xs md:text-sm">Товарів не знайдено</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-8 pb-10">
          {/* АДАПТИВНА КНОПКА ДОДАТИ ПОСТАЧАЛЬНИКА */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <h2 className="text-lg md:text-xl font-black uppercase text-slate-800">Налаштування прайсів</h2>
            <button onClick={() => setIsSupplierModalOpen(true)} className="w-full sm:w-auto bg-blue-600 text-white px-5 py-3 sm:py-2.5 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all shrink-0">
              <Plus size={16}/> <span className="sm:hidden">Додати</span><span className="hidden sm:inline">Додати постачальника</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {suppliers.map(s => (
              <div key={s.id} className="border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col relative group hover:border-blue-200 transition-colors bg-slate-50/30">
                <div className="absolute top-4 right-4 flex gap-2 lg:opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => openApiKeyModal(s)} className="text-slate-400 hover:text-amber-600 bg-white p-1.5 rounded-md shadow-sm border border-slate-100" title="API ключ"><Pencil size={16}/></button>
                  <button onClick={() => openWarehouseModal(s)} className="text-slate-400 hover:text-blue-600 bg-white p-1.5 rounded-md shadow-sm border border-slate-100" title="Налаштування складів"><Settings2 size={16}/></button>
                  <button onClick={() => handleDeleteSupplier(s.id)} className="text-slate-400 hover:text-red-500 bg-white p-1.5 rounded-md shadow-sm border border-slate-100" title="Видалити"><Trash2 size={16}/></button>
                </div>
                
                <h3 className="font-black text-base md:text-lg text-slate-800 mb-4 pr-16 truncate">{s.name}</h3>
                
                {s.api_key ? (
                  <div className="mt-auto bg-amber-50 border border-amber-100 rounded-xl p-3 md:p-4 flex items-start gap-2.5">
                    <Key className="text-amber-500 shrink-0 mt-0.5" size={16}/>
                    <div className="overflow-hidden">
                      <p className="text-[9px] md:text-[10px] font-black uppercase text-amber-700 mb-1">Підключення по API</p>
                      <p className="text-[10px] md:text-xs font-mono text-amber-600 truncate">{s.api_key.substring(0, 10)}*****************</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto bg-emerald-50 border border-emerald-100 rounded-xl p-3 md:p-4 flex items-start gap-2.5">
                    <FileSpreadsheet className="text-emerald-500 shrink-0 mt-0.5" size={16}/>
                    <div className="overflow-hidden">
                      <p className="text-[9px] md:text-[10px] font-black uppercase text-emerald-700 mb-1">Файл прайсу (XLSX)</p>
                      <p className="text-[10px] md:text-xs font-bold text-emerald-600 truncate">{s.price_file ? s.price_file.split('/').pop() : 'Файл не знайдено'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* МОДАЛКИ */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsCategoryModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h2 className="text-lg font-black uppercase mb-4">Нова категорія</h2>
            <form onSubmit={handleAddCategory}>
              <input required autoFocus type="text" placeholder="Назва (напр. Масла)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 outline-none focus:border-blue-500 font-bold" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-colors">Зберегти</button>
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto pt-10 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 md:p-6 relative my-auto shadow-2xl border border-slate-100">
            <button onClick={() => setIsItemModalOpen(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
            <h2 className="text-lg md:text-xl font-black uppercase mb-6 flex items-center gap-2"><Package className="text-blue-600"/> Додати товар</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-bold text-slate-700 text-sm md:text-base cursor-pointer" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                <option value="">Без категорії</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <input required type="text" placeholder="Бренд" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold uppercase text-sm md:text-base" value={newItem.brand} onChange={e => setNewItem({...newItem, brand: e.target.value})} />
                <input required type="text" placeholder="Артикул" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold uppercase text-sm md:text-base" value={newItem.article} onChange={e => setNewItem({...newItem, article: e.target.value})} />
              </div>
              <textarea required placeholder="Опис товару" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-medium min-h-[80px] text-sm md:text-base resize-none" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3 md:gap-4 items-end">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Кількість (шт)</label>
                  <input required type="number" min="1" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-black text-base md:text-lg text-center" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Собівартість (₴)</label>
                  <input required type="number" step="0.01" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-black text-base md:text-lg text-blue-600 text-center" value={newItem.buy_price} onChange={e => setNewItem({...newItem, buy_price: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-xs md:text-sm mt-4 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">Додати товар</button>
            </form>
          </div>
        </div>
      )}

      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 md:p-6 relative shadow-2xl">
            <button onClick={() => setIsSupplierModalOpen(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
            <h2 className="text-lg md:text-xl font-black uppercase mb-6 flex items-center gap-2"><Truck className="text-blue-600"/> Новий постачальник</h2>
            
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6">
              <button onClick={() => setNewSupplier({...newSupplier, type: 'api'})} className={`flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all ${newSupplier.type === 'api' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Ключ API</button>
              <button onClick={() => setNewSupplier({...newSupplier, type: 'file'})} className={`flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all ${newSupplier.type === 'file' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Файл (Excel)</button>
            </div>
            
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <input required type="text" placeholder="Назва постачальника" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold text-sm" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
              {newSupplier.type === 'api' ? (
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input required type="text" placeholder="Вставте ключ API" className="w-full bg-amber-50 border border-amber-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-amber-500 font-mono text-xs md:text-sm" value={newSupplier.api_key} onChange={e => setNewSupplier({...newSupplier, api_key: e.target.value})} />
                </div>
              ) : (
                <div className="border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-xl p-6 text-center transition-colors hover:bg-emerald-100/50">
                  <input required type="file" accept=".xls,.xlsx" id="file-upload" className="hidden" onChange={e => setNewSupplier({...newSupplier, file: e.target.files[0]})} />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <FileSpreadsheet className="text-emerald-500" size={32} />
                    <span className="font-bold text-emerald-700 text-xs md:text-sm">{newSupplier.file ? newSupplier.file.name : 'Оберіть файл .XLS або .XLSX'}</span>
                  </label>
                </div>
              )}
              <button type="submit" className="w-full bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-xs md:text-sm mt-4 shadow-lg hover:bg-slate-900 transition-colors">Зберегти постачальника</button>
            </form>
          </div>
        </div>
      )}


      {isApiKeyModalOpen && editingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsApiKeyModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h2 className="text-lg font-black uppercase mb-4">API ключ: {editingSupplier.name}</h2>
            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <input required type="text" value={editingApiKey} onChange={e => setEditingApiKey(e.target.value)} placeholder="Вставте ключ API" className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 outline-none focus:border-amber-500 font-mono text-xs md:text-sm" />
              <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-colors">Зберегти ключ</button>
            </form>
          </div>
        </div>
      )}

      {isWarehouseModalOpen && selectedSupplierForWarehouses && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto pt-10 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-4 sm:p-6 md:p-8 relative shadow-2xl my-auto">
            <button onClick={() => setIsWarehouseModalOpen(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X size={20} /></button>
            
            <div className="mb-6 border-b border-slate-100 pb-4 pr-8">
              <h2 className="text-lg md:text-2xl font-black uppercase flex items-center gap-2 truncate"><Settings2 className="text-blue-600 shrink-0"/> Склади: {selectedSupplierForWarehouses.name}</h2>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-2">Виставте пріоритет (1 - найвищий) та вимкніть склади, які не потрібні.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
              <button onClick={handleFetchWarehouses} disabled={isFetchingWarehouses} className="w-full sm:w-auto sm:flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 p-3 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-blue-100">
                {isFetchingWarehouses ? 'Завантаження...' : <><Download size={16}/> Отримати з API</>}
              </button>
              <button onClick={handleAddManualWarehouse} className="w-full sm:w-auto sm:flex-1 bg-slate-50 text-slate-600 hover:bg-slate-100 p-3 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200">
                <Plus size={16}/> Додати вручну
              </button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {warehousePrefs.length === 0 && <p className="text-center text-slate-400 font-bold py-6 text-sm">Складів ще немає. Завантажте з API або додайте вручну.</p>}
              
              {warehousePrefs.map((wh, index) => (
                <div key={wh.id || index} className={`flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 p-3 rounded-xl border transition-all ${wh.is_active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  
                  <label className="flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={wh.is_active} onChange={(e) => handleUpdateWarehousePref(index, 'is_active', e.target.checked)} />
                  </label>
                  
                  <input type="text" placeholder="Назва складу (Київ)" className="flex-1 min-w-[120px] bg-transparent border-none outline-none font-bold text-xs md:text-sm text-slate-800" value={wh.name} onChange={(e) => handleUpdateWarehousePref(index, 'name', e.target.value)} />
                  
                  <div className="flex items-center gap-1.5 md:gap-2 bg-slate-100 px-2 md:px-3 py-1.5 rounded-lg shrink-0">
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">Пріоритет</span>
                    <input type="number" min="1" max="999" className="w-10 md:w-12 bg-transparent border-none outline-none font-black text-blue-600 text-center text-xs md:text-sm" value={wh.priority} onChange={(e) => handleUpdateWarehousePref(index, 'priority', e.target.value)} />
                  </div>

                  <button type="button" onClick={() => handleRemoveWarehousePref(index)} className="text-slate-300 hover:text-red-500 p-1.5 bg-white sm:bg-transparent rounded-lg border border-slate-100 sm:border-transparent transition-colors shrink-0" title="Видалити склад">
                    <Trash2 size={16}/>
                  </button>

                </div>
              ))}
            </div>

            <button onClick={handleSaveWarehousePrefs} className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black uppercase tracking-widest text-xs md:text-sm mt-6 shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all">
              <Save className="inline-block mr-2 mb-0.5" size={18}/> Зберегти налаштування
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
