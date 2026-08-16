import React, { useEffect } from 'react';
import FinanceWorkspaceNav from '../components/finance/FinanceWorkspaceNav';
import AppPage from '../components/ui/AppPage';
import Analytics from './Analytics';

function moveExpensesSecond() {
  const buttons = Array.from(document.querySelectorAll('button'));
  const overview = buttons.find((button) => button.textContent?.trim().toLocaleUpperCase('uk-UA') === 'ОГЛЯД');
  const expenses = buttons.find((button) => button.textContent?.trim().toLocaleUpperCase('uk-UA') === 'ВИТРАТИ');
  if (!overview || !expenses || overview.parentElement !== expenses.parentElement) return;
  if (overview.nextElementSibling === expenses) return;
  overview.parentElement.insertBefore(expenses, overview.nextElementSibling);
}

export default function AnalyticsWorkspace() {
  useEffect(() => {
    const apply = () => {
      moveExpensesSecond();
      if (window.location.hash === '#expenses-section') {
        const section = document.getElementById('expenses-section');
        if (section) section.scrollIntoView({ block: 'start' });
      }
    };

    const frame = window.requestAnimationFrame(apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <AppPage className="max-w-[1680px] pb-0">
        <FinanceWorkspaceNav />
      </AppPage>
      <Analytics />
    </>
  );
}
