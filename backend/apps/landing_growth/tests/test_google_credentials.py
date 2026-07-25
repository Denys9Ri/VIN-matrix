import base64
import json

from django.test import SimpleTestCase

from apps.landing_growth.clients import ExternalServiceError, _load_service_account_info


SERVICE_ACCOUNT = {
    'type': 'service_account',
    'project_id': 'vin-matrix-test',
    'private_key_id': 'test-key-id',
    'private_key': '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
    'client_email': 'growth@vin-matrix-test.iam.gserviceaccount.com',
    'client_id': '1234567890',
    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
    'token_uri': 'https://oauth2.googleapis.com/token',
    'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
    'client_x509_cert_url': 'https://www.googleapis.com/robot/v1/metadata/x509/test',
}


class GoogleCredentialParsingTests(SimpleTestCase):
    def _base64(self):
        payload = json.dumps(SERVICE_ACCOUNT, separators=(',', ':')).encode('utf-8')
        return base64.b64encode(payload).decode('ascii')

    def test_accepts_standard_base64(self):
        self.assertEqual(_load_service_account_info(self._base64()), SERVICE_ACCOUNT)

    def test_accepts_quoted_prefixed_base64_with_whitespace(self):
        encoded = self._base64()
        wrapped = '\n'.join(encoded[index:index + 64] for index in range(0, len(encoded), 64))
        value = f'GOOGLE_APPLICATION_CREDENTIALS="base64:{wrapped}"'
        self.assertEqual(_load_service_account_info(value), SERVICE_ACCOUNT)

    def test_accepts_base64_without_padding(self):
        self.assertEqual(_load_service_account_info(self._base64().rstrip('=')), SERVICE_ACCOUNT)

    def test_accepts_raw_json(self):
        self.assertEqual(_load_service_account_info(json.dumps(SERVICE_ACCOUNT)), SERVICE_ACCOUNT)

    def test_rejects_non_service_account_json(self):
        with self.assertRaisesMessage(ExternalServiceError, 'Service Account'):
            _load_service_account_info(json.dumps({'type': 'authorized_user'}))
