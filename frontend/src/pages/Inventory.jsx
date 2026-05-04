import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/axios';

const Inventory = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/integrations/upload-prices/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStatus('success');
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-black uppercase mb-6 italic">Керування прайсами</h1>
      <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
        <Upload size={48} className="text-blue-500 mb-4" />
        <p className="text-slate-600 font-bold mb-2">Завантажте Excel файл постачальника</p>
        <p className="text-slate-400 text-xs mb-6 text-center">Формат: Бренд, Артикул, Назва, Ціна, Кількість</p>
        
        <input 
          type="file" 
          id="price-upload" 
          className="hidden" 
          onChange={(e) => setFile(e.target.files[0])}
          accept=".xlsx, .xls"
        />
        
        <label htmlFor="price-upload" className="cursor-pointer bg-slate-100 px-6 py-3 rounded-xl font-black uppercase text-sm hover:bg-slate-200 mb-4">
          {file ? file.name : "Обрати файл"}
        </label>

        {file && status === 'idle' && (
          <button onClick={handleUpload} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase shadow-lg shadow-blue-200">
            Імпортувати в базу
          </button>
        )}

        {status === 'uploading' && <p className="animate-pulse text-blue-600 font-bold">Обробяємо прайс...</p>}
        {status === 'success' && (
          <div className="flex items-center gap-2 text-green-600 font-bold">
            <CheckCircle /> Готово! Ціни оновлено
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
