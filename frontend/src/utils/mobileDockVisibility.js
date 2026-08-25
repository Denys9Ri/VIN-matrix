const EXCLUDED_PREFIXES = ['/onboarding', '/login', '/register'];

export function shouldShowMobileActionDock(pathname = '/') {
  const path = String(pathname || '/');
  return !EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
