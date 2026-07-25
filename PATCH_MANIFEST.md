# VIN-matrix Landing Growth Engine — patch manifest

This archive is an overlay for the `Denys9Ri/VIN-matrix` repository branch created from commit `2a9cb19a17e3d2576bb1a2d1dbe0d8407ceda61e`.

It contains:

- isolated Django app `apps.landing_growth`;
- database models and initial migration;
- Search Console and GA4 read-only collectors;
- bounded OpenAI Responses API proposal generation with deterministic fallback;
- guarded A/B and sequential SEO experiments;
- deployment synchronization, retry and rollback;
- first-party browser events and server-side registration conversion;
- runtime landing configuration and build-time SEO synchronization;
- Django Admin controls and management commands;
- autonomous Docker Compose growth worker;
- CI tests and Coolify configuration documentation.

## Applying manually

From the repository root, extract the archive over the checkout, review the diff, then run:

```bash
cd backend
pip install -r requirements.txt
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test apps.landing_growth.tests --verbosity 2
python manage.py landing_growth_bootstrap --mode safe_autopilot
python manage.py landing_growth_doctor --live-google

cd ../frontend
npm ci
npm run build
```

Do not deploy until the checks pass and the Coolify environment variables from `docs/landing-growth-engine.md` are configured.
