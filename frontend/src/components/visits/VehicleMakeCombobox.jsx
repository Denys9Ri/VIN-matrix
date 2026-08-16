import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import { searchVehicleMakes, VEHICLE_MAKES } from '../../utils/vehicleMakeCatalog';

export default function VehicleMakeCombobox({ value = '', onChange, label = 'Марка' }) {
  const inputId = useId();
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visibleMakes = useMemo(
    () => searchVehicleMakes(VEHICLE_MAKES, showAll ? '' : value),
    [showAll, value],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const chooseMake = (make) => {
    onChange(make);
    setShowAll(false);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative block min-w-0">
      <label htmlFor={inputId} className="ml-1 mb-1.5 block text-[11px] font-black uppercase text-slate-500">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${inputId}-options`}
          aria-expanded={isOpen}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setShowAll(false);
            setIsOpen(true);
          }}
          onFocus={(event) => {
            setIsOpen(true);
            setShowAll(!value);
            if (value) event.currentTarget.select();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
            if (event.key === 'ArrowDown') setIsOpen(true);
            if (event.key === 'Enter' && isOpen && !showAll && value.trim() && visibleMakes.length) {
              event.preventDefault();
              chooseMake(visibleMakes[0]);
            }
          }}
          placeholder="Написати або вибрати марку..."
          autoComplete="off"
          className="w-full min-h-[46px] rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-extrabold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white"
        />
        <button
          type="button"
          onClick={() => {
            if (isOpen && showAll) {
              setIsOpen(false);
              return;
            }
            setShowAll(true);
            setIsOpen(true);
          }}
          aria-label="Відкрити список марок авто"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
        >
          <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div id={`${inputId}-options`} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {visibleMakes.length ? visibleMakes.map((make) => (
            <button
              key={make}
              type="button"
              role="option"
              aria-selected={make === value}
              onClick={() => chooseMake(make)}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-black text-slate-800 transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
            >
              {make}
            </button>
          )) : (
            <div className="px-3 py-4 text-center">
              <p className="text-sm font-black text-slate-600">Марку не знайдено</p>
              <p className="mt-1 text-xs font-bold text-slate-400">Введене значення можна зберегти вручну.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
