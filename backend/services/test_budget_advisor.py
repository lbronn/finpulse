"""
Tests for BudgetAdvisor.

Tests pure functions: JSON parsing, recommendation validation, journal formatting.
No LLM calls. No DB interaction.
"""
import json
import os
import unittest

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()


class TestBudgetAdvisorParsing(unittest.TestCase):

    def setUp(self):
        from services.budget_advisor import BudgetAdvisor
        self.advisor = BudgetAdvisor.__new__(BudgetAdvisor)

    def test_parse_valid_recommendations(self):
        """_parse_llm_response returns validated recommendations."""
        payload = {
            'recommendations': [
                {
                    'category': 'Food & Dining',
                    'current_goal': 15000.0,
                    'suggested_goal': 12000.0,
                    'reasoning': 'You consistently spend 20% under goal.',
                    'confidence': 'high',
                    'impact': 'Save ₱3,000/month.',
                }
            ],
            'overall_advice': 'You are on track.',
        }
        result = self.advisor._parse_llm_response(json.dumps(payload))
        self.assertEqual(len(result['recommendations']), 1)
        self.assertEqual(result['recommendations'][0]['category'], 'Food & Dining')
        self.assertEqual(result['overall_advice'], 'You are on track.')

    def test_parse_markdown_wrapped_json(self):
        """_parse_llm_response handles ```json fences."""
        payload = {'recommendations': [], 'overall_advice': 'Great job.'}
        raw = f'```json\n{json.dumps(payload)}\n```'
        result = self.advisor._parse_llm_response(raw)
        self.assertEqual(result['overall_advice'], 'Great job.')

    def test_parse_invalid_json_returns_fallback(self):
        """_parse_llm_response returns fallback on bad JSON."""
        result = self.advisor._parse_llm_response('totally broken')
        self.assertIn('recommendations', result)
        self.assertIn('overall_advice', result)

    def test_validate_recommendations_drops_incomplete(self):
        """_validate_recommendations drops entries missing required fields."""
        recs = [
            {
                'category': 'Food',
                'current_goal': 1000.0,
                'suggested_goal': 800.0,
                'reasoning': 'Under budget.',
                'confidence': 'high',
                'impact': 'Save 200.',
            },
            {'category': 'Food', 'current_goal': 1000.0},  # incomplete
        ]
        valid = self.advisor._validate_recommendations(recs)
        self.assertEqual(len(valid), 1)

    def test_format_journal_entries(self):
        """_format_journal_entries produces expected text format."""
        entries = [
            {
                'entry_date': '2026-03-10',
                'title': 'Meal prep decision',
                'tags': ['food', 'savings'],
                'content': 'Started meal prepping on Sundays.',
            }
        ]
        text = self.advisor._format_journal_entries(entries)
        self.assertIn('2026-03-10', text)
        self.assertIn('Meal prep decision', text)
        self.assertIn('food', text)
        self.assertIn('Started meal prepping', text)


if __name__ == '__main__':
    unittest.main()
