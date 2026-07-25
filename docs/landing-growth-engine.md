# VIN-matrix Landing Growth Engine

Landing Growth Engine is an autonomous, guarded optimization loop for the public VIN-matrix landing page. It collects Search Console and GA4 data, records first-party conversion events, runs one controlled experiment at a time, uses OpenAI only to propose constrained copy variants, and automatically applies or rolls back statistically evaluated changes.

## Safety model

- Only fields in `apps/landing_growth/defaults.py` can be changed.
- Price, trial duration, legal terms, links, HTML and unverifiable claims are blocked.
- Only one experiment can run at a time, and a database lease prevents overlapping daemon/manual cycles.
- Browser and backend use the same deterministic A/B assignment.
- Conversion winners require minimum traffic, minimum conversions, minimum lift and 95% confidence.
- SEO tests run sequentially, keep a baseline and automatically roll back when CTR or average position deteriorates.
- Every apply, rollback and deploy is stored in `LandingChangeLog`.
- Session identifiers are HMAC-hashed before storage. Visitor IP addresses are used only for in-memory throttling and are not stored.
- OpenAI is limited to one successful call per day and 20 per month by default. The engine works with rule-based fallbacks when OpenAI is unavailable.
- Obvious email addresses and phone numbers are redacted from imported search queries; first-party events expire after 180 days and aggregate Google metrics after 400 days.

## Required Coolify variables

```env
DJANGO_SETTINGS_MODULE=vin_matrix.settings_growth

GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:vin-matrix.com
GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=<service-account JSON, base64 JSON, or mounted file path>
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano

LANDING_GROWTH_SIGNING_KEY=<random 48+ byte secret>
DEPLOY_TRIGGER_URL=<Coolify deploy webhook>
LANDING_GROWTH_DEPLOY_TOKEN=<optional Coolify API bearer token>
LANDING_GROWTH_DEPLOY_METHOD=AUTO
LANDING_GROWTH_INTERVAL_SECONDS=21600
LANDING_GROWTH_INITIAL_DELAY_SECONDS=120
LANDING_GROWTH_LOCK_MINUTES=90
LANDING_GROWTH_BUILD_CONFIG_URL=https://vin-matrix.com/api/landing-growth/config/
```

Generate the signing key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Google setup

1. Enable **Google Search Console API** and **Google Analytics Data API** in one Google Cloud project.
2. Create a service account and download its JSON key.
3. Add the service-account email to the `vin-matrix.com` Search Console property with read access.
4. Add the same email to the GA4 property as a Viewer.
5. Put the JSON into Coolify as raw JSON, base64-encoded JSON, or a mounted secret-file path in `GOOGLE_APPLICATION_CREDENTIALS`.
6. Set the Search Console property exactly as Google displays it: `sc-domain:vin-matrix.com` for a domain property or `https://vin-matrix.com/` for a URL-prefix property.

OAuth client ID/secret are supported as a fallback, but require `GOOGLE_OAUTH_REFRESH_TOKEN`. A service account is simpler for server-to-server operation.

## Runtime

The Compose service `growth-worker` starts `landing_growth_daemon`. It waits until migrations are available, then runs a complete cycle every six hours:

1. Import recent Search Console rows for the canonical home page.
2. Import GA4 landing-page events.
3. Evaluate the currently running experiment.
4. Apply, reject or roll back the result.
5. If no experiment is active, find the next measurable opportunity.
6. Request one structured OpenAI proposal when budget and data thresholds allow; otherwise use a guarded rule variant.
7. Start an eligible low-risk A/B test or sequential SEO test.

Manual commands:

```bash
python manage.py landing_growth_bootstrap --mode safe_autopilot
python manage.py landing_growth_cycle
python manage.py landing_growth_cycle --no-collect
python manage.py landing_growth_daemon --once --initial-delay 0
python manage.py landing_growth_doctor --live-google
```

The bootstrap command creates missing settings but does not overwrite a mode already selected in Django Admin.

Modes can be changed in Django Admin:

- `observe`: collect and evaluate only; no new proposals.
- `recommend`: create proposals for review; do not start them automatically.
- `safe_autopilot`: automatically start eligible low-risk and SEO experiments.

## Endpoints

- `GET /api/landing-growth/config/` — public signed landing configuration and the active conversion experiment.
- `POST /api/landing-growth/events/` — public idempotent first-party event ingestion.
- `GET /api/landing-growth/status/` — admin-only evidence, experiment and sync status.
- `/admin/landing_growth/` — settings, experiments, proposals, events, metrics, changes and sync logs. Pending proposals can be started or rejected with admin actions.

## Deploy and SEO rendering

Conversion copy is delivered dynamically and does not require a deploy. SEO title/description changes must also exist in the pre-rendered HTML. For those changes the engine:

1. updates the versioned database configuration;
2. calls `DEPLOY_TRIGGER_URL` using GET for a Coolify `/api/v1/deploy?uuid=...` URL or POST for a generic webhook; an optional bearer token is supported;
3. the frontend build fetches `/api/landing-growth/config/`;
4. `apply-landing-growth-seo.mjs` updates the static root title, description, H1, lead and JSON-LD;
5. existing SEO verification runs before the image is published.

If the config endpoint cannot be reached during a build, the checked-in safe fallback is used and the build still succeeds.

## First deployment checklist

1. Merge and deploy the backend, frontend and `growth-worker` together.
2. Confirm migrations completed.
3. Open `/api/landing-growth/config/` and confirm a JSON response.
4. Confirm landing events appear in Django Admin.
5. Complete a test registration and confirm `register_complete` is recorded.
6. Run `python manage.py landing_growth_cycle --no-propose` and inspect sync logs.
7. Add Google credentials and run a full cycle.
8. Add the OpenAI key only after Google collection works.
9. Configure the Coolify deploy webhook and verify it with an intentional admin-controlled SEO experiment.

The engine improves measurement and iteration speed; it cannot guarantee a specific Google ranking or social-media reach.
