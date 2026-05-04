import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Globe, FileSpreadsheet, CheckCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';

const Inventory = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', supplier_type: 'EXCEL', api_token: '' });
  const [loading, setLoading] = useState(false);

  // 1. Завантажуємо список постачальників
  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/integrations/suppliers/');
      setSuppliers(res.data);
    } catch (e) { console.error("Помилка завантаження постачальників"); }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  // 2. Створення постачальника
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/integrations/suppliers/', newSupplier);
      setIsAdding(false);
      fetchSuppliers();
    } catch (e) { alert("Помилка при створенні"); }
  };

  // 3. Завантаження файлу для конкретного постачальника
  const handleFileUpload = async (supplierId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('supplier_id', supplierId);
    
    setLoading(true);
    try {
      await api.post('/integrations/upload-prices/', formData);
      alert("Прайс успішно оновлено!");
    } catch (e) { alert("Помилка завантаження файлу"); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">Керування Постачальниками</h1>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2"
        >
          <Plus size={18}/> Додати джерело
        </button>
      </div>

      {/* ФОРМА ДОДАВАННЯ */}
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 mb-8 shadow-xl animate-in fade-in zoom-in duration-200">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input required placeholder="Назва (напр. Склад Київ)" className="border p-3 rounded-xl"
                   value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}/>
            <select className="border p-3 rounded-xl" value={newSupplier.supplier_type}
                    onChange={e => setNewSupplier({...newSupplier, supplier_type: e.target.value})}>
              <option value="EXCEL">Excel Прайс</option>
              <option value="API">API Підключення</option>
            </select>
            {newSupplier.supplier_type === 'API' && (
              <input placeholder="API Ключ" className="border p-3 rounded-xl"
                     value={newSupplier.api_token} onChange={e => setNewSupplier({...newSupplier, api_token: e.target.value})}/>
            )}
            <div className="md:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-400">Скасувати</button>
              <button type="submit" className="bg-slate-900 text-white px-8 py-2 rounded-xl font-bold">Зберегти</button>
            </div>
          </form>
        </div>
      )}

      {/* СПИСОК ПОСТАЧАЛЬНИКІВ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${s.supplier_type === 'API' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
                {s.supplier_type === 'API' ? <Globe size={24}/> : <FileSpreadsheet size={24}/>}
              </div>
              <div>
                <h3 className="font-black text-slate-900 uppercase text-sm">{s.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{s.supplier_type}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {s.supplier_type === 'EXCEL' && (
                <label className="cursor-pointer bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                  <Upload size={18}/>
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(s.id, e.target.files[0])}/>
                </label>
              )}
              <button className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                <Trash2 size={18}/>
              </button>
            </div>
          </div>
        ))}
      </div>
      {loading && <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center font-black animate-pulse">ОБРОБКА ФАЙЛУ...</div>}
    </div>
  );
};

export default Inventory;
