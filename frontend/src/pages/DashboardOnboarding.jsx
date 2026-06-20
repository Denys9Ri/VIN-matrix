import React from 'react';
import Dashboard from './Dashboard';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';

export default function DashboardOnboarding() {
  return (
    <>
      <div className="max-w-[1600px] mx-auto px-3 pt-3 md:px-8 md:pt-8 w-full">
        <OnboardingChecklist />
      </div>
      <Dashboard />
    </>
  );
}
