import { useEffect } from 'react';

function normalizeLink(link) {
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('/landing')) return;
  const suffix = href.slice('/landing'.length);
  if (suffix && !suffix.startsWith('/') && !suffix.startsWith('?') && !suffix.startsWith('#')) return;
  link.setAttribute('href', `/${suffix}`);
}

function normalizeTree(node) {
  if (!(node instanceof Element)) return;
  if (node.matches('a[href^="/landing"]')) normalizeLink(node);
  node.querySelectorAll?.('a[href^="/landing"]').forEach(normalizeLink);
}

export default function CanonicalLinkGuard() {
  useEffect(() => {
    document.querySelectorAll('a[href^="/landing"]').forEach(normalizeLink);
    const root = document.getElementById('root');
    if (!root) return undefined;

    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(normalizeTree));
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
