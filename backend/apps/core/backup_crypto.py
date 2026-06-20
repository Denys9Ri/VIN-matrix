import base64
import hashlib
import os
import tarfile
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.core.management.base import CommandError


MAGIC = b'VINBACKUP1'
NONCE_SIZE = 12
TAG_SIZE = 16
CHUNK_SIZE = 1024 * 1024


def load_encryption_key(raw_key=None):
    raw = str(raw_key or os.getenv('BACKUP_ENCRYPTION_KEY', '')).strip()
    if not raw:
        raise CommandError('BACKUP_ENCRYPTION_KEY is not configured.')
    try:
        key = base64.urlsafe_b64decode(raw.encode('ascii'))
    except Exception as exc:
        raise CommandError('BACKUP_ENCRYPTION_KEY must be urlsafe base64.') from exc
    if len(key) != 32:
        raise CommandError('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256.')
    return key


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(CHUNK_SIZE), b''):
            digest.update(chunk)
    return digest.hexdigest()


def create_archive(source_dir, archive_path):
    source_dir = Path(source_dir)
    archive_path = Path(archive_path)
    with tarfile.open(archive_path, 'w:gz') as archive:
        archive.add(source_dir, arcname=source_dir.name)
    return archive_path


def encrypt_file(source_path, encrypted_path, key=None):
    key = load_encryption_key(key)
    source_path = Path(source_path)
    encrypted_path = Path(encrypted_path)
    nonce = os.urandom(NONCE_SIZE)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()

    with source_path.open('rb') as source, encrypted_path.open('wb') as target:
        target.write(MAGIC)
        target.write(nonce)
        for chunk in iter(lambda: source.read(CHUNK_SIZE), b''):
            target.write(encryptor.update(chunk))
        target.write(encryptor.finalize())
        target.write(encryptor.tag)
    return encrypted_path


def decrypt_file(encrypted_path, output_path, key=None):
    key = load_encryption_key(key)
    encrypted_path = Path(encrypted_path)
    output_path = Path(output_path)
    total_size = encrypted_path.stat().st_size
    minimum_size = len(MAGIC) + NONCE_SIZE + TAG_SIZE
    if total_size <= minimum_size:
        raise CommandError('Encrypted backup is incomplete.')

    with encrypted_path.open('rb') as source:
        magic = source.read(len(MAGIC))
        if magic != MAGIC:
            raise CommandError('Encrypted backup has an unknown format.')
        nonce = source.read(NONCE_SIZE)
        source.seek(total_size - TAG_SIZE)
        tag = source.read(TAG_SIZE)
        source.seek(len(MAGIC) + NONCE_SIZE)
        remaining = total_size - len(MAGIC) - NONCE_SIZE - TAG_SIZE
        decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        with output_path.open('wb') as target:
            while remaining > 0:
                chunk = source.read(min(CHUNK_SIZE, remaining))
                if not chunk:
                    raise CommandError('Encrypted backup ended unexpectedly.')
                remaining -= len(chunk)
                target.write(decryptor.update(chunk))
            try:
                target.write(decryptor.finalize())
            except Exception as exc:
                raise CommandError('Backup encryption key is wrong or the file was modified.') from exc
    return output_path


def extract_archive(archive_path, target_dir):
    archive_path = Path(archive_path)
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, 'r:gz') as archive:
        for member in archive.getmembers():
            member_path = (target_dir / member.name).resolve()
            if not str(member_path).startswith(str(target_dir.resolve())):
                raise CommandError('Backup archive contains an unsafe path.')
        archive.extractall(target_dir)
    return target_dir
