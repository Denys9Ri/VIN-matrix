import React, { useEffect, useState } from 'react';
import { Package, RefreshCcw, Settings2, Wallet } from 'lucide-react';
import Inventory from './Inventory';
import InventoryControlPanel from '../components/inventory/InventoryControlPanel';
import api from '../api/axios';

export default function InventoryStage6() {
  const [mode, setMode] = useState('control');
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadInsights = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/api/inventory/insights/');
      setInsights(res.data || {});
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося завантажити аналітику складу. Операційний склад працює без змін.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInsights(); }, []);

  const goToOperations = () => setMode('operations');

  return (
    <div className="w-full min-h-screen bg-slate-50/40 px-3 py-4 md:px-6 md:py-6 2xl:px-8">
      <div className="mx-auto max-w-[1780px] space-y-5">
        <div className="rounded-[30px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              <ModeButton active={mode === 'control'} onClick={() => setMode('control')} icon={<Wallet size={16}/>} label="Контроль грошей" />
              <ModeButton active={mode === 'operations'} onClick={() => setMode('operations')} icon={<Package size={16}/>} label="Операційний склад" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={loadInsights} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-600 shadow-sm transition hover:bg-slate-50">
                <RefreshCcw size={15}/> Оновити аналітику
              </button>
              <button type="button" onClick={goToOperations} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700">
                <Settings2 size={15}/> До приходу
              </button>
            </div>
          </div>
        </div>

        {message && <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{message}</div>}

        {mode === 'control' ? (
          <InventoryControlPanel insights={insights} loading={loading} onReceipt={goToOperations} />
        ) : (
          <div className="rounded-[34px] border border-slate-200 bg-white shadow-sm">
            <Inventory />
          </div>
        )}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase transition ${active ? 'bg-slate-950 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}>{icon}{label}</button>;
}
