import React, { useLayoutEffect, useRef } from 'react';
import Dashboard from './Dashboard';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';

function removeLegacyQuickStart(root) {
  if (!root) return;
  const card = Array.from(root.querySelectorAll('div')).find((node) => {
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    return text.includes('Почніть з демо-даних, складу та першого візиту')
      && text.includes('1. Компанія')
      && text.includes('2. Склад')
      && text.includes('3. Перший візит')
      && node.querySelectorAll('button').length === 3;
  });
  card?.remove();
}

export default function DashboardOnboarding() {
  const dashboardRootRef = useRef(null);

  useLayoutEffect(() => {
    const root = dashboardRootRef.current;
    if (!root) return undefined;
    const cleanup = () => removeLegacyQuickStart(root);
    cleanup();
    const observer = new MutationObserver(cleanup);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="max-w-[1600px] mx-auto px-3 pt-3 md:px-8 md:pt-8 w-full">
        <OnboardingChecklist />
      </div>
      <div ref={dashboardRootRef}>
        <Dashboard />
      </div>
    </>
  );
}
