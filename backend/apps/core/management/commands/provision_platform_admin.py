from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Grant Django platform-admin role to existing users. Use once during deployment, not in source code.'

    def add_arguments(self, parser):
        parser.add_argument('usernames', nargs='*', help='Existing usernames to promote.')
        parser.add_argument('--from-env', action='store_true', help='Use PLATFORM_ADMIN_BOOTSTRAP_USERNAMES from environment settings.')
        parser.add_argument('--superuser', action='store_true', help='Also grant is_superuser. Use only for trusted platform owners.')

    def handle(self, *args, **options):
        usernames = [str(name).strip() for name in options['usernames'] if str(name).strip()]
        if options['from_env']:
            usernames.extend(getattr(settings, 'PLATFORM_ADMIN_BOOTSTRAP_USERNAMES', []))
        usernames = list(dict.fromkeys(usernames))

        if not usernames:
            self.stdout.write('No platform admin bootstrap usernames configured; nothing to change.')
            return

        User = get_user_model()
        missing = []
        promoted = []
        for username in usernames:
            user = User.objects.filter(username=username).first()
            if not user:
                missing.append(username)
                continue
            changed = False
            if not user.is_staff:
                user.is_staff = True
                changed = True
            if options['superuser'] and not user.is_superuser:
                user.is_superuser = True
                changed = True
            if changed:
                user.save(update_fields=['is_staff', 'is_superuser'] if options['superuser'] else ['is_staff'])
                promoted.append(username)
            else:
                promoted.append(f'{username} (already configured)')

        for username in promoted:
            self.stdout.write(self.style.SUCCESS(f'Platform admin ready: {username}'))
        if missing:
            self.stderr.write(self.style.WARNING(f'Users not found yet: {", ".join(missing)}'))
