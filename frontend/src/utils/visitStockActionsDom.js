const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
const MARK = 'data-stock-actions-ready';

const token = () => localStorage.getItem('access_token') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

function textOf(node) {
  return String(node?.textContent || '');
}

function currentVisitId() {
  const match = textOf(document.body).match(/Візит\s*№\s*(\d+)/i);
  return match ? match[1] : '';
}

function partsTabActive() {
  return Array.from(document.querySelectorAll('button')).some((btn) => textOf(btn).trim() === 'Запчастини' && btn.className.includes('bg-blue-600'));
}

async function fetchVisit(visitId) {
  const res = await fetch(`${API_BASE}/api/visits/${visitId}/`, { headers: headers() });
  if (!res.ok) throw new Error('visit_load_failed');
  return res.json();
}

async function postAction(url, payload) {
  const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Не вдалося виконати дію');
  return data;
}

function toast(message) {
  const old = document.querySelector('[data-stock-toast]');
  if (old) old.remove();
  const el = document.createElement('div');
  el.setAttribute('data-stock-toast', '1');
  el.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white px-4 py-3 rounded-2xl text-xs font-black shadow-xl';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function makeBtn(label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Зачекайте...';
    try {
      await onClick();
      toast('Готово. Оновлюю дані...');
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast(err.message || 'Помилка');
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
  return btn;
}

function findPartCards() {
  return Array.from(document.querySelectorAll('select'))
    .filter((s) => Array.from(s.options || []).some((o) => o.value === 'WAITING'))
    .map((s) => s.closest('.p-3.bg-slate-50.rounded-xl.border') || s.closest('div'))
    .filter(Boolean);
}

function addVisitWriteOffPanel(visitId) {
  if (document.querySelector('[data-stock-writeoff-panel]')) return;
  const firstCard = findPartCards()[0];
  if (!firstCard?.parentElement) return;
  const panel = document.createElement('div');
  panel.setAttribute('data-stock-writeoff-panel', '1');
  panel.className = 'bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
  const title = document.createElement('div');
  title.innerHTML = '<p class="text-[10px] font-black uppercase text-emerald-700">Склад</p><p class="text-sm font-bold text-emerald-900">Списання зарезервованих запчастин при готовності візиту</p>';
  panel.appendChild(title);
  panel.appendChild(makeBtn('Списати при готовності', 'bg-emerald-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase', () => postAction('/api/stock/write-off-visit/', { visit_id: visitId })));
  firstCard.parentElement.insertBefore(panel, firstCard);
}

async function enhance() {
  const visitId = currentVisitId();
  if (!visitId || !partsTabActive()) return;
  const cards = findPartCards();
  if (!cards.length) return;
  let visit;
  try { visit = await fetchVisit(visitId); } catch { return; }
  const parts = Array.isArray(visit.parts) ? visit.parts : [];
  addVisitWriteOffPanel(visitId);
  cards.forEach((card, index) => {
    if (card.getAttribute(MARK) === '1') return;
    const part = parts[index];
    if (!part?.id) return;
    card.setAttribute(MARK, '1');
    const stockStatus = part.stock_status || 'none';
    const panel = document.createElement('div');
    panel.className = 'w-full grid grid-cols-1 sm:grid-cols-2 gap-2 lg:w-56';
    const badge = document.createElement('div');
    badge.className = `rounded-xl px-3 py-2 text-[10px] font-black uppercase text-center ${stockStatus === 'reserved' ? 'bg-emerald-50 text-emerald-700' : stockStatus === 'written_off' ? 'bg-slate-200 text-slate-600' : 'bg-amber-50 text-amber-700'}`;
    badge.textContent = stockStatus === 'reserved' ? 'У резерві' : stockStatus === 'written_off' ? 'Списано' : 'Не зі складу';
    panel.appendChild(badge);
    if (stockStatus === 'reserved') {
      panel.appendChild(makeBtn('Зняти резерв', 'bg-amber-100 text-amber-800 rounded-xl px-3 py-2 text-[10px] font-black uppercase', () => postAction('/api/stock/release/', { order_part_id: part.id })));
    } else if (stockStatus !== 'written_off') {
      panel.appendChild(makeBtn('Зі складу / Резерв', 'bg-blue-600 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase', () => postAction('/api/stock/reserve/', { order_part_id: part.id })));
    }
    card.appendChild(panel);
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 250);
}

if (typeof window !== 'undefined') {
  const observer = new MutationObserver(schedule);
  window.addEventListener('load', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
  });
}
