# VIN-matrix: operations runbook

## 1. Before every release

Run from the backend container:

```bash
python manage.py migrate --check
python manage.py system_check --strict
python manage.py test apps.core.tests
```

Then verify the platform-admin-only endpoint:

```bash
curl -H "Authorization: Bearer <admin_access_token>" https://your-domain/api/system/health/
```

For support-access incidents, verify the exact deployed code paths, `core.0007_supportaccesssession` migration state, and the real `core_supportaccesssession` database table from inside the production backend container:

```bash
python manage.py check_support_access
```

The response is `ok`, `degraded`, or `down`. `degraded` is actionable: inspect migration, backup, security, billing, and Nova Poshta checks before release.

## 2. Production environment

Required values:

```env
DEBUG=False
SECRET_KEY=<long random value>
ALLOWED_HOSTS=<real hosts only>
CORS_ALLOWED_ORIGINS=<real frontend origins only>
CSRF_TRUSTED_ORIGINS=<real https origins only>
APP_VERSION=<release id>
BACKUP_DIR=/backups
BACKUP_KEEP=14
```

After HTTPS is enabled by the reverse proxy, set:

```env
USE_X_FORWARDED_PROTO=True
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
```

Do not enable SSL redirect or HSTS before HTTPS works for the real domain.

## 3. Daily backup

The backend backup command writes a database dump, optional media archive, and a SHA-256 manifest. It keeps the newest backup directories according to `BACKUP_KEEP`.

```bash
python manage.py create_backup --include-media --keep 14
```

For Docker Compose, schedule it on the host after `docker compose up` is verified:

```cron
15 2 * * * cd /srv/vin-matrix && docker compose exec -T backend python manage.py create_backup --include-media --keep 14 >> /var/log/vin-matrix-backup.log 2>&1
```

The local `/backups` directory is not enough for disaster recovery. Sync it to encrypted external storage (for example S3-compatible storage or a Storage Box) and monitor that the sync succeeds.

## 4. Restore drill

Run a restore drill on a separate environment, never over the live database first.

PostgreSQL database:

```bash
pg_restore --clean --if-exists --no-owner -h <host> -U <user> -d <database> /backups/vin-matrix-<timestamp>/database.dump
```

Media files:

```bash
tar -xzf /backups/vin-matrix-<timestamp>/media.tar.gz -C /path/to/restore-target
```

Before restoring, verify every file against `manifest.json` using its SHA-256 checksum.

## 5. Incident handling

1. Keep the client-visible `request_id` from an API error.
2. Search server logs by that ID.
3. Check `/api/system/health/` as platform admin.
4. Do not run schema repair inside a user request or a database transaction.
5. Fix the root cause, add a regression test, then release.

## 6. Data isolation verification

The test suite includes direct API checks that one company cannot read or edit another company’s visit or inventory. Repeat these checks whenever a new company-scoped endpoint is added.
