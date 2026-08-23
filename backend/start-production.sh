#!/bin/sh
set -eu

echo "Running VIN Matrix database repair and migrations..."
python fix_db.py

echo "Bootstrapping landing growth data..."
python manage.py landing_growth_bootstrap

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting VIN Matrix push scheduler..."
python manage.py run_push_scheduler --interval 60 &

echo "Starting VIN-matrix backend..."
exec gunicorn vin_matrix.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --access-logfile - \
  --error-logfile -
