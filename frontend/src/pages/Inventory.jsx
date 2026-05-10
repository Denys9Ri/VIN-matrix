import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Truck, Search, Plus, Trash2, Edit2, Tag, Key, FileSpreadsheet, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Inventory = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'suppliers'
  
  // Стан для складу
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Стан для постачальників
  const [suppliers, setSuppliers] = useState([]);
  
  // Модалки
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  
  // Форми
  const [newCatName, setNewCatName] = useState('');
  const [newItem, setNewItem] = useState({ brand: '', article: '', name: '', quantity: 1, buy_price: '', category: '' });
  const [newSupplier, setNewSupplier] = useState({ name: '', type: 'api', api_key: '', file: null });

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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 h-screen flex flex-col">
      
      {/* ШАПКА І ТАБИ */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 shrink-0">
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800">Управління</h1>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('stock')} 
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package size={16}/> Склад наявності
          </button>
          <button 
            onClick={() => setActiveTab('suppliers')} 
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'suppliers' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Truck size={16}/> Постачальники
          </button>
        </div>
      </div>

      {/* ===================== ВКЛАДКА: СКЛАД ===================== */}
      {activeTab === 'stock' && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          
          {/* САЙДБАР КАТЕГОРІЙ */}
          <div className="w-full lg:w-64 bg-white border border-slate-200 rounded-3xl p-5 flex flex-col shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black uppercase text-slate-700 text-sm tracking-widest flex items-center gap-2"><Tag size={16}/> Категорії</h3>
              <button onClick={() => setIsCategoryModalOpen(true)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={16}/></button>
            </div>
            
            <div className="space-y-2 overflow-y-auto flex-1 pr-2">
              <button onClick={() => setSelectedCategory('')} className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${selectedCategory === '' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'}`}>
                Усі товари
              </button>
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-1 group">
                  <button onClick={() => setSelectedCategory(c.id)} className={`flex-1 text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-all truncate ${selectedCategory === c.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'}`}>
                    {c.name}
                  </button>
                  <button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* ТАБЛИЦЯ ТОВАРІВ */}
          <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-5 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Пошук по артикулу, бренду, назві..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 font-medium transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button onClick={() => setIsItemModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all w-full md:w-auto justify-center">
                <Plus size={16}/> Додати товар
              </button>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
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
                        <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan="5" className="text-center p-10 text-slate-400 font-bold uppercase">Товарів не знайдено</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ВКЛАДКА: ПОСТАЧАЛЬНИКИ ===================== */}
      {activeTab === 'suppliers' && (
        <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-5 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black uppercase text-slate-800">Налаштування прайсів</h2>
            <button onClick={() => setIsSupplierModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
              <Plus size={16}/> Додати постачальника
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.map(s => (
              <div key={s.id} className="border border-slate-200 rounded-2xl p-5 flex flex-col relative group">
                <button onClick={() => handleDeleteSupplier(s.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
                
                <h3 className="font-black text-lg text-slate-800 mb-4 pr-6">{s.name}</h3>
                
                {s.api_key ? (
                  <div className="mt-auto bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                    <Key className="text-amber-500 shrink-0" size={20}/>
                    <div>
                      <p className="text-[10px] font-black uppercase text-amber-700 mb-1">Підключення по API</p>
                      <p className="text-xs font-mono text-amber-600 truncate max-w-[200px]">{s.api_key.substring(0, 10)}*****************</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                    <FileSpreadsheet className="text-emerald-500 shrink-0" size={20}/>
                    <div>
                      <p className="text-[10px] font-black uppercase text-emerald-700 mb-1">Файл прайсу (XLSX)</p>
                      <p className="text-xs font-bold text-emerald-600 truncate max-w-[200px]">{s.price_file ? s.price_file.split('/').pop() : 'Файл не знайдено'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === МОДАЛКИ === */}
      
      {/* Модалка: Нова Категорія */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsCategoryModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h2 className="text-lg font-black uppercase mb-4">Нова категорія</h2>
            <form onSubmit={handleAddCategory}>
              <input required autoFocus type="text" placeholder="Назва (напр. Масла)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 outline-none focus:border-blue-500 font-bold" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-black uppercase text-xs tracking-widest">Зберегти</button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Новий Товар */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsItemModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Package className="text-blue-600"/> Додати на склад</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-bold text-slate-700" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                <option value="">Без категорії</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              
              <div className="grid grid-cols-2 gap-4">
                <input required type="text" placeholder="Бренд (Bosch)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold uppercase" value={newItem.brand} onChange={e => setNewItem({...newItem, brand: e.target.value})} />
                <input required type="text" placeholder="Артикул" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold uppercase" value={newItem.article} onChange={e => setNewItem({...newItem, article: e.target.value})} />
              </div>
              
              <textarea required placeholder="Опис товару (Колодки гальмівні передні)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-medium min-h-[80px]" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Кількість (шт)</label>
                  <input required type="number" min="1" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-black text-lg text-center" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Собівартість (₴)</label>
                  <input required type="number" step="0.01" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-black text-lg text-blue-600 text-center" value={newItem.buy_price} onChange={e => setNewItem({...newItem, buy_price: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm mt-2 shadow-lg shadow-blue-200">Додати товар</button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Новий Постачальник */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsSupplierModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Truck className="text-blue-600"/> Новий постачальник</h2>
            
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6">
              <button onClick={() => setNewSupplier({...newSupplier, type: 'api'})} className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${newSupplier.type === 'api' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Ключ API</button>
              <button onClick={() => setNewSupplier({...newSupplier, type: 'file'})} className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${newSupplier.type === 'file' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Файл (Excel)</button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4">
              <input required type="text" placeholder="Назва постачальника (напр. Омега Авто)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
              
              {newSupplier.type === 'api' ? (
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="text" placeholder="Вставте ключ API" className="w-full bg-amber-50 border border-amber-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-amber-500 font-mono text-sm" value={newSupplier.api_key} onChange={e => setNewSupplier({...newSupplier, api_key: e.target.value})} />
                </div>
              ) : (
                <div className="border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-xl p-6 text-center">
                  <input required type="file" accept=".xls,.xlsx" id="file-upload" className="hidden" onChange={e => setNewSupplier({...newSupplier, file: e.target.files[0]})} />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <FileSpreadsheet className="text-emerald-500" size={32} />
                    <span className="font-bold text-emerald-700 text-sm">{newSupplier.file ? newSupplier.file.name : 'Оберіть файл .XLS або .XLSX'}</span>
                  </label>
                </div>
              )}

              <button type="submit" className="w-full bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm mt-4 shadow-lg">Зберегти постачальника</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
