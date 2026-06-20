# Production security deployment

## 1. Platform administrator

Platform admin is not a hard-coded username anymore. It is a Django database role: `is_staff` or `is_superuser`.

For the first deployment after this release, set `PLATFORM_ADMIN_BOOTSTRAP_USERNAMES` in the server secret environment to the existing owner login. The startup command promotes that existing account to `is_staff`.

After deployment verify:

```bash
python manage.py provision_platform_admin <existing-login>
python manage.py system_check --strict
```

Do not put the username into source code.

## 2. Required secret rotation

A historical environment file was removed from the repository head. Treat every value that was ever inside it as compromised, even if it looked like a test value.

Rotate on the deployment server:

- `SECRET_KEY` — generate a new long random value; this invalidates JWT sessions after restart.
- PostgreSQL password — change it in PostgreSQL and the deployment secret environment together.
- Nova Poshta API keys — replace each active profile key in the application settings.
- S3 backup access key — create a backup-only key with access limited to one bucket/prefix.
- `BACKUP_ENCRYPTION_KEY` — generate and store it only in a secret manager. Loss of this key makes encrypted backups unrecoverable.

Remove the old file from Git history with `git filter-repo` or GitHub Support / repository owner tooling. Make the repository private until that cleanup and rotation are complete.

## 3. HTTPS

Before exposing the system to clients, use a real domain and TLS certificate. Then enable:

```env
SECURE_SSL_REDIRECT=True
USE_X_FORWARDED_PROTO=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
```

Set `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and `CORS_ALLOWED_ORIGINS` to only the real HTTPS domain.

## 4. Rate limiting

Use the security Docker overlay during deployment:

```bash
docker compose -f docker-compose.yml -f docker-compose.security.yml up -d --build
```

It adds internal Redis. Redis has no published host port; it is only reachable from containers. The backend uses it for rate limiting across all Gunicorn workers.

## 5. Encrypted external backup

The backup job has two layers:

1. A local server snapshot with checksums.
2. AES-256-GCM encryption before upload to S3-compatible storage.

Configure these only in the server secret environment:

- `BACKUP_S3_BUCKET`
- `BACKUP_S3_PREFIX`
- `BACKUP_S3_REGION`
- `BACKUP_S3_ENDPOINT_URL`
- `BACKUP_S3_ACCESS_KEY_ID`
- `BACKUP_S3_SECRET_ACCESS_KEY`
- `BACKUP_ENCRYPTION_KEY`

Create a backup-only S3 identity. It must not have permission to delete unrelated buckets or read application data.

Daily command:

```bash
python manage.py upload_encrypted_backup --include-media --keep 14
```

Verify an uploaded encrypted backup without touching the live database:

```bash
python manage.py verify_encrypted_backup --key <object-key>
```

A true restore drill must restore the verified dump into a separate staging database, never the production database. Document the staging database name and operator before running that step.
