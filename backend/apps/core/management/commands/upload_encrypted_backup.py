import json
import os
import shutil
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.core.backup_crypto import create_archive, encrypt_file, sha256_file


def backup_root():
    value = str(os.getenv('BACKUP_DIR') or os.getenv('POSTGRES_BACKUP_DIR') or '').strip()
    if not value:
        raise CommandError('BACKUP_DIR is not configured.')
    return Path(value).expanduser().resolve()


def latest_snapshot(root):
    snapshots = sorted(
        [item for item in root.iterdir() if item.is_dir() and item.name.startswith('vin-matrix-')],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    if not snapshots:
        raise CommandError('No local VIN-matrix snapshot exists yet.')
    return snapshots[0]


def verify_manifest(snapshot):
    manifest_path = snapshot / 'manifest.json'
    if not manifest_path.exists():
        raise CommandError('Backup manifest.json is missing.')
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    except Exception as exc:
        raise CommandError('Backup manifest.json is invalid.') from exc

    for item in manifest.get('files', []):
        path = snapshot / str(item.get('name') or '')
        if not path.exists():
            raise CommandError(f'Missing backup file: {path.name}')
        if sha256_file(path) != item.get('sha256'):
            raise CommandError(f'Checksum mismatch: {path.name}')
    return manifest


def s3_client():
    try:
        import boto3
    except Exception as exc:
        raise CommandError('boto3 is not installed. Rebuild the backend image.') from exc

    bucket = str(os.getenv('BACKUP_S3_BUCKET', '')).strip()
    if not bucket:
        raise CommandError('BACKUP_S3_BUCKET is not configured.')
    return boto3.client(
        's3',
        endpoint_url=str(os.getenv('BACKUP_S3_ENDPOINT_URL', '')).strip() or None,
        region_name=str(os.getenv('BACKUP_S3_REGION', 'us-east-1')).strip() or None,
        aws_access_key_id=str(os.getenv('BACKUP_S3_ACCESS_KEY_ID', '')).strip() or None,
        aws_secret_access_key=str(os.getenv('BACKUP_S3_SECRET_ACCESS_KEY', '')).strip() or None,
    ), bucket


class Command(BaseCommand):
    help = 'Create/verify a local snapshot, encrypt it with AES-256-GCM and upload to S3-compatible storage.'

    def add_arguments(self, parser):
        parser.add_argument('--source', help='Existing local backup directory. Defaults to a freshly created snapshot.')
        parser.add_argument('--include-media', action='store_true')
        parser.add_argument('--keep', type=int, default=int(os.getenv('BACKUP_KEEP', '14')))
        parser.add_argument('--prefix', default=os.getenv('BACKUP_S3_PREFIX', 'vin-matrix'))

    def handle(self, *args, **options):
        source = options.get('source')
        if source:
            snapshot = Path(source).expanduser().resolve()
            if not snapshot.is_dir():
                raise CommandError('The provided --source directory does not exist.')
        else:
            root = backup_root()
            before = {item.name for item in root.glob('vin-matrix-*')}
            call_command('create_backup', include_media=options['include_media'], keep=options['keep'])
            created = [item for item in root.glob('vin-matrix-*') if item.name not in before and item.is_dir()]
            snapshot = created[0] if created else latest_snapshot(root)

        manifest = verify_manifest(snapshot)
        client, bucket = s3_client()
        prefix = str(options['prefix'] or 'vin-matrix').strip('/')
        object_key = f'{prefix}/{snapshot.name}.tar.gz.aes'

        with tempfile.TemporaryDirectory(prefix='vin-matrix-upload-') as temp_dir:
            archive = Path(temp_dir) / f'{snapshot.name}.tar.gz'
            encrypted = Path(temp_dir) / f'{snapshot.name}.tar.gz.aes'
            create_archive(snapshot, archive)
            encrypt_file(archive, encrypted)

            extra_args = {'Metadata': {'source-sha256': sha256_file(archive), 'app-version': str(manifest.get('app_version') or 'unknown')}}
            server_side = str(os.getenv('BACKUP_S3_SERVER_SIDE_ENCRYPTION', '')).strip()
            if server_side:
                extra_args['ServerSideEncryption'] = server_side
            client.upload_file(str(encrypted), bucket, object_key, ExtraArgs=extra_args)

        self.stdout.write(self.style.SUCCESS(f'Encrypted backup uploaded: s3://{bucket}/{object_key}'))
