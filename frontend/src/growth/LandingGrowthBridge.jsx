import { useEffect, useRef } from 'react';

import { API_ORIGIN } from '../api/axios';
import generatedConfig from './generatedLandingConfig.json';
import {
  deepMerge,
  getGrowthSessionId,
  setConfigPath,
  setGrowthAssignment,
  stableExperimentVariant,
  trackLandingEvent,
} from './landingGrowth';

const preserveIconText = (target, text) => {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element || !text) return;
  const icon = element.querySelector('svg, i');
  element.replaceChildren();
  if (icon) element.appendChild(icon);
  element.appendChild(document.createTextNode(` ${text}`));
};

const setText = (selector, text) => {
  if (!text) return;
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
};

const applyConfigToDom = (config) => {
  const hero = config?.hero || {};
  const tariff = config?.tariff || {};
  const finalCta = config?.final_cta || {};

  preserveIconText('.vf-hero .vf-eyebrow', hero.eyebrow);
  const heroHeading = document.querySelector('.vf-hero-copy > h1');
  if (heroHeading && hero.title) {
    const accent = heroHeading.querySelector('em');
    const lineBreak = heroHeading.querySelector('br');
    heroHeading.replaceChildren(document.createTextNode(hero.title));
    if (lineBreak) heroHeading.appendChild(lineBreak);
    else heroHeading.appendChild(document.createElement('br'));
    const nextAccent = accent || document.createElement('em');
    nextAccent.textContent = hero.accent || '';
    heroHeading.appendChild(nextAccent);
  }
  setText('.vf-hero-copy > p', hero.lead);
  preserveIconText(document.querySelector('.vf-hero-actions .vf-register-cta'), hero.primary_cta);
  preserveIconText('.vf-hero-actions .vf-demo-link', hero.secondary_cta);
  preserveIconText('.vf-hero-note', hero.note);

  setText('.vf-tariff .vf-section-copy h2', tariff.heading);
  setText('.vf-tariff .vf-section-copy > p', tariff.lead);
  preserveIconText(document.querySelector('.vf-price-card .vf-register-cta'), tariff.cta);

  setText('.vf-final-cta h2', finalCta.heading);
  setText('.vf-final-cta p', finalCta.lead);
  preserveIconText(document.querySelector('.vf-final-actions .vf-register-cta'), finalCta.cta);
};

const fetchRuntimeConfig = async () => {
  try {
    const response = await fetch(`${API_ORIGIN}/api/landing-growth/config/`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

const eventForTarget = (target) => {
  if (!(target instanceof Element)) return null;
  if (target.closest('.vf-hero-actions .vf-register-cta')) return ['hero_register_click', 'hero'];
  if (target.closest('.vf-hero-actions .vf-demo-link')) return ['hero_demo_click', 'hero'];
  if (target.closest('.vf-price-card .vf-register-cta')) return ['pricing_register_click', 'tariff'];
  if (target.closest('.vf-final-actions .vf-register-cta')) return ['final_register_click', 'final_cta'];
  if (target.closest('.vf-header .vf-register-cta')) return ['hero_register_click', 'header'];
  if (target.closest('.vf-login, a[href="/login"]')) return ['login_click', 'navigation'];
  if (target.closest('.vfs-search-card-link')) return ['solution_click', 'solutions'];
  if (target.closest('.vf-faq button')) return ['faq_open', 'faq'];
  if (target.closest('.vf-demo-frame button, .vf-aerial-tabs button, .vf-demo-tabs button')) return ['demo_interaction', 'demo'];
  return null;
};

export default function LandingGrowthBridge() {
  const trackedViews = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    let observer = null;
    const sessionId = getGrowthSessionId();

    const start = async () => {
      const runtime = await fetchRuntimeConfig();
      if (cancelled) return;
      let config = deepMerge(generatedConfig.config || {}, runtime?.config || {});
      const experiment = Array.isArray(runtime?.experiments) ? runtime.experiments[0] : null;
      let attribution = null;
      if (experiment) {
        const variant = stableExperimentVariant(sessionId, experiment);
        attribution = {
          experiment_id: experiment.id,
          variant,
          block_key: experiment.block_key,
          field_path: experiment.field_path,
        };
        if (variant === 'variant') config = setConfigPath(config, experiment.field_path, experiment.variant_value);
      }
      setGrowthAssignment(attribution);
      applyConfigToDom(config);
      window.setTimeout(() => applyConfigToDom(config), 250);
      window.setTimeout(() => applyConfigToDom(config), 1000);

      await trackLandingEvent('landing_view', {
        sessionId,
        attribution,
        blockKey: 'landing',
        metadata: { config_version: String(runtime?.version || generatedConfig.version || 1) },
      });

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const eventName = entry.target.matches('.vf-tariff') ? 'pricing_view' : 'features_view';
          if (trackedViews.current.has(eventName)) return;
          trackedViews.current.add(eventName);
          trackLandingEvent(eventName, {
            sessionId,
            attribution,
            blockKey: eventName === 'pricing_view' ? 'tariff' : 'features',
          });
        });
      }, { threshold: 0.35 });
      document.querySelectorAll('.vf-tariff, .vf-features').forEach((element) => observer.observe(element));
    };

    const clickHandler = (event) => {
      const match = eventForTarget(event.target);
      if (!match) return;
      const [eventName, blockKey] = match;
      trackLandingEvent(eventName, {
        sessionId,
        blockKey,
        metadata: { target: event.target.closest('a,button')?.textContent?.trim().slice(0, 120) || '' },
      });
    };
    document.addEventListener('click', clickHandler, { capture: true });
    applyConfigToDom(generatedConfig.config || {});
    start();

    return () => {
      cancelled = true;
      document.removeEventListener('click', clickHandler, { capture: true });
      observer?.disconnect();
    };
  }, []);

  return null;
}
