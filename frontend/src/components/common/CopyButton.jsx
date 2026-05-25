import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const fallbackCopy = (value) => {
  const textarea = document.createElement('textarea');
  textarea.value = String(value);
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

export const copyValueToClipboard = async (value) => {
  if (value === undefined || value === null || value === '') return false;
  const text = String(value);
  try {
    if (navigator?.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    return true;
  } catch (error) {
    try {
      fallbackCopy(text);
      return true;
    } catch (fallbackError) {
      console.error('Copy failed', fallbackError);
      return false;
    }
  }
};

const baseStyles = {
  badge: 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-black transition-all duration-200 active:scale-95',
  icon: 'inline-flex items-center justify-center transition-all duration-200',
};

const toneStyles = {
  blue: {
    idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    copied: 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200 scale-105 shadow-sm',
  },
  dark: {
    idle: 'bg-slate-800 text-white hover:bg-slate-900',
    copied: 'bg-emerald-600 text-white ring-2 ring-emerald-200 scale-105 shadow-sm',
  },
  light: {
    idle: 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
    copied: 'bg-emerald-50 border border-emerald-200 text-emerald-700 scale-105 shadow-sm',
  },
};

const CopyButton = ({
  value,
  label,
  copiedLabel = 'Скопійовано',
  title = 'Скопіювати',
  compact = false,
  showLabel = true,
  tone = 'blue',
  className = '',
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const styles = toneStyles[tone] || toneStyles.blue;

  const handleCopy = async (event) => {
    event?.stopPropagation?.();
    const ok = await copyValueToClipboard(value);
    if (!ok) {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 1800);
      return;
    }
    setCopied(true);
    setFailed(false);
    onCopied?.(value);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const visibleText = failed ? 'Помилка' : copied ? copiedLabel : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? copiedLabel : title}
      className={`${baseStyles.badge} ${copied ? styles.copied : styles.idle} ${failed ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-200' : ''} ${className}`}
    >
      <span className={`${baseStyles.icon} ${copied ? 'rotate-0 scale-110' : ''}`}>
        {copied ? <Check size={compact ? 12 : 14} /> : <Copy size={compact ? 12 : 14} />}
      </span>
      {showLabel && <span>{visibleText}</span>}
    </button>
  );
};

export default CopyButton;
