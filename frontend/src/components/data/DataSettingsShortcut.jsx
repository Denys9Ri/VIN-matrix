import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';

export default function DataSettingsShortcut() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.location.pathname === '/settings');
    update();
    window.addEventListener('popstate', update);
    const timer = setInterval(update, 700);
    return () => { window.removeEventListener('popstate', update); clearInterval(timer); };
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => navigate('/data')}
      className="fixed right-5 bottom-40 z-[60] md:right-8 md:bottom-24 bg-slate-900 hover:bg-blue-700 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2 font-black text-xs uppercase transition"
      title="Імпорт, експорт і резервна копія"
    >
      <FileSpreadsheet size={17}/> Дані
    </button>
  );
}
