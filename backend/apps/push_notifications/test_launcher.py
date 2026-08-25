from unittest import mock

from django.test import SimpleTestCase

from apps.push_notifications.launcher import start_push_scheduler_background


class PushSchedulerLauncherTests(SimpleTestCase):
    @mock.patch('apps.push_notifications.launcher.time.sleep', return_value=None)
    @mock.patch('apps.push_notifications.launcher.subprocess.Popen')
    def test_starts_scheduler_in_background(self, popen, _sleep):
        process = mock.Mock(pid=4321)
        process.poll.return_value = None
        popen.return_value = process

        with mock.patch.dict('os.environ', {
            'VIN_MATRIX_PUSH_SCHEDULER_AUTOSTART': '1',
            'VIN_MATRIX_PUSH_SCHEDULER_INTERVAL': '45',
        }, clear=False):
            result = start_push_scheduler_background()

        self.assertTrue(result['started'])
        self.assertEqual(result['pid'], 4321)
        command = popen.call_args.args[0]
        self.assertIn('run_push_scheduler', command)
        self.assertEqual(command[-2:], ['--interval', '45'])
        self.assertTrue(popen.call_args.kwargs['start_new_session'])

    @mock.patch('apps.push_notifications.launcher.time.sleep', return_value=None)
    @mock.patch('apps.push_notifications.launcher.subprocess.Popen')
    def test_clean_exit_means_scheduler_already_running(self, popen, _sleep):
        process = mock.Mock(pid=4321)
        process.poll.return_value = 0
        popen.return_value = process

        with mock.patch.dict('os.environ', {'VIN_MATRIX_PUSH_SCHEDULER_AUTOSTART': '1'}, clear=False):
            result = start_push_scheduler_background()

        self.assertFalse(result['started'])
        self.assertTrue(result['already_running'])

    @mock.patch('apps.push_notifications.launcher.subprocess.Popen')
    def test_can_disable_autostart_explicitly(self, popen):
        with mock.patch.dict('os.environ', {'VIN_MATRIX_PUSH_SCHEDULER_AUTOSTART': '0'}, clear=False):
            result = start_push_scheduler_background()

        self.assertTrue(result['disabled'])
        popen.assert_not_called()

    @mock.patch('apps.push_notifications.launcher.time.sleep', return_value=None)
    @mock.patch('apps.push_notifications.launcher.subprocess.Popen')
    def test_failed_scheduler_start_breaks_bootstrap(self, popen, _sleep):
        process = mock.Mock(pid=4321)
        process.poll.return_value = 2
        popen.return_value = process

        with mock.patch.dict('os.environ', {'VIN_MATRIX_PUSH_SCHEDULER_AUTOSTART': '1'}, clear=False):
            with self.assertRaisesRegex(RuntimeError, 'exit code 2'):
                start_push_scheduler_background()
