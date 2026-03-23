from unittest.mock import patch, MagicMock
from django.test import SimpleTestCase, override_settings


@override_settings(
    AI_MONTHLY_ANALYSIS_LIMIT=10,
    AI_MONTHLY_RECOMMENDATION_LIMIT=10,
    AI_MONTHLY_CHAT_LIMIT=50,
    AI_MONTHLY_DIGEST_LIMIT=4,
)
class CheckQuotaTest(SimpleTestCase):
    def _make_cursor(self, count):
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)
        mock_cursor.fetchone.return_value = (count,)
        return mock_cursor

    def test_returns_allowed_when_under_limit(self):
        with patch('services.quota.connection') as mock_conn:
            mock_conn.cursor.return_value = self._make_cursor(3)
            from services.quota import check_quota
            result = check_quota('user-123', 'expense_analysis')

        self.assertTrue(result['allowed'])
        self.assertEqual(result['used'], 3)
        self.assertEqual(result['limit'], 10)
        self.assertEqual(result['remaining'], 7)

    def test_returns_not_allowed_when_at_limit(self):
        with patch('services.quota.connection') as mock_conn:
            mock_conn.cursor.return_value = self._make_cursor(10)
            from services.quota import check_quota
            result = check_quota('user-123', 'expense_analysis')

        self.assertFalse(result['allowed'])
        self.assertEqual(result['remaining'], 0)

    def test_chat_uses_chat_messages_table(self):
        with patch('services.quota.connection') as mock_conn:
            mock_conn.cursor.return_value = self._make_cursor(5)
            from services.quota import check_quota
            result = check_quota('user-123', 'chat')

        call_args = mock_conn.cursor.return_value.__enter__.return_value.execute.call_args[0][0]
        self.assertIn('chat_messages', call_args)
        self.assertEqual(result['limit'], 50)
