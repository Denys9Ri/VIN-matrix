import base64
import os
import tempfile
from pathlib import Path

from django.test import SimpleTestCase

from apps.core.backup_crypto import decrypt_file, encrypt_file


class BackupCryptoTests(SimpleTestCase):
    def test_aes_gcm_backup_round_trip(self):
        key = base64.urlsafe_b64encode(os.urandom(32)).decode('ascii')
        payload = os.urandom(1024 * 64) + b'vin-matrix-backup'

        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / 'source.bin'
            encrypted = Path(temp_dir) / 'source.bin.aes'
            restored = Path(temp_dir) / 'restored.bin'
            source.write_bytes(payload)

            encrypt_file(source, encrypted, key=key)
            decrypt_file(encrypted, restored, key=key)

            self.assertNotEqual(encrypted.read_bytes(), payload)
            self.assertEqual(restored.read_bytes(), payload)
