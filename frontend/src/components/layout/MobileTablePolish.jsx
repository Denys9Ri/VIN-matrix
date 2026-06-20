import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const STYLE_ID = 'vinmatrix-mobile-movement-cards';
const TABLE_CLASS = 'vm-mobile-movement-table';
const WRAP_CLASS = 'vm-mobile-movement-wrap';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 767px) {
      .${WRAP_CLASS} { overflow: visible !important; border: 0 !important; background: transparent !important; border-radius: 0 !important; }
      .${TABLE_CLASS}, .${TABLE_CLASS} tbody { display: block !important; width: 100% !important; min-width: 0 !important; }
      .${TABLE_CLASS} thead { display: none !important; }
      .${TABLE_CLASS} tbody { display: grid !important; gap: 0.75rem !important; }
      .${TABLE_CLASS} tr { display: block !important; overflow: hidden !important; border: 1px solid rgb(226 232 240) !important; border-radius: 1rem !important; background: white !important; padding: 0.35rem 0.75rem !important; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important; }
      .${TABLE_CLASS} td { display: grid !important; grid-template-columns: minmax(88px, 0.72fr) minmax(0, 1.28fr) !important; align-items: start !important; gap: 0.75rem !important; width: 100% !important; max-width: none !important; border: 0 !important; padding: 0.55rem 0 !important; text-align: right !important; overflow-wrap: anywhere !important; }
      .${TABLE_CLASS} td::before { content: attr(data-vm-label); min-width: 0; color: rgb(100 116 139); font-size: 0.62rem; font-weight: 900; letter-spacing: 0.04em; line-height: 1.15; text-align: left; text-transform: uppercase; }
      .${TABLE_CLASS} td > * { min-width: 0; }
      .${TABLE_CLASS} td:nth-child(3) p { text-align: right; overflow-wrap: anywhere; }
    }
  `;
  document.head.appendChild(style);
}

function cleanupTables() {
  document.querySelectorAll(`.${TABLE_CLASS}`).forEach((table) => {
    table.classList.remove(TABLE_CLASS);
    table.querySelectorAll('[data-vm-label]').forEach((cell) => cell.removeAttribute('data-vm-label'));
    table.parentElement?.classList.remove(WRAP_CLASS);
  });
}

function decorateMovementTable() {
  const table = Array.from(document.querySelectorAll('table')).find((candidate) => {
    const headers = Array.from(candidate.querySelectorAll('thead th')).map((header) => String(header.textContent || '').trim().toLowerCase());
    return headers.length >= 6
      && headers.includes('дата')
      && headers.includes('тип')
      && headers.includes('товар')
      && headers.some((header) => header.includes('кількість'))
      && headers.some((header) => header.includes('причина'));
  });

  if (!table) return;
  const labels = Array.from(table.querySelectorAll('thead th')).map((header) => String(header.textContent || '').trim());
  table.classList.add(TABLE_CLASS);
  table.parentElement?.classList.add(WRAP_CLASS);
  table.querySelectorAll('tbody tr').forEach((row) => {
    Array.from(row.children).forEach((cell, index) => cell.setAttribute('data-vm-label', labels[index] || 'Деталі'));
  });
}

export default function MobileTablePolish() {
  const location = useLocation();

  useEffect(() => {
    cleanupTables();
    if (location.pathname !== '/inventory') return undefined;

    installStyles();
    const sync = () => decorateMovementTable();
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanupTables();
    };
  }, [location.pathname]);

  return null;
}
