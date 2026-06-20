import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def configured_backup_dir():
    return str(os.getenv('BACKUP_DIR') or os.getenv('POSTGRES_BACKUP_DIR') or '').strip()


class Command(BaseCommand):
    help = 'Create an on-server VIN-matrix backup with a checksum manifest.'

    def add_arguments(self, parser):
        parser.add_argument('--output-dir', default=configured_backup_dir())
        parser.add_argument('--include-media', action='store_true')
        parser.add_argument('--keep', type=int, default=int(os.getenv('BACKUP_KEEP', '7')))

    def handle(self, *args, **options):
        output_dir = str(options['output_dir'] or '').strip()
        if not output_dir:
            raise CommandError('BACKUP_DIR is not configured. Pass --output-dir or set BACKUP_DIR.')

        keep = max(1, int(options['keep'] or 1))
        root = Path(output_dir).expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        backup_dir = root / f'vin-matrix-{timestamp}'
        backup_dir.mkdir(mode=0o700)

        try:
            database_file = self._backup_database(backup_dir)
            files = [database_file]
            if options['include_media']:
                media_file = self._backup_media(backup_dir)
                if media_file:
                    files.append(media_file)

            manifest = {
                'created_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'database_engine': settings.DATABASES['default']['ENGINE'],
                'app_version': getattr(settings, 'APP_VERSION', 'unknown'),
                'files': [
                    {
                        'name': file.name,
                        'size_bytes': file.stat().st_size,
                        'sha256': sha256(file),
                    }
                    for file in files
                ],
            }
            manifest_path = backup_dir / 'manifest.json'
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
            os.chmod(manifest_path, 0o600)
            self._apply_retention(root, keep)
            self.stdout.write(self.style.SUCCESS(f'Backup created: {backup_dir}'))
            self.stdout.write(f'Manifest: {manifest_path}')
        except Exception:
            shutil.rmtree(backup_dir, ignore_errors=True)
            raise

    def _backup_database(self, backup_dir):
        config = settings.DATABASES['default']
        engine = config['ENGINE']
        if engine.endswith('sqlite3'):
            source_path = Path(config['NAME'])
            if not source_path.exists():
                raise CommandError('SQLite database file was not found.')
            target_path = backup_dir / 'database.sqlite3'
            source = sqlite3.connect(str(source_path))
            target = sqlite3.connect(str(target_path))
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()
            os.chmod(target_path, 0o600)
            return target_path

        if engine.endswith('postgresql'):
            target_path = backup_dir / 'database.dump'
            executable = os.getenv('PG_DUMP_PATH', 'pg_dump')
            command = [executable, '--format=custom', '--no-owner', '--no-acl', '--file', str(target_path)]
            if config.get('HOST'):
                command.extend(['--host', str(config['HOST'])])
            if config.get('PORT'):
                command.extend(['--port', str(config['PORT'])])
            if config.get('USER'):
                command.extend(['--username', str(config['USER'])])
            command.append(str(config['NAME']))
            environment = os.environ.copy()
            if config.get('PASSWORD'):
                environment['PGPASSWORD'] = str(config['PASSWORD'])
            try:
                subprocess.run(command, check=True, capture_output=True, text=True, env=environment)
            except FileNotFoundError as exc:
                raise CommandError('pg_dump was not found. Install PostgreSQL client tools or set PG_DUMP_PATH.') from exc
            except subprocess.CalledProcessError as exc:
                raise CommandError('pg_dump failed. Check database connectivity and server-side credentials.') from exc
            os.chmod(target_path, 0o600)
            return target_path

        raise CommandError(f'Unsupported database engine: {engine}')

    def _backup_media(self, backup_dir):
        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            return None
        target_path = backup_dir / 'media.tar.gz'
        with tarfile.open(target_path, 'w:gz') as archive:
            archive.add(media_root, arcname='media')
        os.chmod(target_path, 0o600)
        return target_path

    def _apply_retention(self, root, keep):
        backups = sorted(
            [path for path in root.iterdir() if path.is_dir() and path.name.startswith('vin-matrix-')],
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        for old_backup in backups[keep:]:
            shutil.rmtree(old_backup, ignore_errors=True)
