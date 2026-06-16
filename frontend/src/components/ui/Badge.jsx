import React from 'react';
import { cn } from './utils';

const normalize = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeSupplier = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .replace(/[–—]/g, '-')
    .trim();

const supplierStyle = (supplier, children) => {
  const raw = normalizeSupplier(supplier || children || '');

  if (raw.includes('мій склад') || raw.includes('мой склад') || raw.includes('local') || raw.includes('склад / магазин') || raw === 'склад') {
    return 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200';
  }
  if (raw.includes('vesna')) return 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200';
  if (raw.includes('omega') || raw.includes('омега')) return 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200';
  if (raw.includes('tehno') || raw.includes('techno') || raw.includes('техно') || raw.includes('техномир')) return 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200';
  if (raw.includes('utr') || raw.includes('uniq') || raw.includes('unique') || raw.includes('юнік') || raw.includes('юник') || raw.includes('унік') || raw.includes('уник')) return 'bg-orange-400 text-black border-orange-500 shadow-md shadow-orange-200';
  if (raw.includes('bm')) return 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200';

  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const variants = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  status: 'bg-blue-100 text-blue-800 border-blue-200',
  payment: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  role: 'bg-purple-100 text-purple-800 border-purple-200',
  stock: 'bg-slate-100 text-slate-800 border-slate-200',
  priority: 'bg-amber-100 text-amber-900 border-amber-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-900 border-amber-200',
  danger: 'bg-rose-100 text-rose-800 border-rose-200',
  soft: 'bg-blue-50 text-blue-700 border-blue-100',
  outline: 'bg-white text-slate-700 border-slate-300',
  dark: 'bg-slate-900 text-white border-slate-900',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  blocked: 'bg-rose-100 text-rose-800 border-rose-200',
  trial: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  unpaid: 'bg-rose-100 text-rose-800 border-rose-200',
};

const statusStyles = [
  [['active', 'активний', 'увімкнено', 'enabled', 'done', 'completed', 'confirmed', 'підтверджено', 'оплачено', 'paid', 'arrived', 'отримано', 'success'], variants.success],
  [['trial', 'пробний', 'demo'], variants.trial],
  [['pending', 'очікує', 'waiting', 'wait', 'до замовлення', 'new', 'новий'], variants.pending],
  [['in transit', 'дорозі', 'замовлено', 'ordered', 'processing', 'process'], variants.info],
  [['payment due soon', 'grace', 'скоро', 'мʼякий', 'мякий', 'warning'], variants.warning],
  [['inactive', 'неактивний', 'вимкнено', 'disabled', 'archived', 'archive'], variants.inactive],
  [['blocked', 'заблоковано', 'expired', 'прострочена', 'прострочено', 'rejected', 'відхилено', 'unavailable', 'відмова', 'cancelled', 'скасовано', 'danger', 'error'], variants.danger],
  [['manual free', 'ручний доступ', 'free'], 'bg-violet-100 text-violet-800 border-violet-200'],
  [['reserved', 'резерв'], 'bg-indigo-100 text-indigo-800 border-indigo-200'],
  [['returned', 'повернення', 'return'], 'bg-cyan-100 text-cyan-800 border-cyan-200'],
];

const sizes = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-3.5 py-2 text-sm',
};

const dotColors = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
};

const detectTone = (style = '') => {
  if (style.includes('emerald') || style.includes('green')) return 'success';
  if (style.includes('amber') || style.includes('orange') || style.includes('yellow')) return 'warning';
  if (style.includes('rose') || style.includes('red')) return 'danger';
  if (style.includes('blue') || style.includes('cyan') || style.includes('indigo') || style.includes('violet')) return 'info';
  return 'neutral';
};

const statusStyle = (status, fallbackVariant) => {
  const raw = normalize(status);
  const direct = variants[raw.replace(/\s+/g, '_')] || variants[raw.replace(/\s+/g, '')] || variants[raw];
  if (direct) return direct;
  const found = statusStyles.find(([keys]) => keys.some((key) => raw.includes(normalize(key))));
  return found?.[1] || variants[fallbackVariant] || variants.default;
};

export default function Badge({
  variant = 'default',
  status,
  supplier,
  dot = false,
  size = 'sm',
  children,
  className = '',
}) {
  const content = children || supplier || status;
  const style = variant === 'supplier'
    ? supplierStyle(supplier, children)
    : status
      ? statusStyle(status, variant)
      : variants[variant] || statusStyle(variant, 'default');
  const tone = detectTone(style);

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border font-black leading-none whitespace-nowrap',
        sizes[size] || sizes.sm,
        style,
        className
      )}
      title={typeof content === 'string' ? content : undefined}
    >
      {dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColors[tone])} />}
      <span className="min-w-0 truncate">{content}</span>
    </span>
  );
}
