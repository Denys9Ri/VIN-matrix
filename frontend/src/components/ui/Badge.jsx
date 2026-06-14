import React from 'react';
import { cn } from './utils';

const normalizeSupplier = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .replace(/[–—]/g, '-')
    .trim();

const supplierStyle = (supplier, children) => {
  const raw = normalizeSupplier(supplier || children || '');

  if (
    raw.includes('мій склад') ||
    raw.includes('мой склад') ||
    raw.includes('local') ||
    raw.includes('склад / магазин') ||
    raw === 'склад'
  ) {
    return 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200';
  }

  if (raw.includes('vesna')) {
    return 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200';
  }

  if (raw.includes('omega') || raw.includes('омега')) {
    return 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200';
  }

  if (
    raw.includes('tehno') ||
    raw.includes('techno') ||
    raw.includes('техно') ||
    raw.includes('техномир')
  ) {
    return 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200';
  }

  if (
    raw.includes('utr') ||
    raw.includes('uniq') ||
    raw.includes('unique') ||
    raw.includes('юнік') ||
    raw.includes('юник') ||
    raw.includes('унік') ||
    raw.includes('уник')
  ) {
    return 'bg-orange-400 text-black border-orange-500 shadow-md shadow-orange-200';
  }

  if (raw.includes('bm')) {
    return 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const variants = {
  status: 'bg-blue-100 text-blue-800 border-blue-200',
  payment: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  role: 'bg-purple-100 text-purple-800 border-purple-200',
  stock: 'bg-slate-100 text-slate-800 border-slate-200',
  priority: 'bg-amber-100 text-amber-900 border-amber-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-900 border-amber-200',
  danger: 'bg-rose-100 text-rose-800 border-rose-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function Badge({ variant = 'default', supplier, children, className = '' }) {
  const style = variant === 'supplier'
    ? supplierStyle(supplier, children)
    : variants[variant] || variants.default;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black leading-none whitespace-nowrap',
        style,
        className
      )}
    >
      {children || supplier}
    </span>
  );
}
