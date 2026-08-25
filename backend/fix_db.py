import os
import runpy

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vin_matrix.settings")

# Keep the existing compatibility repair untouched, then always apply
# normal Django migrations. Coolify already runs `python fix_db.py`, so
# future deploys no longer need a manual `python manage.py migrate --noinput`.
runpy.run_path(os.path.join(os.path.dirname(__file__), "fix_db_legacy.py"), run_name="__main__")

from django.core.management import call_command

print("🔄 Застосовуємо Django migrations...")
call_command("migrate", interactive=False, verbosity=1)
print("✅ Django migrations застосовано автоматично.")

# Coolify uses this file in the real production Start Command. Timed push rules
# (visit reminders, debt summaries and CRM reminders) therefore have to start
# here as well, otherwise only immediate signal-based pushes are delivered.
from apps.push_notifications.launcher import start_push_scheduler_background

print("🔔 Перевіряємо фоновий планувальник push-сповіщень...")
scheduler = start_push_scheduler_background()
if scheduler.get("disabled"):
    print("⚠️ Push scheduler autostart вимкнено через VIN_MATRIX_PUSH_SCHEDULER_AUTOSTART.")
elif scheduler.get("already_running"):
    print("✅ Push scheduler уже працює в цьому контейнері.")
else:
    print(f"✅ Push scheduler запущено автоматично (PID {scheduler.get('pid')}).")
