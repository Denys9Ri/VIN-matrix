# VIN-matrix: Landing / demo / sales launch

## Public pages

- `/landing` — sales landing page.
- `/demo` — interactive product tour with safe simulated data.
- `/login` — CRM sign-in page.

The operational CRM remains at `/` for authenticated users.

## Demo workspace

After deployment, create the live training workspace once from the backend container:

```bash
cd /app
python manage.py seed_demo_workspace --username demo_vin --password '<set-a-unique-demo-password>' --reset
```

The command is idempotent. It prepares a demo company, service posts, catalog, stock and realistic orders. Use `--reset` before sales calls or on a scheduled cleanup, so visitors always see the original scenario.

Do not use a production administrator password for the demo account. Do not connect real payment, delivery or supplier credentials to the demo workspace.

## Lead inbox

Public landing form submissions are stored by the backend endpoint:

```text
POST /api/landing/leads/
```

The source table is `core_landing_lead`. It contains name, phone, business type, team size and submitted time. Review these leads through the database or add a notification integration later.

## Capture-ready visual materials

Capture using `demo_vin` and use a 16:10 desktop viewport:

1. Dashboard: active orders, margin card and daily KPI strip.
2. Order: work post, services, parts reserve and payment status.
3. Inventory: reserved items, stock quantity and margin.
4. Analytics: revenue and operational workload.
5. Document: acceptance act generated from an order.

For short motion assets, record five to eight seconds without voice-over:

- New order → work post → services and parts.
- Reserve a part → change order state.
- Open analytics → show margin and active jobs.

Export one MP4/WebM for the site and a shorter vertical clip for social media. Keep real clients, contacts, payments and provider credentials out of recordings.
