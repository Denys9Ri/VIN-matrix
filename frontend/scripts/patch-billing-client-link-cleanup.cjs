const fs = require('fs');
const path = require('path');

const settingsFile = path.resolve(__dirname, '../src/pages/Settings.jsx');
let src = fs.readFileSync(settingsFile, 'utf8');

const duplicated = `<p className="text-xs font-bold text-white/75 mt-1">{link.instruction || 'При оплаті вкажіть код клієнта.'} <span className="font-black text-white">{clientCode}</span></p>`;
const clean = `<p className="text-xs font-bold text-white/75 mt-1">{link.instruction || 'При оплаті вкажіть код клієнта.'}</p><div className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-white/15 border border-white/20 px-3 py-2"><span className="text-[9px] font-black uppercase text-white/60">Ваш код</span><span className="font-black text-white">{clientCode}</span></div>`;
src = src.replace(duplicated, clean);

// Safety for builds where old text already came from a previous patch.
src = src.replace(
  `Вкажіть код клієнта. Наприклад: C6003 <span className="font-black text-white">{clientCode}</span>`,
  `Вкажіть код клієнта. Наприклад: C6003`
);

fs.writeFileSync(settingsFile, src);
console.log('Billing client link cleanup applied: client code is no longer duplicated.');
