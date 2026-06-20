import { useEffect } from 'react';

const PROFILE_TITLE = 'ПРОФІЛЬ КОМПАНІЇ';
const LEGACY_VEIL_ID = 'vm-profile-modal-top-veil';
const BODY_CLASS = 'vm-profile-modal-open';

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

function clearOverlayGeometry(overlay) {
  if (!overlay) return;
  ['position', 'inset', 'width', 'height', 'min-height', 'z-index'].forEach((property) => overlay.style.removeProperty(property));
}

function clearMarkers() {
  document.querySelectorAll('.vm-profile-modal-overlay, .vm-profile-modal-panel, .vm-profile-modal-footer, .vm-profile-modal-form').forEach((node) => {
    node.classList.remove('vm-profile-modal-overlay', 'vm-profile-modal-panel', 'vm-profile-modal-footer', 'vm-profile-modal-form');
  });
}

export default function SettingsProfileModalPolish() {
  useEffect(() => {
    document.getElementById(LEGACY_VEIL_ID)?.remove();

    const sync = () => {
      clearMarkers();
      const modal = findProfileModal();
      if (!modal) {
        document.body.classList.remove(BODY_CLASS);
        return;
      }

      modal.overlay.style.setProperty('position', 'fixed', 'important');
      modal.overlay.style.setProperty('inset', '0', 'important');
      modal.overlay.style.setProperty('width', '100vw', 'important');
      modal.overlay.style.setProperty('height', '100dvh', 'important');
      modal.overlay.style.setProperty('min-height', '100dvh', 'important');
      modal.overlay.style.setProperty('z-index', '9999', 'important');

      document.body.classList.add(BODY_CLASS);
      modal.overlay.classList.add('vm-profile-modal-overlay');
      modal.panel?.classList.add('vm-profile-modal-panel');
      modal.footer?.classList.add('vm-profile-modal-footer');
      modal.form?.classList.add('vm-profile-modal-form');
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      const modal = findProfileModal();
      clearOverlayGeometry(modal?.overlay);
      clearMarkers();
      document.body.classList.remove(BODY_CLASS);
      document.getElementById(LEGACY_VEIL_ID)?.remove();
    };
  }, []);

  return null;
}
