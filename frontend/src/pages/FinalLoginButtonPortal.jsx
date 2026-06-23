import { useEffect } from 'react';
import './FinalLoginButton.css';

const LOGIN_URL = 'https://vin-matrix.com/login';

export default function FinalLoginButtonPortal() {
  useEffect(() => {
    let loginLink = null;

    const mountNativeLoginLink = () => {
      const actions = document.querySelector('.vf-page.vf-landing .vf-header-actions') || document.querySelector('.vf-header-actions');
      if (!actions) return;

      // The old landing link is removed. The replacement below is a regular browser anchor.
      actions.querySelector('.vf-login')?.remove();

      loginLink = actions.querySelector('#vf-direct-login');
      if (!loginLink) {
        loginLink = document.createElement('a');
        loginLink.id = 'vf-direct-login';
        loginLink.className = 'vf-direct-login';
        loginLink.href = LOGIN_URL;
        loginLink.setAttribute('aria-label', 'Увійти в VIN-matrix');
        loginLink.innerHTML = '<span class="vf-direct-login-icon" aria-hidden="true">↪</span><span>Увійти</span>';
        const register = actions.querySelector('.vf-register-cta');
        actions.insertBefore(loginLink, register || null);
      }

      loginLink.style.pointerEvents = 'auto';
      loginLink.style.position = 'relative';
      loginLink.style.zIndex = '1000';
    };

    mountNativeLoginLink();
    const observer = new MutationObserver(mountNativeLoginLink);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      loginLink?.remove();
    };
  }, []);

  return null;
}
