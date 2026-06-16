import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './utils';

const variants = {
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-slate-400',
  soft: 'border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-500',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-400',
  danger: 'bg-rose-600 text-white shadow-sm shadow-rose-100 hover:bg-rose-700 focus:ring-rose-500',
  dangerSoft: 'border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-500',
  success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-100 hover:bg-emerald-700 focus:ring-emerald-500',
  warning: 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-100 hover:bg-amber-500 focus:ring-amber-500',
  dark: 'bg-slate-900 text-white shadow-sm shadow-slate-100 hover:bg-slate-800 focus:ring-slate-700',
  outline: 'border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
  link: 'bg-transparent px-0 text-blue-700 hover:text-blue-800 hover:underline focus:ring-blue-500',
};

const sizes = {
  xs: 'h-8 px-2.5 text-xs rounded-lg',
  sm: 'h-9 px-3 text-xs rounded-xl',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-sm rounded-2xl',
  xl: 'h-14 px-6 text-base rounded-2xl',
};

const iconSizes = {
  xs: 'h-8 w-8 rounded-lg',
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-14 w-14 rounded-2xl',
};

const minWidths = {
  none: '',
  sm: 'min-w-[96px]',
  md: 'min-w-[128px]',
  lg: 'min-w-[168px]',
  xl: 'min-w-[220px]',
};

const textCases = {
  none: '',
  normal: 'normal-case',
  uppercase: 'uppercase tracking-widest',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  iconOnly = false,
  fullWidth = false,
  fullWidthMobile = false,
  minWidth = 'none',
  important = false,
  uppercase = false,
  textCase,
  title,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  const resolvedTextCase = textCase || (uppercase || important ? 'uppercase' : 'normal');
  const resolvedMinWidth = important && minWidth === 'none' ? 'md' : minWidth;
  const buttonTitle = title || (iconOnly && typeof children === 'string' ? children : undefined);

  return (
    <button
      type={type}
      title={buttonTitle}
      aria-label={iconOnly && typeof children === 'string' ? children : props['aria-label']}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap font-black leading-none transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.99]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant] || variants.primary,
        iconOnly ? iconSizes[size] || iconSizes.md : sizes[size] || sizes.md,
        !iconOnly && minWidths[resolvedMinWidth],
        fullWidth && 'w-full',
        fullWidthMobile && 'w-full sm:w-auto',
        textCases[resolvedTextCase] || '',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : icon ? React.cloneElement(icon, { className: cn('shrink-0', icon.props?.className) }) : null}
      {!iconOnly && children && <span className="min-w-0 truncate">{children}</span>}
      {!iconOnly && iconRight ? React.cloneElement(iconRight, { className: cn('shrink-0', iconRight.props?.className) }) : null}
    </button>
  );
}
