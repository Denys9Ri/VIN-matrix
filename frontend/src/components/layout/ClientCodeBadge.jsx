import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const ClientCodeBadge = ({ clientCode }) => {
  const [copied, setCopied] = useState(false);

  if (!clientCode) return null;

  const formattedCode = String(clientCode).toUpperCase();

  const copyCode = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = formattedCode;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Не вдалося скопіювати код', error);
    }
  };

  return (
    <button
      type="button"
      onClick={copyCode}
      title="Скопіювати код"
      className="flex items-center gap-2 border-l pl-4 border-slate-200 hover:opacity-80 transition-opacity"
    >
      <span className="text-[10px] font-black uppercase text-slate-400">Ваш код:</span>
      <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm shadow-blue-200">
        {formattedCode}
      </span>
      <span className="text-slate-400">
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </span>
    </button>
  );
};

export default ClientCodeBadge;
