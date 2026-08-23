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
