const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/pages/Visits.jsx');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('useMemo')) {
  src = src.replace("import React, { useEffect, useRef, useState } from 'react';", "import React, { useEffect, useMemo, useRef, useState } from 'react';");
}

const constantsMarker = 'const STO_DICTIONARY_PATCH = true;';
if (!src.includes(constantsMarker)) {
  const constants = `
${constantsMarker}
const fallbackStoVisitStatuses = [
  { key: 'SELECTION', label: 'В черзі / Підбір', semantic_role: 'new', color: 'amber', icon: 'clock', sort_order: 10, metadata: { show_on_board: true } },
  { key: 'ORDERED', label: 'В роботі', semantic_role: 'in_progress', color: 'blue', icon: 'wrench', sort_order: 20, metadata: { show_on_board: true } },
  { key: 'WAITING_PARTS', label: 'Чекаємо запчастини', semantic_role: 'waiting', color: 'amber', icon: 'clock', sort_order: 30, metadata: { show_on_board: true } },
  { key: 'DONE', label: 'Готово', semantic_role: 'ready', color: 'emerald', icon: 'check-circle', sort_order: 40, metadata: { show_on_board: true } },
];
const stoStatusAliases = {
  new: ['SELECTION', 'PENDING', 'DRAFT'],
  in_progress: ['ORDERED', 'IN_PROGRESS'],
  waiting: ['WAITING_PARTS'],
  ready: ['DONE'],
  done: ['COMPLETED', 'ISSUED'],
  cancelled: ['CANCELLED'],
};
const stoColumnVariant = (status) => {
  const role = status?.semantic_role;
  const color = status?.color;
  if (['ready', 'done'].includes(role) || color === 'emerald') return 'done';
  if (['in_progress', 'waiting'].includes(role) || ['blue', 'indigo', 'cyan'].includes(color)) return 'progress';
  return 'pending';
};
const stoColumnIcon = (status) => {
  const role = status?.semantic_role;
  const icon = status?.icon;
  if (['ready', 'done'].includes(role) || ['check-circle', 'badge-check'].includes(icon)) return <CheckCircle2 size={18} />;
  if (role === 'in_progress' || icon === 'wrench') return <Wrench size={18} />;
  return <Clock size={18} />;
};
const stoStatusMatches = (visitStatus, option) => {
  const aliases = [...(stoStatusAliases[option?.semantic_role] || []), option?.key].filter(Boolean);
  return aliases.includes(visitStatus);
};
const stoStatusLabel = (statuses, key) => {
  const all = [...(Array.isArray(statuses) ? statuses : []), ...fallbackStoVisitStatuses];
  return all.find((status) => status.key === key)?.label || key || 'SELECTION';
};
`;
  src = src.replace('const workflowFilled = (data, type) => {', `${constants}\nconst workflowFilled = (data, type) => {`);
}

if (!src.includes('const [stoVisitStatuses, setStoVisitStatuses] = useState([]);')) {
  src = src.replace(
    "  const [settings, setSettings] = useState({ role: 'owner', permissions: {}, company: {} });",
    "  const [settings, setSettings] = useState({ role: 'owner', permissions: {}, company: {} });\n  const [stoVisitStatuses, setStoVisitStatuses] = useState([]);"
  );
}

if (!src.includes('fetchStoVisitStatuses')) {
  const loader = `
  const fetchStoVisitStatuses = async () => {
    try {
      const res = await axios.get(\`${API_BASE}/api/settings/dictionaries/?mode=sto\`, { headers });
      const list = Array.isArray(res.data?.sto_visit_status) ? res.data.sto_visit_status : [];
      setStoVisitStatuses(list.length ? list : fallbackStoVisitStatuses);
    } catch {
      setStoVisitStatuses(fallbackStoVisitStatuses);
    }
  };
`;
  src = src.replace('  const fetchData = async () => {', `${loader}\n  const fetchData = async () => {`);
} else {
  src = src.replace('setStoVisitStatuses(list);', 'setStoVisitStatuses(list.length ? list : fallbackStoVisitStatuses);');
  src = src.replace('setStoVisitStatuses([]);', 'setStoVisitStatuses(fallbackStoVisitStatuses);');
}

