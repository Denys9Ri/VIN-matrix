import { useEffect } from 'react';

const isPrimaryActivation = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export default function FinalLoginLinkGuard() {
  useEffect(() => {
    const openLogin = (event) => {
      if (!(event.target instanceof Element) || !isPrimaryActivation(event)) return;

      const trigger = event.target.closest('a, button');
      if (!trigger) return;

      const href = trigger.getAttribute('href');
      const label = (trigger.textContent || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA');
      const isLoginLink = href && (() => {
        try { return new URL(href, window.location.origin).pathname === '/login'; }
        catch { return href === '/login'; }
      })();
      const isLoginButton = trigger.tagName === 'BUTTON' && (label === 'увійти' || label === 'увійти в vin-matrix');

      if (!isLoginLink && !isLoginButton) return;

      // The older landing has delegated click handlers. Navigate directly before they can cancel the login action.
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/login');
    };

    document.addEventListener('click', openLogin, true);
    return () => document.removeEventListener('click', openLogin, true);
  }, []);

  return null;
}
