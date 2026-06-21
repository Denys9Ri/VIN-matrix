import { useEffect } from 'react';

export default function FinalDemoLinkGuard() {
  useEffect(() => {
    const allowDemoNavigation = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('.vf-demo-link')) return;

      // The landing's older delegated handler listens during bubble phase.
      // Stop only propagation: browser still follows the /demo link normally.
      event.stopPropagation();
    };

    document.addEventListener('click', allowDemoNavigation, true);
    return () => document.removeEventListener('click', allowDemoNavigation, true);
  }, []);

  return null;
}
