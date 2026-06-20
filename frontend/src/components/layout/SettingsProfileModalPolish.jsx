import { useEffect } from 'react';

const COVER_ID = 'vm-settings-modal-top-cover';
const BODY_CLASS = 'vm-settings-modal-open';
const MODAL_BACKDROP = 'rgba(15, 23, 42, 0.72)';

function findSettingsModal() {
  const overlays = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50'));
  return overlays.map((overlay) => {
    const panel = Array.from(overlay.children).find((node) => node.classList?.contains('bg-white'));
    const title = String(panel?.querySelector('h2')?.textContent || '').trim();
    const footer = overlay.querySelector('.sticky.bottom-0');
    const form = footer?.closest('form') || null;
    return { overlay, panel, title, footer, form };
  }).find((modal) => modal.panel && modal.title) || null;
}

function getCover() {
  let cover = document.getElementById(COVER_ID);
  if (cover) return cover;

  cover = document.createElement('div');
  cover.id = COVER_ID;
  cover.setAttribute('aria-hidden', 'true');
  cover.style.position = 'fixed';
  cover.style.top = '0';
  cover.style.left = '0';
  cover.style.width = '100vw';
  cover.style.pointerEvents = 'auto';
  cover.style.zIndex = '9998';
  document.body.appendChild(cover);
  return cover;
}

function clearMarkers() {
  document.querySelectorAll('.vm-settings-modal-overlay, .vm-settings-modal-panel, .vm-settings-modal-footer, .vm-settings-modal-form').forEach((node) => {
    node.classList.remove('vm-settings-modal-overlay', 'vm-settings-modal-panel', 'vm-settings-modal-footer', 'vm-settings-modal-form', 'vm-settings-modal-light', 'vm-settings-modal-dark');
  });
}

function resetOverlayGeometry(overlay) {
  if (!overlay) return;
  ['position', 'inset', 'width', 'height', 'min-height', 'z-index', 'background', 'backdrop-filter', '-webkit-backdrop-filter'].forEach((property) => overlay.style.removeProperty(property));
}

export default function SettingsProfileModalPolish() {
  useEffect(() => {
    const sync = () => {
      clearMarkers();
      const modal = findSettingsModal();
      if (!modal) {
        document.body.classList.remove(BODY_CLASS);
        document.getElementById(COVER_ID)?.remove();
        return;
      }

      modal.overlay.style.setProperty('position', 'fixed', 'important');
      modal.overlay.style.setProperty('inset', '0', 'important');
      modal.overlay.style.setProperty('width', '100vw', 'important');
      modal.overlay.style.setProperty('height', '100dvh', 'important');
      modal.overlay.style.setProperty('min-height', '100dvh', 'important');
      modal.overlay.style.setProperty('z-index', '9999', 'important');
      modal.overlay.style.setProperty('background', MODAL_BACKDROP, 'important');
      modal.overlay.style.setProperty('backdrop-filter', 'blur(3px)', 'important');
      modal.overlay.style.setProperty('-webkit-backdrop-filter', 'blur(3px)', 'important');

      modal.overlay.classList.add('vm-settings-modal-overlay', 'vm-settings-modal-dark');
      modal.panel.classList.add('vm-settings-modal-panel');
      modal.footer?.classList.add('vm-settings-modal-footer');
      modal.form?.classList.add('vm-settings-modal-form');
      document.body.classList.add(BODY_CLASS);

      const topGap = Math.max(0, Math.ceil(modal.overlay.getBoundingClientRect().top));
      const cover = getCover();
      cover.style.height = `${topGap}px`;
      cover.style.background = MODAL_BACKDROP;
      cover.style.backdropFilter = 'blur(3px)';
      cover.style.webkitBackdropFilter = 'blur(3px)';
      cover.style.display = topGap > 0 ? 'block' : 'none';
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
      const modal = findSettingsModal();
      resetOverlayGeometry(modal?.overlay);
      clearMarkers();
      document.body.classList.remove(BODY_CLASS);
      document.getElementById(COVER_ID)?.remove();
    };
  }, []);

  return null;
}
