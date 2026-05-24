import React from 'react';

const ClientCodeBadge = ({ clientCode }) => {
  const formattedCode = clientCode
    ? String(clientCode).startsWith('CLI-')
      ? String(clientCode)
      : `CLI-${clientCode}`
    : 'CLI-000';

  return (
    <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
      <span className="text-[10px] font-black uppercase text-slate-400">Ваш код:</span>
      <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm shadow-blue-200">
        {formattedCode}
      </span>
    </div>
  );
};

export default ClientCodeBadge;
