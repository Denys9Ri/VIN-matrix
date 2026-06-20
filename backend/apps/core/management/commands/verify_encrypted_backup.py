import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.backup_crypto import decrypt_file, extract_archive, sha256_file
from apps.core.management.commands.upload_encrypted_backup import s3_client


class Command(BaseCommand):
    help = 'Download, decrypt and verify an external backup. Does not overwrite any database.'

    def add_arguments(self, parser):
        parser.add_argument('--key', required=True, help='S3 object key of the encrypted backup.')
        parser.add_argument('--keep-files', action='store_true', help='Keep decrypted verification files in a temporary directory path printed to console.')

    def handle(self, *args, **options):
        client, bucket = s3_client()
        object_key = options['key']
        temp_dir = Path(tempfile.mkdtemp(prefix='vin-matrix-restore-verify-'))
        try:
            encrypted = temp_dir / 'backup.tar.gz.aes'
            archive = temp_dir / 'backup.tar.gz'
            extracted = temp_dir / 'extracted'
            client.download_file(bucket, object_key, str(encrypted))
            decrypt_file(encrypted, archive)
            extract_archive(archive, extracted)

            snapshots = [item for item in extracted.iterdir() if item.is_dir() and item.name.startswith('vin-matrix-')]
            if len(snapshots) != 1:
                raise CommandError('Expected exactly one snapshot directory after extraction.')
            snapshot = snapshots[0]
            manifest_path = snapshot / 'manifest.json'
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            for item in manifest.get('files', []):
                file_path = snapshot / str(item.get('name') or '')
                if not file_path.exists() or sha256_file(file_path) != item.get('sha256'):
                    raise CommandError(f'Checksum verification failed: {file_path.name}')

            database_files = list(snapshot.glob('database.*'))
            if not database_files:
                raise CommandError('Database backup file is missing.')
            database_file = database_files[0]
            engine = str(manifest.get('database_engine') or '')
            if engine.endswith('postgresql'):
                try:
                    subprocess.run(['pg_restore', '--list', str(database_file)], check=True, capture_output=True, text=True)
                except FileNotFoundError as exc:
                    raise CommandError('pg_restore was not found. Rebuild the backend image with PostgreSQL client tools.') from exc
                except subprocess.CalledProcessError as exc:
                    raise CommandError('PostgreSQL dump could not be read by pg_restore.') from exc
            elif engine.endswith('sqlite3'):
                import sqlite3
                db = sqlite3.connect(str(database_file))
                try:
                    result = db.execute('PRAGMA integrity_check').fetchone()[0]
                finally:
                    db.close()
                if result != 'ok':
                    raise CommandError(f'SQLite integrity check failed: {result}')

            self.stdout.write(self.style.SUCCESS('Encrypted backup verified: decryption, manifest and database dump are readable.'))
            self.stdout.write('For a full restore drill, restore this verified snapshot into a separate staging database only.')
            if options['keep_files']:
                self.stdout.write(f'Kept verification files: {temp_dir}')
                temp_dir = None
        finally:
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)
