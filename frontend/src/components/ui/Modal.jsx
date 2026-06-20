import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import { cn } from './utils';

const sizes = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
  full: 'sm:max-w-[min(1280px,calc(100vw-2rem))]',
};

const footerAlignments = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  between: 'justify-between',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  fullscreenMobile = true,
  closeOnBackdrop = true,
  closeOnEsc = true,
  showClose = true,
  footerAlign = 'right',
  className = '',
  panelClassName = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => {
      if (closeOnEsc && event.key === 'Escape') onClose?.();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, closeOnEsc]);

  if (!open) return null;

  const hasHeader = title || description || showClose;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-slate-950/55 backdrop-blur-sm',
        fullscreenMobile ? 'items-stretch justify-center p-0 sm:items-center sm:p-4' : 'items-center justify-center p-4',
        className
      )}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Діалогове вікно'}
        className={cn(
          'flex w-full flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-slate-900/5',
          fullscreenMobile ? 'h-dvh rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-[28px]' : 'max-h-[90vh] rounded-[28px]',
          sizes[size] || sizes.md,
          panelClassName
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {hasHeader && (
          <div className={cn('flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white p-4 sm:p-5', headerClassName)}>
            <div className="min-w-0">
              {title && <h2 className="break-words text-lg font-black uppercase leading-tight text-slate-900 sm:text-xl">{title}</h2>}
              {description && <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-slate-500">{description}</p>}
            </div>
            {showClose && <Button variant="ghost" size="sm" iconOnly icon={<X className="h-5 w-5" />} onClick={onClose} aria-label="Закрити" className="shrink-0" />}
          </div>
        )}

        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className={cn('shrink-0 border-t border-slate-100 bg-slate-50/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5', footerClassName)}>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row', footerAlignments[footerAlign] || footerAlignments.right)}>
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
