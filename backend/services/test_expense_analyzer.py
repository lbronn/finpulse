"""
Tests for ExpenseAnalyzer.

Tests pure functions only (data formatting, JSON parsing, validation).
No LLM calls. No DB interaction.
"""
import json
import os
import unittest
from decimal import Decimal

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from services.expense_analyzer import ExpenseAnalyzer


class TestExpenseAnalyzerParsing(unittest.TestCase):

    def setUp(self):
        self.analyzer = ExpenseAnalyzer.__new__(ExpenseAnalyzer)

    def test_parse_valid_json(self):
        """_parse_llm_response handles clean JSON."""
        payload = {
            'insights': [
                {
                    'type': 'trend',
                    'title': 'Food spending up',
                    'description': 'You spent 20% more on food.',
                    'severity': 'warning',
                }
            ],
            'summary': 'Overall OK.',
        }
        raw = json.dumps(payload)
        result = self.analyzer._parse_llm_response(raw)
        self.assertEqual(len(result['insights']), 1)
        self.assertEqual(result['insights'][0]['type'], 'trend')
        self.assertEqual(result['summary'], 'Overall OK.')

    def test_parse_markdown_wrapped_json(self):
        """_parse_llm_response strips ```json fences before parsing."""
        payload = {'insights': [], 'summary': 'No data.'}
        raw = f'```json\n{json.dumps(payload)}\n```'
        result = self.analyzer._parse_llm_response(raw)
        self.assertEqual(result['summary'], 'No data.')

    def test_parse_invalid_json_returns_fallback(self):
        """_parse_llm_response returns a fallback insight on parse failure."""
        result = self.analyzer._parse_llm_response('not valid json at all')
        self.assertIn('insights', result)
        self.assertGreater(len(result['insights']), 0)
        self.assertEqual(result['insights'][0]['type'], 'pattern')
        self.assertEqual(result['insights'][0]['severity'], 'info')

    def test_format_expense_table(self):
        """_format_expense_table returns pipe-delimited table string."""
        expenses = [
            {
                'expense_date': '2026-03-14',
                'category_name': 'Food & Dining',
                'amount': Decimal('450.00'),
                'description': 'Lunch',
            }
        ]
        table = self.analyzer._format_expense_table(expenses)
        self.assertIn('2026-03-14', table)
        self.assertIn('Food & Dining', table)
        self.assertIn('450.00', table)
        self.assertIn('Lunch', table)

    def test_validate_insight_fields(self):
        """_validate_insights drops incomplete insights."""
        insights = [
            {'type': 'trend', 'title': 'Up', 'description': 'More', 'severity': 'info'},
            {'type': 'trend', 'title': 'Missing desc'},  # incomplete
        ]
        valid = self.analyzer._validate_insights(insights)
        self.assertEqual(len(valid), 1)
        self.assertEqual(valid[0]['title'], 'Up')


if __name__ == '__main__':
    unittest.main()
