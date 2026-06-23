import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn } from 'lucide-react';
import './FinalLoginButton.css';

function openLogin(event) {
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation?.();
  window.location.assign('/login');
}

export default function FinalLoginButtonPortal() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let host = null;
    const attach = () => {
      const actions = document.querySelector('.vf-page.vf-landing .vf-header-actions') || document.querySelector('.vf-header-actions');
      if (!actions) return;

      let nextHost = actions.querySelector('#vf-new-login-host');
      if (!nextHost) {
        nextHost = document.createElement('span');
        nextHost.id = 'vf-new-login-host';
        actions.prepend(nextHost);
      }
      host = nextHost;
      setTarget(nextHost);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (host?.parentElement) host.remove();
    };
  }, []);

  return target ? createPortal(
    <button type="button" className="vf-new-login" onClick={openLogin} aria-label="Увійти в VIN-matrix">
      <LogIn size={15} />
      <span>Увійти</span>
    </button>,
    target,
  ) : null;
}