if (!src.includes('fetchStoVisitStatuses();')) {
  src = src.replace(
    "  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t); }, [searchQuery, filterDate]);",
    "  useEffect(() => { const t = setTimeout(fetchData, 300); return () => clearTimeout(t); }, [searchQuery, filterDate]);\n  useEffect(() => { fetchStoVisitStatuses(); }, []);"
  );
}

const oldGrouped = `  const grouped = {
    pending: visits.filter((v) => ['PENDING', 'SELECTION', 'DRAFT'].includes(v.status)),
    progress: visits.filter((v) => ['IN_PROGRESS', 'ORDERED'].includes(v.status)),
    done: visits.filter((v) => v.status === 'DONE'),
    completed: visits.filter((v) => v.status === 'COMPLETED'),
  };
`;
const newGrouped = `  const boardStatuses = useMemo(() => {
    const active = stoVisitStatuses
      .filter((status) => status.is_active !== false)
      .filter((status) => status.metadata?.show_on_board !== false)
      .filter((status) => !['cancelled'].includes(status.semantic_role));
    const source = active.length ? active : fallbackStoVisitStatuses;
    return [...source].sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100));
  }, [stoVisitStatuses]);

  const grouped = useMemo(() => boardStatuses.map((status) => ({
    key: status.key,
    title: status.label || status.key,
    variant: stoColumnVariant(status),
    icon: stoColumnIcon(status),
    items: visits.filter((visit) => stoStatusMatches(visit.status, status)),
  })), [boardStatuses, visits]);
`;
if (src.includes(oldGrouped)) {
  src = src.replace(oldGrouped, newGrouped);
}

const oldGrid = `      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Column variant="pending" title="В черзі / Підбір" items={grouped.pending} icon={<Clock size={18} />} onOpen={setSelectedVisit} isStore={isStore} />
        <Column variant="progress" title="В роботі" items={grouped.progress} icon={<Wrench size={18} />} onOpen={setSelectedVisit} isStore={isStore} />
        <Column variant="done" title="Готово" items={isStore ? [...grouped.done, ...grouped.completed] : grouped.done} icon={<CheckCircle2 size={18} />} onOpen={setSelectedVisit} isStore={isStore} />
      </div>`;
const newGrid = `      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {grouped.map((column) => (
          <Column key={column.key} variant={column.variant} title={column.title} items={column.items} icon={column.icon} onOpen={setSelectedVisit} isStore={isStore} />
        ))}
      </div>`;
if (src.includes(oldGrid)) {
  src = src.replace(oldGrid, newGrid);
}

const oldModalProps = 'workflowInfo={workflowInfo} onCopy={copyText} />';
const newModalProps = 'workflowInfo={workflowInfo} stoVisitStatuses={boardStatuses} stoStatusLabel={(key) => stoStatusLabel(boardStatuses, key)} onCopy={copyText} />';
if (src.includes(oldModalProps) && !src.includes('stoVisitStatuses={boardStatuses}')) {
  src = src.replace(oldModalProps, newModalProps);
}

const oldSignature = 'workflowInfo, onCopy }) {';
const newSignature = 'workflowInfo, stoVisitStatuses = fallbackStoVisitStatuses, stoStatusLabel = (key) => key, onCopy }) {';
if (src.includes(oldSignature)) {
  src = src.replace(oldSignature, newSignature);
}

src = src.replace('{visit.status || \'SELECTION\'}</span>', '{stoStatusLabel(visit.status)}</span>');

const oldStaticStatusGrid = `<div className="mt-4 grid grid-cols-3 gap-2"><StatusBtn active={['PENDING','DRAFT','SELECTION'].includes(visit.status)} onClick={() => onPatch('status','PENDING')} label="В черзі"/><StatusBtn active={['IN_PROGRESS','ORDERED'].includes(visit.status)} onClick={() => onPatch('status','IN_PROGRESS')} label="В роботі"/><StatusBtn active={visit.status === 'DONE'} onClick={() => onPatch('status','DONE')} label="Готово"/></div>`;
const newDictionaryStatusGrid = `<div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">{stoVisitStatuses.map((status) => <StatusBtn key={status.key} active={stoStatusMatches(visit.status, status)} onClick={() => onPatch('status', status.key)} label={status.label || status.key}/>)}</div>`;
if (src.includes(oldStaticStatusGrid)) {
  src = src.replace(oldStaticStatusGrid, newDictionaryStatusGrid);
}

fs.writeFileSync(file, src);
console.log('Visits.jsx patched: STO statuses have fallback and modal switcher.');
