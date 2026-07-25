#!/bin/sh
set -eu

if [ "${1:-}" = "gunicorn" ] && [ "${SKIP_STARTUP_MIGRATIONS:-0}" != "1" ]; then
  max_attempts="${DB_STARTUP_MAX_ATTEMPTS:-30}"
  sleep_seconds="${DB_STARTUP_RETRY_SECONDS:-5}"
  attempt=1

  echo "Running Django migrations before starting gunicorn..."
  until python manage.py migrate --noinput; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "Database migrations failed after ${attempt} attempts." >&2
      exit 1
    fi

    echo "Database is not ready or migrations failed (attempt ${attempt}/${max_attempts}); retrying in ${sleep_seconds}s..." >&2
    attempt=$((attempt + 1))
    sleep "$sleep_seconds"
  done

  python manage.py landing_growth_bootstrap
  python manage.py collectstatic --noinput
fi

exec "$@"
