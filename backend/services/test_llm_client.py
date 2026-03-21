"""
Tests for LLMClient.

Uses LLMClient.__new__() to bypass __init__, then injects mock attributes directly.
No real API calls are made. No database interaction.
"""
import os
import django
import unittest
from unittest.mock import MagicMock

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from services.llm_client import LLMClient


class TestLLMClient(unittest.TestCase):

    def _make_mock_client(self):
        """Create a LLMClient with injected mock Anthropic client."""
        client = LLMClient.__new__(LLMClient)
        client.model = 'claude-sonnet-4-20250514'
        client.client = MagicMock()
        return client

    def test_complete_returns_expected_shape(self):
        """complete() returns dict with content, tokens_used, model."""
        client = self._make_mock_client()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='Hello world')]
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50
        client.client.messages.create.return_value = mock_response

        result = client.complete(
            system_prompt='You are helpful.',
            user_prompt='Say hello.',
        )

        self.assertIn('content', result)
        self.assertIn('tokens_used', result)
        self.assertIn('model', result)
        self.assertEqual(result['content'], 'Hello world')
        self.assertEqual(result['tokens_used'], 150)

    def test_complete_propagates_api_error(self):
        """complete() re-raises anthropic.APIError subclasses."""
        import anthropic as real_anthropic
        client = self._make_mock_client()
        client.client.messages.create.side_effect = real_anthropic.APIStatusError(
            message='rate limit',
            response=MagicMock(status_code=429, headers={}),
            body={},
        )

        with self.assertRaises(real_anthropic.APIStatusError):
            client.complete('sys', 'user')

    def test_complete_raises_on_empty_content(self):
        """complete() raises ValueError when response has empty content list."""
        client = self._make_mock_client()
        mock_response = MagicMock()
        mock_response.content = []
        mock_response.stop_reason = 'max_tokens'
        client.client.messages.create.return_value = mock_response

        with self.assertRaises(ValueError):
            client.complete('sys', 'user')


if __name__ == '__main__':
    unittest.main()
