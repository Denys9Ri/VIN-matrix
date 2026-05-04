import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Cloud, FileSpreadsheet, ShoppingCart, Loader2 } from 'lucide-react';
import api from '../api/axios';

const UniversalSearch = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  // Функція завантаження даних
  const fetchResults = async (art) => {
    setLoading(true);
    try {
      const response = await api.get('/integrations/search/', { params: { part_number: art } });
      setResults(response.data.results.map((item, idx) => ({ ...item, id: idx, margin: 25, marginType: '%' })));
    } catch (e) { console.error("Помилка:", e); }
    finally { setLoading(false); }
  };

  // Слідкуємо за URL (якщо ввели в шапці і перейшли сюди)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const art = params.get('part_number');
    if (art) fetchResults(art);
  }, [location.search]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-500">
          <Loader2 className="animate-spin" size={40} />
          <p className="font-bold">Шукаємо в Омега та прайсах...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b">
              <tr>
                <th className="px-6 py-4">Постачальник</th>
                <th className="px-6 py-4">Бренд / Артикул</th>
                <th className="px-6 py-4 text-center">Залишок</th>
                <th className="px-6 py-4 text-right">Вхідна (₴)</th>
                <th className="px-6 py-4 text-center">Націнка</th>
                <th className="px-6 py-4 text-right">Продаж (₴)</th>
                <th className="px-6 py-4 text-center">Дія</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr key={item.id} className="border-b hover:bg-slate-50">
                  <td className="px-6 py-4 flex items-center gap-2">
                    {item.type === 'API' ? <Cloud size={14} className="text-blue-500"/> : <FileSpreadsheet size={14} className="text-green-500"/>}
                    <span className="font-bold">{item.supplier}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900">{item.brand}</p>
                    <p className="text-xs font-mono text-slate-500">{item.part_number}</p>
                  </td>
                  <td className="px-6 py-4 text-center font-bold">{item.delivery_time}</td>
                  <td className="px-6 py-4 text-right">{item.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <input type="number" defaultValue={item.margin} className="w-12 border rounded text-center"/> {item.marginType}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-blue-600">
                    {(item.price * (1 + item.margin/100)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <button className="bg-blue-600 text-white p-2 rounded-lg hover:scale-105 transition-transform"><ShoppingCart size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-20 text-center text-slate-400">Введіть артикул у пошуку вгорі ☝️</div>
      )}
    </div>
  );
};

export default UniversalSearch;
