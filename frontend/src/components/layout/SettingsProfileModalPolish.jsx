import { useEffect } from 'react';

const PROFILE_TITLE = 'ПРОФІЛЬ КОМПАНІЇ';
const VEIL_ID = 'vm-profile-modal-top-veil';

function findProfileModal() {
  const heading = Array.from(document.querySelectorAll('h2')).find((node) => (
    String(node.textContent || '').trim().toUpperCase() === PROFILE_TITLE
  ));

  if (!heading) return null;

  let overlay = heading.parentElement;
  while (overlay && !(overlay.classList.contains('fixed') && overlay.classList.contains('inset-0') && overlay.classList.contains('z-50'))) {
    overlay = overlay.parentElement;
  }

  if (!overlay) return null;
  const panel = Array.from(overlay.children).find((node) => node.classList?.contains('bg-white'));
  const footer = overlay.querySelector('.sticky.bottom-0');
  const form = footer?.closest('form') || null;
  return { overlay, panel, footer, form };
}

function getTopVeil() {
  let veil = document.getElementById(VEIL_ID);
  if (veil) return veil;

  veil = document.createElement('div');
  veil.id = VEIL_ID;
  veil.setAttribute('aria-hidden', 'true');
  veil.style.position = 'fixed';
  veil.style.inset = '0 auto auto 0';
  veil.style.width = '100vw';
  veil.style.background = 'rgba(15, 23, 42, 0.65)';
  veil.style.backdropFilter = 'blur(4px)';
  veil.style.webkitBackdropFilter = 'blur(4px)';
  veil.style.pointerEvents = 'auto';
  veil.style.zIndex = '10000';
  document.body.appendChild(veil);
  return veil;
}

function removeTopVeil() {
  document.getElementById(VEIL_ID)?.remove();
}

function clearMarkers() {
  document.querySelectorAll('.vm-profile-modal-overlay, .vm-profile-modal-panel, .vm-profile-modal-footer, .vm-profile-modal-form').forEach((node) => {
    node.classList.remove('vm-profile-modal-overlay', 'vm-profile-modal-panel', 'vm-profile-modal-footer', 'vm-profile-modal-form');
  });
}

export default function SettingsProfileModalPolish() {
  useEffect(() => {
    let frame = 0;

    const sync = () => {
      clearMarkers();
      const modal = findProfileModal();
      if (!modal) {
        removeTopVeil();
        return;
      }

      modal.overlay.classList.add('vm-profile-modal-overlay');
      modal.panel?.classList.add('vm-profile-modal-panel');
      modal.footer?.classList.add('vm-profile-modal-footer');
      modal.form?.classList.add('vm-profile-modal-form');

      const rect = modal.overlay.getBoundingClientRect();
      const gap = Math.max(0, Math.ceil(rect.top) + 2);
      const veil = getTopVeil();
      veil.style.height = `${gap}px`;
      veil.style.display = gap ? 'block' : 'none';
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      clearMarkers();
      removeTopVeil();
    };
  }, []);

  return null;
}
