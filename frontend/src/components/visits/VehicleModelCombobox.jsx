import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import {
  getVehicleModels,
  hasVehicleMakeInModelCatalog,
  searchVehicleModels,
  VEHICLE_MODEL_CATALOG_SOURCE,
} from '../../utils/vehicleModelCatalog';

export default function VehicleModelCombobox({ make = '', value = '', onChange, label = 'Модель' }) {
  const inputId = useId();
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const hasSelectedMake = hasVehicleMakeInModelCatalog(make);
  const availableModels = useMemo(() => getVehicleModels(make), [make]);
  const visibleModels = useMemo(
    () => searchVehicleModels(availableModels, showAll ? '' : value),
    [availableModels, showAll, value],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const chooseModel = (model) => {
    onChange(model);
    setShowAll(false);
    setIsOpen(false);
  };

  let emptyTitle = 'Модель не знайдено';
  let emptyHelp = 'Введене значення можна зберегти вручну.';
  if (!hasSelectedMake) {
    emptyTitle = 'Спочатку виберіть марку авто';
    emptyHelp = 'Модель усе одно можна ввести вручну.';
  } else if (!availableModels.length) {
    emptyTitle = 'Для цієї марки моделей у каталозі поки немає';
    emptyHelp = 'Введіть модель вручну.';
  }

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
            if (event.key === 'Enter' && isOpen && !showAll && value.trim() && visibleModels.length) {
              event.preventDefault();
              chooseModel(visibleModels[0]);
            }
          }}
          placeholder="Написати або вибрати модель..."
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
          aria-label="Відкрити список моделей авто"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
        >
          <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div id={`${inputId}-options`} role="listbox" className="max-h-60 overflow-y-auto p-1.5">
            {visibleModels.length ? visibleModels.map((model) => (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={model === value}
                onClick={() => chooseModel(model)}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-black text-slate-800 transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                {model}
              </button>
            )) : (
              <div className="px-3 py-4 text-center">
                <p className="text-sm font-black text-slate-600">{emptyTitle}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{emptyHelp}</p>
              </div>
            )}
          </div>
          <a
            href={VEHICLE_MODEL_CATALOG_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="block border-t border-slate-100 px-3 py-2 text-center text-[10px] font-bold text-slate-400 transition hover:text-blue-600"
          >
            Vehicle data by VehiclesDB
          </a>
        </div>
      )}
    </div>
  );
}
