import React from 'react';
import { FileCheck2, Phone, Plus, Trash2 } from 'lucide-react';

const MAX_PHONES = 10;

export default function CompanyPhoneFields({ phones = [], onChange }) {
  const items = Array.isArray(phones) ? phones : [];

  const update = (index, patch) => {
    onChange(items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const addPhone = () => {
    if (items.length >= MAX_PHONES) return;
    onChange([...items, { number: '', show_in_documents: true }]);
  };

  const removePhone = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Телефони СТО</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Додайте потрібні номери та окремо виберіть, які з них друкувати в документах.</p>
        </div>
        <button
          type="button"
          onClick={addPhone}
          disabled={items.length >= MAX_PHONES}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs font-black uppercase text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          <Plus size={15}/> Додати номер
        </button>
      </div>

      {!items.length && (
        <button type="button" onClick={addPhone} className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500 hover:border-blue-300 hover:bg-blue-50">
          Додати перший номер телефону
        </button>
      )}

      {items.map((phone, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <label className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{index === 0 ? 'Основний номер' : `Додатковий номер ${index}`}</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Phone size={15} className="text-slate-400 shrink-0"/>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone.number || ''}
                  onChange={(event) => update(index, { number: event.target.value })}
                  placeholder="+380..."
                  className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                />
              </div>
            </label>

            <div className="flex items-center justify-between md:justify-end gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={phone.show_in_documents !== false}
                onClick={() => update(index, { show_in_documents: phone.show_in_documents === false })}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black transition ${phone.show_in_documents !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}
              >
                <span className={`relative h-5 w-9 rounded-full transition ${phone.show_in_documents !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${phone.show_in_documents !== false ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
                <FileCheck2 size={15}/>
                {phone.show_in_documents !== false ? 'У документах' : 'Не показувати'}
              </button>
              <button type="button" onClick={() => removePhone(index)} aria-label={`Видалити номер ${index + 1}`} className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100">
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
