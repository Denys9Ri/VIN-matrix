from django.core.management.base import BaseCommand

from apps.push_notifications.scheduler import process_scheduled_pushes


class Command(BaseCommand):
    help = 'Process time-based VIN Matrix push notifications once.'

    def handle(self, *args, **options):
        stats = process_scheduled_pushes()
        self.stdout.write(
            self.style.SUCCESS(
                'Push tick: users={users}, visit_reminders={visit_reminders}, debts={debts}, crm={crm}'.format(**stats)
            )
        )
