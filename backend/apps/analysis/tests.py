"""
Tests for apps/analysis/views.py.

Tests authentication checks and input validation.
LLM calls are NOT made in these tests — validation errors are caught before
the service layer is invoked.

Integration tests with real LLM calls should be run manually with a real
ANTHROPIC_API_KEY and real data (see phase-3.md acceptance criteria).
"""
from django.test import TestCase, RequestFactory

from apps.analysis import views


class AnalyzeExpensesViewTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()

    def _make_request(self, data, authenticated=True):
        import json
        request = self.factory.post(
            '/api/analysis/expenses',
            data=json.dumps(data),
            content_type='application/json',
        )
        if authenticated:
            request.user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        return request

    def test_returns_401_when_not_authenticated(self):
        """Returns 401 when user_id is not on the request."""
        request = self._make_request({}, authenticated=False)
        response = views.analyze_expenses(request)
        self.assertEqual(response.status_code, 401)

    def test_returns_400_when_start_date_missing(self):
        """Returns 400 when start_date is absent."""
        request = self._make_request({'end_date': '2026-03-31'})
        response = views.analyze_expenses(request)
        self.assertEqual(response.status_code, 400)

    def test_returns_400_when_end_date_missing(self):
        """Returns 400 when end_date is absent."""
        request = self._make_request({'start_date': '2026-03-01'})
        response = views.analyze_expenses(request)
        self.assertEqual(response.status_code, 400)

    def test_returns_400_when_dates_invalid_format(self):
        """Returns 400 when date strings are not valid ISO dates."""
        request = self._make_request({'start_date': 'not-a-date', 'end_date': '2026-03-31'})
        response = views.analyze_expenses(request)
        self.assertEqual(response.status_code, 400)

    def test_returns_400_when_end_before_start(self):
        """Returns 400 when end_date < start_date."""
        request = self._make_request({'start_date': '2026-03-31', 'end_date': '2026-03-01'})
        response = views.analyze_expenses(request)
        self.assertEqual(response.status_code, 400)


class BudgetRecommendationsViewTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()

    def _make_request(self, data, authenticated=True):
        import json
        request = self.factory.post(
            '/api/analysis/recommendations',
            data=json.dumps(data),
            content_type='application/json',
        )
        if authenticated:
            request.user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        return request

    def test_returns_401_when_not_authenticated(self):
        request = self._make_request({}, authenticated=False)
        response = views.budget_recommendations(request)
        self.assertEqual(response.status_code, 401)

    def test_returns_400_when_month_missing(self):
        request = self._make_request({})
        response = views.budget_recommendations(request)
        self.assertEqual(response.status_code, 400)

    def test_returns_400_when_month_invalid_format(self):
        request = self._make_request({'month': '2026/03'})
        response = views.budget_recommendations(request)
        self.assertEqual(response.status_code, 400)


class AnalysisHistoryViewTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()

    def _make_request(self, params='', authenticated=True):
        request = self.factory.get(f'/api/analysis/history{params}')
        if authenticated:
            request.user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        return request

    def test_returns_401_when_not_authenticated(self):
        request = self._make_request(authenticated=False)
        response = views.analysis_history_list(request)
        self.assertEqual(response.status_code, 401)
