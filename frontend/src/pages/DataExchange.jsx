import React, { useRef, useState } from 'react';
import { Download, Upload, DatabaseBackup, FileSpreadsheet, Users, Package, ClipboardList, ShieldCheck, XCircle } from 'lucide-react';
import api from '../api/axios';

const getErrorMessage = (error) => error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Невідома помилка';

async function downloadFile(path, fallbackName) {
  const response = await api.get(path, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default function DataExchange() {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);

  const notify = (type, text) => setNotice({ type, text });

  const handleDownload = async (path, fallbackName, title) => {
    setDownloading(title);
    setNotice(null);
    try {
      await downloadFile(path, fallbackName);
      notify('success', `Файл “${title}” сформовано та завантажено.`);
    } catch (error) {
      notify('error', `Не вдалося сформувати файл: ${getErrorMessage(error)}`);
    } finally {
      setDownloading('');
    }
  };

  const importClients = async (file) => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setNotice(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/api/import/clients/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      notify('success', res.data?.message || `Імпортовано: ${res.data?.created || 0}, пропущено: ${res.data?.skipped || 0}`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      notify('error', `Не вдалося імпортувати клієнтів: ${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-blue-600 mb-2"><FileSpreadsheet size={24}/><span className="text-xs font-black uppercase tracking-widest">Імпорт / експорт</span></div>
          <h1 className="text-3xl md:text-4xl font-black italic uppercase text-slate-900">Дані бізнесу</h1>
          <p className="text-slate-500 font-semibold mt-2 max-w-2xl">Експорт клієнтів, замовлень, складу, резервна копія та імпорт старої клієнтської бази з Excel або CSV.</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-emerald-700 text-sm font-bold flex items-center gap-2">
          <ShieldCheck size={18}/> Дані тільки вашої компанії
        </div>
      </div>

      {notice && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-between gap-3 ${notice.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100"><XCircle size={16}/></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ExportCard icon={<Users/>} title="Клієнти" desc="ПІБ, телефон, кількість замовлень, суми, борги, статус клієнта." loading={downloading === 'Клієнти'} onClick={() => handleDownload('/api/export/clients/', 'vin_matrix_clients.csv', 'Клієнти')} />
        <ExportCard icon={<ClipboardList/>} title="Замовлення / візити" desc="ID, статус, клієнт, авто, VIN, суми, борг, доставка, коментар." loading={downloading === 'Замовлення / візити'} onClick={() => handleDownload('/api/export/orders/', 'vin_matrix_orders.csv', 'Замовлення / візити')} />
        <ExportCard icon={<Package/>} title="Склад" desc="Бренд, артикул, назва, залишок, закупка, продаж, постачальник." loading={downloading === 'Склад'} onClick={() => handleDownload('/api/export/inventory/', 'vin_matrix_inventory.csv', 'Склад')} />
        <ExportCard icon={<DatabaseBackup/>} title="Резервна копія" desc="JSON-копія клієнтів, замовлень, товарів, робіт і складу." loading={downloading === 'Резервна копія'} onClick={() => handleDownload('/api/export/backup/', 'vin_matrix_backup.json', 'Резервна копія')} dark />
      </div>

      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Міграція з Excel / зошита</p>
          <h2 className="text-2xl font-black uppercase mt-1">Імпорт старої бази клієнтів</h2>
          <p className="text-sm font-semibold text-blue-100 mt-2 max-w-2xl">Завантажте CSV або XLSX. Система шукає колонки: Клієнт, Телефон, Авто, VIN, Коментар. Якщо клієнт із таким телефоном вже є — він буде пропущений.</p>
        </div>
        <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={(e) => importClients(e.target.files?.[0])} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="w-full min-h-[120px] rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-3 text-center p-5 disabled:opacity-60">
              <Upload className="text-blue-600" size={32}/>
              <span className="font-black uppercase text-slate-900">{importing ? 'Імпортуємо...' : 'Вибрати файл клієнтів'}</span>
              <span className="text-xs font-bold text-slate-500">CSV або XLSX до імпорту</span>
            </button>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <p className="text-xs font-black uppercase text-slate-400 mb-3">Приклад колонок</p>
            <div className="space-y-2 text-sm font-bold text-slate-700"><p>Клієнт</p><p>Телефон</p><p>Авто</p><p>VIN</p><p>Коментар</p></div>
          </div>
        </div>
        {result && <div className="mx-5 md:mx-6 mb-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-700 font-bold">{result.message || `Імпортовано: ${result.created}, пропущено: ${result.skipped}`}</div>}
      </div>
    </div>
  );
}

function ExportCard({ icon, title, desc, onClick, dark, loading }) {
  return <button disabled={loading} onClick={onClick} className={`text-left rounded-[26px] p-5 border shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0 ${dark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-white/10 text-blue-200' : 'bg-blue-50 text-blue-600'}`}>{React.cloneElement(icon, { size: 23 })}</div>
    <h3 className="font-black uppercase text-lg">{title}</h3>
    <p className={`text-sm font-semibold mt-2 min-h-[62px] ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{desc}</p>
    <div className={`mt-4 flex items-center gap-2 text-xs font-black uppercase ${dark ? 'text-blue-200' : 'text-blue-600'}`}><Download size={15}/> {loading ? 'Формуємо...' : 'Завантажити'}</div>
  </button>;
}
