import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import VisitPaymentDock from './VisitPaymentDock';

function dateISO(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clickVisitCard(visitId) {
  const card = document.querySelector(`[data-visit-id="${visitId}"]`);
  if (!card) return false;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => card.click(), 250);
  return true;
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
}

function syncBoardDate(targetDate) {
  if (!targetDate) return true;
  const input = document.querySelector('input[type="date"]');
  if (!input) return false;
  if (input.value === targetDate) return true;

  setNativeInputValue(input, targetDate);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export default function VisitDeepLinkBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const openedRef = useRef('');

  useEffect(() => {
    if (location.pathname !== '/visits') return;
    const visitId = params.get('visit_id') || location.state?.open_visit_id || location.state?.visit_id || location.state?.visitId || '';
    if (!visitId) return;

    let cancelled = false;
    const targetKey = `${visitId}:${params.get('date') || ''}`;
    if (openedRef.current === targetKey) return;
    openedRef.current = targetKey;

    const tryOpen = () => {
      if (cancelled) return;
      if (!clickVisitCard(visitId)) setTimeout(tryOpen, 300);
    };

    const waitForBoardDateAndOpen = (targetDate, attempts = 0) => {
      if (cancelled) return;
      const synced = syncBoardDate(targetDate);
      if (!synced && attempts < 20) {
        setTimeout(() => waitForBoardDateAndOpen(targetDate, attempts + 1), 150);
        return;
      }
      setTimeout(tryOpen, synced ? 800 : 500);
    };

    const openVisit = async () => {
      try {
        const res = await api.get(`/api/visits/${visitId}/`);
        const visit = res.data || {};
        const targetDate = params.get('date') || dateISO(visit.scheduled_datetime || visit.created_at || visit.updated_at);
        const currentDate = params.get('date');

        if (targetDate && currentDate !== targetDate) {
          navigate(`/visits?visit_id=${visitId}&date=${targetDate}`, { replace: true, state: { open_visit_id: visitId } });
          return;
        }

        waitForBoardDateAndOpen(targetDate);
      } catch {
        waitForBoardDateAndOpen(params.get('date'));
      }
    };

    openVisit();
    return () => { cancelled = true; };
  }, [location.pathname, location.search, location.state, navigate, params]);

  return <VisitPaymentDock />;
}
