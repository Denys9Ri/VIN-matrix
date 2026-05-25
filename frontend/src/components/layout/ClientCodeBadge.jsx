import React from 'react';
import CopyButton from '../common/CopyButton';

const ClientCodeBadge = ({ clientCode }) => {
  if (!clientCode) return null;

  const formattedCode = String(clientCode).toUpperCase();

  return (
    <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
      <span className="text-[10px] font-black uppercase text-slate-400">Ваш код:</span>
      <CopyButton
        value={formattedCode}
        label={formattedCode}
        copiedLabel="Скопійовано"
        title="Скопіювати код"
        tone="dark"
        className="px-2 py-0.5 rounded text-xs shadow-sm shadow-blue-200"
      />
    </div>
  );
};

export default ClientCodeBadge;
