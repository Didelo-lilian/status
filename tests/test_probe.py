import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import probe  # noqa: E402

TARGET = {"key": "hello", "name": "Hello page", "url": "https://example.test"}


class RecordTest(unittest.TestCase):
    def test_appends_a_check(self):
        history = {"targets": {}}
        probe.record(history, TARGET, True, 42, 1000)
        self.assertEqual(history["targets"]["hello"]["checks"], [[1000, 1, 42]])
        self.assertEqual(history["updated"], 1000)

    def test_drops_checks_older_than_thirty_days(self):
        now = 100 * 86400
        history = {"targets": {"hello": {"checks": [[now - 31 * 86400, 1, 10], [now - 86400, 0, 20]]}}}
        probe.record(history, TARGET, True, 5, now)
        self.assertEqual([c[0] for c in history["targets"]["hello"]["checks"]], [now - 86400, now])


class RetryTest(unittest.TestCase):
    @mock.patch("probe.time.sleep")
    @mock.patch("probe.probe")
    def test_a_blip_is_forgiven(self, fake_probe, _sleep):
        fake_probe.side_effect = [(False, 20000), (True, 80)]
        self.assertEqual(probe.probe_with_retry("https://example.test"), (True, 80))

    @mock.patch("probe.time.sleep")
    @mock.patch("probe.probe")
    def test_a_confirmed_failure_is_down(self, fake_probe, _sleep):
        fake_probe.side_effect = [(False, 20000), (False, 20000)]
        self.assertFalse(probe.probe_with_retry("https://example.test")[0])


if __name__ == "__main__":
    unittest.main()
