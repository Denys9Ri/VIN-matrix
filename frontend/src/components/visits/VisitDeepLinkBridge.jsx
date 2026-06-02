import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';

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

export default function VisitDeepLinkBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const openedRef = useRef('');

  useEffect(() => {
    if (location.pathname !== '/visits') return;
    const visitId = params.get('visit_id') || location.state?.visit_id || location.state?.visitId || '';
    if (!visitId || openedRef.current === String(visitId)) return;
    openedRef.current = String(visitId);

    let cancelled = false;
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

        const tryOpen = () => {
          if (cancelled) return;
          if (!clickVisitCard(visitId)) setTimeout(tryOpen, 300);
        };
        setTimeout(tryOpen, 500);
      } catch {
        const tryOpen = () => {
          if (cancelled) return;
          if (!clickVisitCard(visitId)) setTimeout(tryOpen, 300);
        };
        setTimeout(tryOpen, 500);
      }
    };

    openVisit();
    return () => { cancelled = true; };
  }, [location.pathname, location.search, location.state, navigate, params]);

  return null;
}
