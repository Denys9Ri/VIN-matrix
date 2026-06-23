import { useEffect } from 'react';

const LOGIN_PATH = '/login';

function goToLogin(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  window.location.assign(LOGIN_PATH);
}

function isLoginTrigger(element) {
  const href = element.getAttribute('href');
  const label = (element.textContent || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA');
  const hasLoginHref = href && (() => {
    try { return new URL(href, window.location.origin).pathname === LOGIN_PATH; }
    catch { return href === LOGIN_PATH; }
  })();
  return Boolean(hasLoginHref || label === 'увійти' || label === 'увійти в vin-matrix');
}

export default function FinalLoginLinkGuard() {
  useEffect(() => {
    const bindLoginControls = () => {
      document.querySelectorAll('.vf-login, a[href="/login"], button').forEach((element) => {
        if (!isLoginTrigger(element) || element.dataset.loginBound === 'true') return;
        element.dataset.loginBound = 'true';
        element.style.pointerEvents = 'auto';
        element.style.position = 'relative';
        element.style.zIndex = '100';
        element.addEventListener('click', goToLogin);
      });
    };

    const captureFallback = (event) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest('.vf-login, a[href="/login"], button');
      if (trigger && isLoginTrigger(trigger)) goToLogin(event);
    };

    bindLoginControls();
    const observer = new MutationObserver(bindLoginControls);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', captureFallback, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', captureFallback, true);
      document.querySelectorAll('[data-login-bound="true"]').forEach((element) => {
        element.removeEventListener('click', goToLogin);
        delete element.dataset.loginBound;
      });
    };
  }, []);

  return null;
}
