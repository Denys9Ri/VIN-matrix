import React, { useState } from 'react';
import { Cloud, FileSpreadsheet, ShoppingCart } from 'lucide-react';

const UniversalSearch = () => {
  // Фейкові дані, які імітують відповідь нашого бекенду (UnifiedSearchView)
  const [results, setResults] = useState([
    { id: 1, supplier: 'Весна', type: 'API', brand: 'Sachs', partNo: '33526785432', isCross: false, stock: '6', delivery: 'Сьогодні', cost: 1100, margin: 25, marginType: '%' },
    { id: 2, supplier: 'Омега', type: 'API', brand: 'Meyle', partNo: '33391', isCross: true, stock: '12', delivery: 'Завтра', cost: 850, margin: 25, marginType: '%' },
    { id: 3, supplier: 'Автотехнікс', type: 'API', brand: 'BMW Original', partNo: '33526785432', isCross: false, stock: '14', delivery: '2 дні', cost: 2500, margin: 20, marginType: '%' },
    { id: 4, supplier: 'Іван-Авто (Локальний)', type: 'EXCEL', brand: 'Meyle', partNo: '33391', isCross: true, stock: '2', delivery: 'В наявності', cost: 800, margin: 500, marginType: 'UAH' },
  ]);

  // Функція для розрахунку кінцевої ціни продажу
  const calculateSellingPrice = (cost, margin, marginType) => {
    if (marginType === '%') {
      return cost + (cost * (margin / 100));
    }
    return cost + margin; // Якщо націнка в гривнях
  };

  // Функція для оновлення націнки конкретного рядка
  const handleMarginChange = (id, newMargin) => {
    setResults(results.map(item => 
      item.id === id ? { ...item, margin: Number(newMargin) } : item
    ));
  };

  return (
    <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      
      {/* Шапка таблиці */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <h2 className="font-bold text-lg text-slate-800 dark:text-white uppercase">
          Aggregated Price & Cross-Number View (15 Results)
        </h2>
        <div className="flex gap-4">
          <select className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Sort by: Lowest Price (UAH)</option>
            <option>Sort by: Fastest Delivery</option>
          </select>
        </div>
      </div>

      {/* Сама таблиця */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 uppercase border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3">Supplier</th>
              <th className="px-6 py-3">Brand</th>
              <th className="px-6 py-3">Part No.</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3 text-center">Stock</th>
              <th className="px-6 py-3">Delivery</th>
              <th className="px-6 py-3 text-right">Cost (UAH)</th>
              <th className="px-6 py-3 text-center">Мацінка</th>
              <th className="px-6 py-3 text-right font-bold text-slate-900 dark:text-white">Selling Price</th>
              <th className="px-6 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => {
              const sellingPrice = calculateSellingPrice(item.cost, item.margin, item.marginType);
              
              return (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  {/* Постачальник з іконкою */}
                  <td className="px-6 py-4 flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                    {item.type === 'API' ? (
                      <Cloud size={16} className="text-blue-500" title="API постачальник" />
                    ) : (
                      <FileSpreadsheet size={16} className="text-green-500" title="Excel прайс" />
                    )}
                    {item.supplier}
                  </td>
                  
                  <td className="px-6 py-4 font-semibold">{item.brand}</td>
                  <td className="px-6 py-4 font-mono">{item.partNo}</td>
                  
                  {/* Позначка Оригінал/Аналог */}
                  <td className="px-6 py-4">
                    {item.isCross ? (
                      <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded text-xs font-semibold">Cross</span>
                    ) : (
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded text-xs font-semibold">Original</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-center">{item.stock}</td>
                  <td className="px-6 py-4">{item.delivery}</td>
                  <td className="px-6 py-4 text-right font-medium">{item.cost.toFixed(2)} ₴</td>
                  
                  {/* Інтерактивний інпут мацінки */}
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-slate-400">+</span>
                      <input 
                        type="number" 
                        value={item.margin}
                        onChange={(e) => handleMarginChange(item.id, e.target.value)}
                        className="w-16 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-slate-500 font-medium">{item.marginType}</span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-right font-bold text-lg text-slate-900 dark:text-white">
                    {sellingPrice.toFixed(2)} ₴
                  </td>
                  
                  <td className="px-6 py-4 text-center">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 w-full justify-center transition-colors">
                      <ShoppingCart size={16} />
                      Add to Visit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UniversalSearch;
