# Phase 3: LLM Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement AI-powered expense analysis and budget recommendations via the Anthropic Claude API, wired end-to-end from Django services through to the React frontend.

**Architecture:** Service layer pattern — `llm_client.py` wraps the Anthropic SDK, `expense_analyzer.py` and `budget_advisor.py` compose data + prompts, Django views in `apps/analysis/views.py` orchestrate and store results, frontend `AnalysisPage.tsx` renders three tabs (Expense Analysis, Budget Recommendations, History). All LLM calls are backend-only; the API key never touches the frontend.

**Tech Stack:** Python `anthropic` SDK, Django 6.0.3 + DRF, React 18 + TypeScript strict mode, shadcn/ui Tabs/Card/Badge, Lucide icons.

---

## Pre-flight Checks

- [ ] Confirm `analysis_history` table exists in Supabase. Run:
  ```bash
  cd backend && python manage.py shell -c "from apps.analysis.models import AnalysisHistory; print(AnalysisHistory.objects.count())"
  ```
  If it throws `UndefinedTable`, add it in Supabase SQL editor (see `docs/database_schema.md`).

- [ ] Have your `ANTHROPIC_API_KEY` ready (`sk-ant-...`).

---

## File Map

| Action | Path |
|--------|------|
| MODIFY | `backend/requirements.txt` |
| MODIFY | `backend/core/settings.py` |
| MODIFY | `.env` (project root) |
| CREATE | `backend/services/__init__.py` |
| CREATE | `backend/services/llm_client.py` |
| CREATE | `backend/services/expense_analyzer.py` |
| CREATE | `backend/services/budget_advisor.py` |
| CREATE | `backend/apps/analysis/tests.py` (replace placeholder) |
| MODIFY | `backend/apps/analysis/views.py` |
| CREATE | `backend/apps/analysis/urls.py` |
| MODIFY | `backend/core/urls.py` |
| MODIFY | `frontend/src/types/index.ts` |
| MODIFY | `frontend/src/pages/AnalysisPage.tsx` |
| MODIFY | `frontend/src/pages/SettingsPage.tsx` |

---

## Chunk 1: Backend Services Layer

### Task 1: Install Anthropic SDK + Configure Environment

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/core/settings.py`
- Modify: `.env` (project root)

- [ ] **Step 1: Add anthropic to requirements.txt**

  Append to `backend/requirements.txt`:
  ```
  anthropic==0.51.0
  ```

- [ ] **Step 2: Install the SDK**

  ```bash
  cd backend && pip install anthropic==0.51.0
  ```
  Expected: Successfully installed anthropic-0.51.0 (and dependencies: httpx, httpcore, etc.)

- [ ] **Step 3: Freeze requirements**

  ```bash
  cd backend && pip freeze | grep -E "anthropic|httpx|httpcore" >> requirements.txt
  ```
  Then manually clean up `requirements.txt` to avoid duplicates — just keep `anthropic==0.51.0` and its actual transitive deps that aren't already listed.

  Actually, simpler approach:
  ```bash
  cd backend && pip freeze > requirements.txt
  ```

- [ ] **Step 4: Add ANTHROPIC settings to settings.py**

  Add to the bottom of `backend/core/settings.py`:
  ```python
  # Anthropic LLM
  ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
  ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')
  ```

- [ ] **Step 5: Add ANTHROPIC_API_KEY to .env**

  Add to `.env` (project root):
  ```
  ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE
  ANTHROPIC_MODEL=claude-sonnet-4-20250514
  ```

- [ ] **Step 6: Verify settings load**

  ```bash
  cd backend && python manage.py shell -c "from django.conf import settings; print(settings.ANTHROPIC_MODEL)"
  ```
  Expected: `claude-sonnet-4-20250514`

- [ ] **Step 7: Commit**

  ```bash
  git add backend/requirements.txt backend/core/settings.py
  git commit -m "feat: add anthropic SDK dependency and LLM settings"
  ```

---

### Task 2: Create LLM Client Service

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/llm_client.py`

- [ ] **Step 1: Write the test**

  Create `backend/services/test_llm_client.py`:

  ```python
  """
  Tests for LLMClient.

  These tests mock the Anthropic SDK to avoid real API calls.
  The database is not involved — no mocking of DB needed.
  """
  import unittest
  from unittest.mock import MagicMock, patch


  class TestLLMClient(unittest.TestCase):

      def _make_client(self):
          with patch('services.llm_client.anthropic') as mock_anthropic:
              mock_anthropic.Anthropic.return_value = MagicMock()
              with patch('django.conf.settings') as mock_settings:
                  mock_settings.ANTHROPIC_API_KEY = 'test-key'
                  mock_settings.ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
                  from services.llm_client import LLMClient
                  client = LLMClient.__new__(LLMClient)
                  client.model = 'claude-sonnet-4-20250514'
                  client.client = mock_anthropic.Anthropic.return_value
                  return client

      def test_complete_returns_expected_shape(self):
          """complete() returns dict with content, tokens_used, model."""
          with patch('services.llm_client.anthropic') as mock_anthropic:
              mock_response = MagicMock()
              mock_response.content = [MagicMock(text='Hello world')]
              mock_response.usage.input_tokens = 100
              mock_response.usage.output_tokens = 50
              mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_response

              with patch('django.conf.settings') as mock_settings:
                  mock_settings.ANTHROPIC_API_KEY = 'test-key'
                  mock_settings.ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
                  from services.llm_client import LLMClient
                  client = LLMClient()
                  # Override internal client with mock
                  client.client = mock_anthropic.Anthropic.return_value
                  client.model = 'claude-sonnet-4-20250514'

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
          """complete() re-raises anthropic.APIError."""
          import anthropic
          with patch('services.llm_client.anthropic') as mock_anthropic:
              mock_anthropic.APIError = anthropic.APIError
              mock_anthropic.Anthropic.return_value.messages.create.side_effect = (
                  anthropic.APIStatusError(
                      message='rate limit',
                      response=MagicMock(status_code=429),
                      body={},
                  )
              )
              with patch('django.conf.settings') as mock_settings:
                  mock_settings.ANTHROPIC_API_KEY = 'test-key'
                  mock_settings.ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
                  from services.llm_client import LLMClient
                  client = LLMClient()
                  client.client = mock_anthropic.Anthropic.return_value

              with self.assertRaises(anthropic.APIStatusError):
                  client.complete('sys', 'user')


  if __name__ == '__main__':
      unittest.main()
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd backend && python -m pytest services/test_llm_client.py -v 2>&1 | head -30
  ```
  Expected: `ModuleNotFoundError: No module named 'services'`

- [ ] **Step 3: Create the services package and llm_client**

  Create `backend/services/__init__.py` (empty):
  ```python
  ```

  Create `backend/services/llm_client.py`:
  ```python
  """
  LLM client abstraction layer.

  Summary: Wraps the Anthropic SDK to provide a clean interface for sending
  prompts and receiving structured responses. Handles error logging and
  token usage tracking.

  Dependencies: anthropic (pip install anthropic)
  """
  import logging

  import anthropic
  from django.conf import settings

  logger = logging.getLogger(__name__)


  class LLMClient:
      def __init__(self):
          self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
          self.model = settings.ANTHROPIC_MODEL

      def complete(
          self,
          system_prompt: str,
          user_prompt: str,
          max_tokens: int = 2000,
          temperature: float = 0.3,
      ) -> dict:
          """
          Send a prompt to Claude and return the response.

          Parameters:
              system_prompt (str): System-level instructions for the model.
              user_prompt (str): The user-facing prompt with data.
              max_tokens (int): Max response tokens. Default 2000.
              temperature (float): Sampling temperature. Default 0.3 (analytical tasks).

          Output:
              dict with keys:
                  - content (str): The model's text response
                  - tokens_used (int): Total tokens (input + output)
                  - model (str): Model identifier used
          """
          try:
              response = self.client.messages.create(
                  model=self.model,
                  max_tokens=max_tokens,
                  temperature=temperature,
                  system=system_prompt,
                  messages=[{'role': 'user', 'content': user_prompt}],
              )
              return {
                  'content': response.content[0].text,
                  'tokens_used': response.usage.input_tokens + response.usage.output_tokens,
                  'model': self.model,
              }
          except anthropic.APIError as e:
              logger.error(f'Anthropic API error: {e}')
              raise
          except Exception as e:
              logger.error(f'LLM client error: {e}')
              raise


  # Singleton — instantiated lazily to avoid import-time API key requirement
  _llm_client: LLMClient | None = None


  def get_llm_client() -> LLMClient:
      """Return the singleton LLMClient, creating it if needed."""
      global _llm_client
      if _llm_client is None:
          _llm_client = LLMClient()
      return _llm_client
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd backend && python -m pytest services/test_llm_client.py -v
  ```
  Expected: All tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/services/
  git commit -m "feat: create LLM client abstraction layer"
  ```

---

### Task 3: Create Expense Analyzer Service

**Files:**
- Create: `backend/services/expense_analyzer.py`

- [ ] **Step 1: Write the tests**

  Create `backend/services/test_expense_analyzer.py`:

  ```python
  """
  Tests for ExpenseAnalyzer.

  Tests pure functions only (data formatting, JSON parsing).
  No LLM calls — those are tested via integration.
  No DB interaction.
  """
  import json
  import unittest
  from decimal import Decimal


  class TestExpenseAnalyzerParsing(unittest.TestCase):

      def setUp(self):
          # Import lazily to avoid Django setup issues in unit test context
          from services.expense_analyzer import ExpenseAnalyzer
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
          """_validate_insight drops incomplete insights."""
          insights = [
              {'type': 'trend', 'title': 'Up', 'description': 'More', 'severity': 'info'},
              {'type': 'trend', 'title': 'Missing desc'},  # incomplete
          ]
          valid = self.analyzer._validate_insights(insights)
          self.assertEqual(len(valid), 1)
          self.assertEqual(valid[0]['title'], 'Up')


  if __name__ == '__main__':
      unittest.main()
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd backend && python -m pytest services/test_expense_analyzer.py -v 2>&1 | head -20
  ```
  Expected: `ModuleNotFoundError: No module named 'services.expense_analyzer'`

- [ ] **Step 3: Create expense_analyzer.py**

  Create `backend/services/expense_analyzer.py`:

  ```python
  """
  Expense analyzer service.

  Summary: Fetches expense data from Supabase Postgres, formats it into a
  structured prompt, sends to Claude, parses the JSON response into insight
  objects, and stores the result in analysis_history.

  Dependencies: services.llm_client, Django DB connection
  """
  import json
  import logging
  from datetime import datetime, timezone
  from decimal import Decimal

  from django.db import connection

  from services.llm_client import get_llm_client

  logger = logging.getLogger(__name__)

  # ---------------------------------------------------------------------------
  # Prompt constants — stored as module-level for easy iteration
  # ---------------------------------------------------------------------------

  EXPENSE_ANALYSIS_SYSTEM_PROMPT = """You are a personal finance analyst. You analyze expense data and provide actionable insights.

  RULES:
  - Base ALL insights on the actual data provided. Never fabricate numbers or trends.
  - Be specific — reference actual categories, amounts, and dates from the data.
  - Use the user's currency ({currency}) in all monetary references.
  - Keep insights concise — 2-3 sentences each.
  - Focus on what's actionable, not just observational.
  - If the data is insufficient for meaningful analysis (e.g., less than 2 weeks of data), say so.

  RESPONSE FORMAT:
  You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
  {{
      "insights": [
          {{
              "type": "trend|anomaly|pattern|comparison|saving_opportunity",
              "title": "Short title (max 10 words)",
              "description": "2-3 sentence insight with specific numbers",
              "severity": "info|success|warning|critical"
          }}
      ],
      "summary": "1-2 paragraph overall assessment"
  }}

  Provide 3-7 insights depending on data richness. Prioritize:
  1. Anomalies (unusual spikes or drops)
  2. Trends (consistent increases/decreases over time)
  3. Saving opportunities (categories with potential to cut)
  4. Patterns (recurring behaviors)
  5. Comparisons (month-over-month changes)
  """

  EXPENSE_ANALYSIS_USER_PROMPT = """Analyze my spending data from {start_date} to {end_date}.

  EXPENSE DATA:
  {expense_data}

  MONTHLY TOTALS:
  {monthly_totals}

  CATEGORY BREAKDOWN:
  {category_breakdown}

  Provide your analysis as JSON.
  """

  # ---------------------------------------------------------------------------
  # Fallback insight returned when LLM response cannot be parsed
  # ---------------------------------------------------------------------------

  PARSE_FAILURE_INSIGHT = {
      'type': 'pattern',
      'title': 'Analysis temporarily unavailable',
      'description': (
          'We could not parse the AI response for this request. '
          'Please try again — this is usually a transient issue.'
      ),
      'severity': 'info',
  }


  class ExpenseAnalyzer:
      """Orchestrates expense analysis: data → prompt → LLM → insights."""

      def analyze(
          self,
          user_id: str,
          start_date: str,
          end_date: str,
          currency: str = 'PHP',
      ) -> dict:
          """
          Run expense analysis for the given date range.

          Parameters:
              user_id (str): UUID of the authenticated user.
              start_date (str): ISO date string 'YYYY-MM-DD'.
              end_date (str): ISO date string 'YYYY-MM-DD'.
              currency (str): ISO 4217 currency code. Default 'PHP'.

          Output:
              dict with keys:
                  - insights (list): Parsed insight objects
                  - summary (str): Overall assessment text
                  - tokens_used (int): LLM token consumption
                  - model_used (str): Model identifier
                  - history_id (str): UUID of the stored analysis_history record
          """
          expenses = self._fetch_expenses(user_id, start_date, end_date)
          monthly_totals = self._compute_monthly_totals(expenses)
          category_breakdown = self._compute_category_breakdown(expenses)

          system = EXPENSE_ANALYSIS_SYSTEM_PROMPT.format(currency=currency)
          user_prompt = EXPENSE_ANALYSIS_USER_PROMPT.format(
              start_date=start_date,
              end_date=end_date,
              expense_data=self._format_expense_table(expenses),
              monthly_totals=self._format_monthly_totals(monthly_totals),
              category_breakdown=self._format_category_breakdown(category_breakdown),
          )

          llm = get_llm_client()
          llm_result = llm.complete(system_prompt=system, user_prompt=user_prompt)

          parsed = self._parse_llm_response(llm_result['content'])

          history_id = self._store_result(
              user_id=user_id,
              analysis_type='expense_analysis',
              input_summary={'start_date': start_date, 'end_date': end_date, 'expense_count': len(expenses)},
              result=parsed,
              model_used=llm_result['model'],
              tokens_used=llm_result['tokens_used'],
          )

          return {
              'insights': parsed.get('insights', []),
              'summary': parsed.get('summary', ''),
              'tokens_used': llm_result['tokens_used'],
              'model_used': llm_result['model'],
              'history_id': history_id,
          }

      # ------------------------------------------------------------------
      # Data fetching
      # ------------------------------------------------------------------

      def _fetch_expenses(self, user_id: str, start_date: str, end_date: str) -> list[dict]:
          with connection.cursor() as cursor:
              cursor.execute(
                  """
                  SELECT
                      e.expense_date,
                      c.name AS category_name,
                      e.amount,
                      e.description
                  FROM expenses e
                  JOIN categories c ON c.id = e.category_id
                  WHERE e.user_id = %s
                    AND e.expense_date >= %s
                    AND e.expense_date <= %s
                  ORDER BY e.expense_date DESC
                  """,
                  [user_id, start_date, end_date],
              )
              columns = [col[0] for col in cursor.description]
              return [dict(zip(columns, row)) for row in cursor.fetchall()]

      # ------------------------------------------------------------------
      # Data aggregation
      # ------------------------------------------------------------------

      def _compute_monthly_totals(self, expenses: list[dict]) -> dict:
          totals: dict[str, Decimal] = {}
          for e in expenses:
              month = str(e['expense_date'])[:7]  # 'YYYY-MM'
              totals[month] = totals.get(month, Decimal('0')) + Decimal(str(e['amount']))
          return dict(sorted(totals.items()))

      def _compute_category_breakdown(self, expenses: list[dict]) -> dict:
          totals: dict[str, Decimal] = {}
          for e in expenses:
              cat = e['category_name']
              totals[cat] = totals.get(cat, Decimal('0')) + Decimal(str(e['amount']))
          return dict(sorted(totals.items(), key=lambda x: x[1], reverse=True))

      # ------------------------------------------------------------------
      # Prompt formatting
      # ------------------------------------------------------------------

      def _format_expense_table(self, expenses: list[dict]) -> str:
          if not expenses:
              return '(no expenses in this date range)'
          header = 'Date       | Category        | Amount     | Description'
          separator = '-' * 60
          rows = [
              f"{str(e['expense_date'])[:10]} | {e['category_name'][:15]:<15} | "
              f"{float(e['amount']):>10.2f} | {e['description']}"
              for e in expenses[:100]  # cap to avoid token overflow
          ]
          if len(expenses) > 100:
              rows.append(f'... and {len(expenses) - 100} more expenses')
          return '\n'.join([header, separator] + rows)

      def _format_monthly_totals(self, totals: dict) -> str:
          if not totals:
              return '(no data)'
          return '\n'.join(f'{month}: {float(total):,.2f}' for month, total in totals.items())

      def _format_category_breakdown(self, breakdown: dict) -> str:
          if not breakdown:
              return '(no data)'
          return '\n'.join(
              f'{cat}: {float(amt):,.2f}' for cat, amt in breakdown.items()
          )

      # ------------------------------------------------------------------
      # Response parsing
      # ------------------------------------------------------------------

      def _parse_llm_response(self, content: str) -> dict:
          """
          Parse JSON from LLM response.

          Handles markdown fences. Returns fallback insight on failure.
          """
          text = content.strip()

          # Strip markdown code fences
          if text.startswith('```'):
              lines = text.split('\n')
              # Remove first and last fence lines
              inner = '\n'.join(lines[1:-1]) if lines[-1].strip() == '```' else '\n'.join(lines[1:])
              text = inner.strip()

          try:
              data = json.loads(text)
              insights = self._validate_insights(data.get('insights', []))
              return {
                  'insights': insights,
                  'summary': data.get('summary', ''),
              }
          except (json.JSONDecodeError, ValueError) as e:
              logger.error(f'Failed to parse LLM response: {e}. Raw: {content[:200]}')
              return {
                  'insights': [PARSE_FAILURE_INSIGHT],
                  'summary': '',
              }

      def _validate_insights(self, insights: list) -> list:
          """Drop insights missing required fields."""
          required = {'type', 'title', 'description', 'severity'}
          return [i for i in insights if isinstance(i, dict) and required.issubset(i.keys())]

      # ------------------------------------------------------------------
      # Persistence
      # ------------------------------------------------------------------

      def _store_result(
          self,
          user_id: str,
          analysis_type: str,
          input_summary: dict,
          result: dict,
          model_used: str,
          tokens_used: int,
      ) -> str:
          import uuid
          from apps.analysis.models import AnalysisHistory

          record = AnalysisHistory.objects.create(
              id=uuid.uuid4(),
              user_id=user_id,
              analysis_type=analysis_type,
              input_summary=input_summary,
              result=result,
              model_used=model_used,
              tokens_used=tokens_used,
              created_at=datetime.now(timezone.utc),
          )
          return str(record.id)
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd backend && python manage.py test services.test_expense_analyzer --verbosity=2
  ```
  Or with pytest:
  ```bash
  cd backend && python -m pytest services/test_expense_analyzer.py -v
  ```
  Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/services/expense_analyzer.py backend/services/test_expense_analyzer.py
  git commit -m "feat: create expense analyzer service with prompt constants and JSON parsing"
  ```

---

### Task 4: Create Budget Advisor Service

**Files:**
- Create: `backend/services/budget_advisor.py`

- [ ] **Step 1: Write tests**

  Create `backend/services/test_budget_advisor.py`:

  ```python
  """
  Tests for BudgetAdvisor.

  Tests pure functions: JSON parsing, recommendation validation, journal formatting.
  No LLM calls. No DB interaction.
  """
  import json
  import unittest


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
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd backend && python -m pytest services/test_budget_advisor.py -v 2>&1 | head -20
  ```
  Expected: `ModuleNotFoundError: No module named 'services.budget_advisor'`

- [ ] **Step 3: Create budget_advisor.py**

  Create `backend/services/budget_advisor.py`:

  ```python
  """
  Budget advisor service.

  Summary: Fetches expense data, budget goals, and journal entries for a given
  month, formats them into a structured prompt, sends to Claude, parses the
  JSON response into recommendation objects, and stores the result in
  analysis_history.

  Dependencies: services.llm_client, Django DB connection
  """
  import json
  import logging
  from datetime import datetime, timezone

  from django.db import connection

  from services.llm_client import get_llm_client

  logger = logging.getLogger(__name__)

  # ---------------------------------------------------------------------------
  # Prompt constants
  # ---------------------------------------------------------------------------

  BUDGET_RECOMMENDATION_SYSTEM_PROMPT = """You are a personal budget advisor. You analyze spending patterns, current budget goals, and personal journal context to provide realistic budget adjustment recommendations.

  RULES:
  - Recommendations must be grounded in the actual data provided.
  - Reference specific categories and amounts.
  - Consider the user's journal entries for context about WHY they spend in certain ways.
  - Be realistic — don't suggest cutting categories to zero unless the user has indicated they want to.
  - Explain the reasoning behind each recommendation.
  - Use the user's currency ({currency}) in all monetary references.
  - If the user is generally on track, say so — don't force recommendations.

  RESPONSE FORMAT:
  You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
  {{
      "recommendations": [
          {{
              "category": "Category name",
              "current_goal": 15000.00,
              "suggested_goal": 12000.00,
              "reasoning": "Specific reasoning referencing data and journal context",
              "confidence": "high|medium|low",
              "impact": "Human-readable impact statement"
          }}
      ],
      "overall_advice": "1-2 paragraph overall budget advice"
  }}

  Provide 2-5 recommendations. Only include categories where you have a meaningful suggestion.
  """

  BUDGET_RECOMMENDATION_USER_PROMPT = """Review my budget and spending for {month}.

  CURRENT BUDGET GOALS:
  {budget_goals}

  ACTUAL SPENDING THIS MONTH:
  {spending_summary}

  SPENDING TRENDS (last 3 months):
  {spending_trends}

  RECENT JOURNAL ENTRIES (for context):
  {journal_entries}

  Provide your budget recommendations as JSON.
  """

  PARSE_FAILURE_ADVICE = (
      'We could not parse the AI response for this request. '
      'Please try again — this is usually a transient issue.'
  )


  class BudgetAdvisor:
      """Orchestrates budget recommendations: data → prompt → LLM → recommendations."""

      def recommend(
          self,
          user_id: str,
          month: str,
          currency: str = 'PHP',
      ) -> dict:
          """
          Generate budget recommendations for the given month.

          Parameters:
              user_id (str): UUID of the authenticated user.
              month (str): Month in 'YYYY-MM' format.
              currency (str): ISO 4217 currency code. Default 'PHP'.

          Output:
              dict with keys:
                  - recommendations (list): Parsed recommendation objects
                  - overall_advice (str): Overall budget advice text
                  - tokens_used (int): LLM token consumption
                  - model_used (str): Model identifier
                  - history_id (str): UUID of the stored analysis_history record
          """
          budget_goals = self._fetch_budget_goals(user_id, month)
          spending_summary = self._fetch_spending_for_month(user_id, month)
          spending_trends = self._fetch_spending_trends(user_id, month)
          journal_entries = self._fetch_journal_entries(user_id, month)

          system = BUDGET_RECOMMENDATION_SYSTEM_PROMPT.format(currency=currency)
          user_prompt = BUDGET_RECOMMENDATION_USER_PROMPT.format(
              month=month,
              budget_goals=self._format_budget_goals(budget_goals),
              spending_summary=self._format_spending_summary(spending_summary),
              spending_trends=self._format_spending_trends(spending_trends),
              journal_entries=self._format_journal_entries(journal_entries),
          )

          llm = get_llm_client()
          llm_result = llm.complete(system_prompt=system, user_prompt=user_prompt)

          parsed = self._parse_llm_response(llm_result['content'])

          history_id = self._store_result(
              user_id=user_id,
              input_summary={'month': month, 'goal_count': len(budget_goals)},
              result=parsed,
              model_used=llm_result['model'],
              tokens_used=llm_result['tokens_used'],
          )

          return {
              'recommendations': parsed.get('recommendations', []),
              'overall_advice': parsed.get('overall_advice', ''),
              'tokens_used': llm_result['tokens_used'],
              'model_used': llm_result['model'],
              'history_id': history_id,
          }

      # ------------------------------------------------------------------
      # Data fetching
      # ------------------------------------------------------------------

      def _fetch_budget_goals(self, user_id: str, month: str) -> list[dict]:
          month_start = f'{month}-01'
          with connection.cursor() as cursor:
              cursor.execute(
                  """
                  SELECT c.name AS category_name, bg.amount AS goal_amount
                  FROM budget_goals bg
                  JOIN categories c ON c.id = bg.category_id
                  WHERE bg.user_id = %s AND bg.month = %s
                  ORDER BY bg.amount DESC
                  """,
                  [user_id, month_start],
              )
              columns = [col[0] for col in cursor.description]
              return [dict(zip(columns, row)) for row in cursor.fetchall()]

      def _fetch_spending_for_month(self, user_id: str, month: str) -> list[dict]:
          start_date = f'{month}-01'
          # Compute end of month
          year, m = int(month[:4]), int(month[5:7])
          if m == 12:
              end_date = f'{year + 1}-01-01'
          else:
              end_date = f'{year}-{m + 1:02d}-01'

          with connection.cursor() as cursor:
              cursor.execute(
                  """
                  SELECT c.name AS category_name, COALESCE(SUM(e.amount), 0) AS spent
                  FROM categories c
                  LEFT JOIN expenses e
                      ON e.category_id = c.id
                      AND e.user_id = %s
                      AND e.expense_date >= %s
                      AND e.expense_date < %s
                  WHERE c.is_default = true OR c.user_id = %s
                  GROUP BY c.name
                  ORDER BY spent DESC
                  """,
                  [user_id, start_date, end_date, user_id],
              )
              columns = [col[0] for col in cursor.description]
              return [dict(zip(columns, row)) for row in cursor.fetchall()]

      def _fetch_spending_trends(self, user_id: str, month: str) -> list[dict]:
          """Fetch spending totals for the 3 months preceding the given month."""
          year, m = int(month[:4]), int(month[5:7])
          months = []
          for i in range(1, 4):
              pm = m - i
              py = year
              while pm <= 0:
                  pm += 12
                  py -= 1
              months.append(f'{py}-{pm:02d}')

          rows = []
          for past_month in months:
              start = f'{past_month}-01'
              py, pm_int = int(past_month[:4]), int(past_month[5:7])
              if pm_int == 12:
                  end = f'{py + 1}-01-01'
              else:
                  end = f'{py}-{pm_int + 1:02d}-01'

              with connection.cursor() as cursor:
                  cursor.execute(
                      """
                      SELECT %s AS month, COALESCE(SUM(amount), 0) AS total
                      FROM expenses
                      WHERE user_id = %s AND expense_date >= %s AND expense_date < %s
                      """,
                      [past_month, user_id, start, end],
                  )
                  row = cursor.fetchone()
                  if row:
                      rows.append({'month': row[0], 'total': float(row[1])})
          return rows

      def _fetch_journal_entries(self, user_id: str, month: str) -> list[dict]:
          """Fetch the last 10 journal entries from the past 3 months."""
          year, m = int(month[:4]), int(month[5:7])
          pm = m - 3
          py = year
          while pm <= 0:
              pm += 12
              py -= 1
          three_months_ago = f'{py}-{pm:02d}-01'

          with connection.cursor() as cursor:
              cursor.execute(
                  """
                  SELECT entry_date, title, tags, content
                  FROM journal_entries
                  WHERE user_id = %s AND entry_date >= %s
                  ORDER BY entry_date DESC
                  LIMIT 10
                  """,
                  [user_id, three_months_ago],
              )
              columns = [col[0] for col in cursor.description]
              return [dict(zip(columns, row)) for row in cursor.fetchall()]

      # ------------------------------------------------------------------
      # Prompt formatting
      # ------------------------------------------------------------------

      def _format_budget_goals(self, goals: list[dict]) -> str:
          if not goals:
              return '(no budget goals set for this month)'
          return '\n'.join(
              f"{g['category_name']}: {float(g['goal_amount']):,.2f}" for g in goals
          )

      def _format_spending_summary(self, spending: list[dict]) -> str:
          if not spending:
              return '(no spending data)'
          lines = [
              f"{s['category_name']}: {float(s['spent']):,.2f}"
              for s in spending
              if float(s['spent']) > 0
          ]
          return '\n'.join(lines) if lines else '(no spending recorded)'

      def _format_spending_trends(self, trends: list[dict]) -> str:
          if not trends:
              return '(no trend data)'
          return '\n'.join(f"{t['month']}: {t['total']:,.2f}" for t in trends)

      def _format_journal_entries(self, entries: list[dict]) -> str:
          if not entries:
              return '(no journal entries in this period)'
          parts = []
          for e in entries:
              tags = ', '.join(e['tags']) if e.get('tags') else 'none'
              parts.append(
                  f"[{e['entry_date']}] \"{e['title']}\" — Tags: {tags}\n{e['content']}"
              )
          return '\n\n'.join(parts)

      # ------------------------------------------------------------------
      # Response parsing
      # ------------------------------------------------------------------

      def _parse_llm_response(self, content: str) -> dict:
          text = content.strip()
          if text.startswith('```'):
              lines = text.split('\n')
              inner = '\n'.join(lines[1:-1]) if lines[-1].strip() == '```' else '\n'.join(lines[1:])
              text = inner.strip()

          try:
              data = json.loads(text)
              recs = self._validate_recommendations(data.get('recommendations', []))
              return {
                  'recommendations': recs,
                  'overall_advice': data.get('overall_advice', ''),
              }
          except (json.JSONDecodeError, ValueError) as e:
              logger.error(f'Failed to parse LLM response: {e}. Raw: {content[:200]}')
              return {
                  'recommendations': [],
                  'overall_advice': PARSE_FAILURE_ADVICE,
              }

      def _validate_recommendations(self, recs: list) -> list:
          required = {'category', 'current_goal', 'suggested_goal', 'reasoning', 'confidence', 'impact'}
          return [r for r in recs if isinstance(r, dict) and required.issubset(r.keys())]

      # ------------------------------------------------------------------
      # Persistence
      # ------------------------------------------------------------------

      def _store_result(
          self,
          user_id: str,
          input_summary: dict,
          result: dict,
          model_used: str,
          tokens_used: int,
      ) -> str:
          import uuid
          from apps.analysis.models import AnalysisHistory

          record = AnalysisHistory.objects.create(
              id=uuid.uuid4(),
              user_id=user_id,
              analysis_type='budget_recommendation',
              input_summary=input_summary,
              result=result,
              model_used=model_used,
              tokens_used=tokens_used,
              created_at=datetime.now(timezone.utc),
          )
          return str(record.id)
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd backend && python -m pytest services/test_budget_advisor.py -v
  ```
  Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/services/budget_advisor.py backend/services/test_budget_advisor.py
  git commit -m "feat: create budget advisor service with prompt constants and JSON parsing"
  ```

---

## Chunk 2: Django API Endpoints

### Task 5: Implement Analysis Views + Tests

**Files:**
- Modify: `backend/apps/analysis/views.py`
- Modify: `backend/apps/analysis/tests.py`

- [ ] **Step 1: Write the tests**

  Replace the placeholder `backend/apps/analysis/tests.py`:

  ```python
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
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd backend && python manage.py test apps.analysis.tests --verbosity=2 2>&1 | tail -20
  ```
  Expected: Tests fail because views are empty / raise `AttributeError`

- [ ] **Step 3: Implement the views**

  Replace `backend/apps/analysis/views.py`:

  ```python
  """
  Analysis API views.

  Summary: Exposes three endpoints that trigger AI analysis of expense data and
  budget goals, and return the results. All LLM calls are orchestrated by the
  service layer.

  Endpoints:
      POST /api/analysis/expenses        → analyze_expenses
      POST /api/analysis/recommendations → budget_recommendations
      GET  /api/analysis/history         → analysis_history_list
  """
  import logging
  from datetime import datetime

  from rest_framework.decorators import api_view
  from rest_framework.response import Response

  from apps.analysis.models import AnalysisHistory

  logger = logging.getLogger(__name__)


  @api_view(['POST'])
  def analyze_expenses(request):
      """
      POST /api/analysis/expenses
      Body: { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }

      Triggers AI analysis of expenses in the given date range.
      Returns structured insights and stores in analysis_history.

      Output:
          {
              "insights": [...],
              "summary": "...",
              "tokens_used": 1234,
              "model_used": "claude-sonnet-4-20250514",
              "history_id": "uuid"
          }
      """
      if not hasattr(request, 'user_id'):
          return Response({'error': 'Authentication required'}, status=401)

      user_id = request.user_id
      start_date = request.data.get('start_date')
      end_date = request.data.get('end_date')

      if not start_date:
          return Response({'error': 'start_date is required'}, status=400)
      if not end_date:
          return Response({'error': 'end_date is required'}, status=400)

      try:
          start_dt = datetime.strptime(start_date, '%Y-%m-%d')
          end_dt = datetime.strptime(end_date, '%Y-%m-%d')
      except ValueError:
          return Response({'error': 'Dates must be in YYYY-MM-DD format'}, status=400)

      if end_dt < start_dt:
          return Response({'error': 'end_date must be on or after start_date'}, status=400)

      # Fetch user's currency preference
      currency = _get_user_currency(user_id)

      try:
          from services.expense_analyzer import ExpenseAnalyzer
          result = ExpenseAnalyzer().analyze(
              user_id=user_id,
              start_date=start_date,
              end_date=end_date,
              currency=currency,
          )
          return Response(result)
      except Exception as e:
          logger.error(f'Expense analysis failed for user {user_id}: {e}')
          return Response(
              {'error': 'Analysis failed. Please try again.'},
              status=503,
          )


  @api_view(['POST'])
  def budget_recommendations(request):
      """
      POST /api/analysis/recommendations
      Body: { "month": "YYYY-MM" }

      Triggers AI-powered budget recommendations for the given month.
      Returns structured recommendations and stores in analysis_history.

      Output:
          {
              "recommendations": [...],
              "overall_advice": "...",
              "tokens_used": 1234,
              "model_used": "claude-sonnet-4-20250514",
              "history_id": "uuid"
          }
      """
      if not hasattr(request, 'user_id'):
          return Response({'error': 'Authentication required'}, status=401)

      user_id = request.user_id
      month = request.data.get('month')

      if not month:
          return Response({'error': 'month is required'}, status=400)

      try:
          datetime.strptime(month, '%Y-%m')
      except ValueError:
          return Response({'error': 'month must be in YYYY-MM format'}, status=400)

      currency = _get_user_currency(user_id)

      try:
          from services.budget_advisor import BudgetAdvisor
          result = BudgetAdvisor().recommend(
              user_id=user_id,
              month=month,
              currency=currency,
          )
          return Response(result)
      except Exception as e:
          logger.error(f'Budget recommendations failed for user {user_id}: {e}')
          return Response(
              {'error': 'Recommendations failed. Please try again.'},
              status=503,
          )


  @api_view(['GET'])
  def analysis_history_list(request):
      """
      GET /api/analysis/history?type=expense_analysis&limit=10

      Returns past analysis results for the authenticated user.

      Query params:
          type (str, optional): Filter by analysis_type
          limit (int, optional): Max records to return. Default 20.

      Output:
          {
              "history": [
                  {
                      "id": "uuid",
                      "analysis_type": "expense_analysis",
                      "input_summary": {...},
                      "result": {...},
                      "model_used": "...",
                      "tokens_used": 1234,
                      "created_at": "ISO 8601"
                  },
                  ...
              ]
          }
      """
      if not hasattr(request, 'user_id'):
          return Response({'error': 'Authentication required'}, status=401)

      user_id = request.user_id
      analysis_type = request.query_params.get('type')
      try:
          limit = int(request.query_params.get('limit', 20))
          limit = min(limit, 100)  # cap at 100
      except ValueError:
          limit = 20

      qs = AnalysisHistory.objects.filter(user_id=user_id).order_by('-created_at')
      if analysis_type:
          qs = qs.filter(analysis_type=analysis_type)
      qs = qs[:limit]

      history = [
          {
              'id': str(record.id),
              'analysis_type': record.analysis_type,
              'input_summary': record.input_summary,
              'result': record.result,
              'model_used': record.model_used,
              'tokens_used': record.tokens_used,
              'created_at': record.created_at.isoformat() if record.created_at else None,
          }
          for record in qs
      ]

      return Response({'history': history})


  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  def _get_user_currency(user_id: str) -> str:
      """Fetch the user's currency preference from user_profiles. Defaults to PHP."""
      from django.db import connection
      with connection.cursor() as cursor:
          cursor.execute(
              'SELECT currency FROM user_profiles WHERE id = %s',
              [user_id],
          )
          row = cursor.fetchone()
      return row[0] if row and row[0] else 'PHP'
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd backend && python manage.py test apps.analysis.tests --verbosity=2
  ```
  Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/apps/analysis/views.py backend/apps/analysis/tests.py
  git commit -m "feat: implement analysis views with input validation and service delegation"
  ```

---

### Task 6: Configure URL Routing

**Files:**
- Create: `backend/apps/analysis/urls.py`
- Modify: `backend/core/urls.py`

- [ ] **Step 1: Create analysis/urls.py**

  Create `backend/apps/analysis/urls.py`:

  ```python
  from django.urls import path

  from . import views

  urlpatterns = [
      path('expenses', views.analyze_expenses),
      path('recommendations', views.budget_recommendations),
      path('history', views.analysis_history_list),
  ]
  ```

- [ ] **Step 2: Wire into core/urls.py**

  Replace the content of `backend/core/urls.py`:

  ```python
  from django.urls import include, path

  urlpatterns = [
      path('api/budgets/', include('apps.budgets.urls')),
      path('api/expenses/', include('apps.expenses.urls')),
      path('api/analysis/', include('apps.analysis.urls')),
  ]
  ```

- [ ] **Step 3: Smoke-test URL resolution**

  ```bash
  cd backend && python manage.py shell -c "
  from django.urls import reverse, resolve
  print(resolve('/api/analysis/expenses'))
  print(resolve('/api/analysis/recommendations'))
  print(resolve('/api/analysis/history'))
  "
  ```
  Expected: Each line prints the resolved view function without error.

- [ ] **Step 4: Start dev server and verify endpoints respond**

  ```bash
  cd backend && python manage.py runserver &
  sleep 2
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/analysis/history
  ```
  Expected: `401` (no auth header — correct!)

- [ ] **Step 5: Commit**

  ```bash
  git add backend/apps/analysis/urls.py backend/core/urls.py
  git commit -m "feat: add analysis URL conf and wire into core URL router"
  ```

---

## Chunk 3: Frontend

### Task 7: Add TypeScript Types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add analysis-specific types**

  Append to the bottom of `frontend/src/types/index.ts`:

  ```typescript
  // ---------------------------------------------------------------------------
  // Analysis API types (Phase 3)
  // ---------------------------------------------------------------------------

  export type InsightType = 'trend' | 'anomaly' | 'pattern' | 'comparison' | 'saving_opportunity';
  export type InsightSeverity = 'info' | 'success' | 'warning' | 'critical';
  export type RecommendationConfidence = 'high' | 'medium' | 'low';

  export interface Insight {
    type: InsightType;
    title: string;
    description: string;
    severity: InsightSeverity;
  }

  export interface Recommendation {
    category: string;
    current_goal: number;
    suggested_goal: number;
    reasoning: string;
    confidence: RecommendationConfidence;
    impact: string;
  }

  export interface ExpenseAnalysisResponse {
    insights: Insight[];
    summary: string;
    tokens_used: number;
    model_used: string;
    history_id: string;
  }

  export interface BudgetRecommendationsResponse {
    recommendations: Recommendation[];
    overall_advice: string;
    tokens_used: number;
    model_used: string;
    history_id: string;
  }

  export interface AnalysisHistoryResponse {
    history: AnalysisHistory[];
  }

  export interface TokenUsageSummary {
    total_tokens: number;
    analysis_count: number;
    estimated_cost_usd: number;
  }
  ```

- [ ] **Step 2: Type-check the file**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -20
  ```
  Expected: No errors from types/index.ts

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/types/index.ts
  git commit -m "feat: add TypeScript types for analysis API responses"
  ```

---

### Task 8: Build AnalysisPage

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.tsx`

- [ ] **Step 1: Implement the full AnalysisPage**

  Replace `frontend/src/pages/AnalysisPage.tsx`:

  ```tsx
  import { useState } from 'react';
  import {
    AlertTriangle,
    BarChart2,
    PiggyBank,
    Repeat,
    TrendingUp,
    Loader2,
    ChevronDown,
    ChevronUp,
    RefreshCw,
  } from 'lucide-react';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { api } from '@/lib/api';
  import type {
    ExpenseAnalysisResponse,
    BudgetRecommendationsResponse,
    AnalysisHistoryResponse,
    Insight,
    Recommendation,
    InsightType,
    InsightSeverity,
    AnalysisHistory,
  } from '@/types';

  // ---------------------------------------------------------------------------
  // Icon and colour maps
  // ---------------------------------------------------------------------------

  const INSIGHT_ICONS: Record<InsightType, typeof TrendingUp> = {
    trend: TrendingUp,
    anomaly: AlertTriangle,
    pattern: Repeat,
    comparison: BarChart2,
    saving_opportunity: PiggyBank,
  };

  const SEVERITY_BADGE: Record<InsightSeverity, string> = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    critical: 'bg-red-100 text-red-800',
  };

  // ---------------------------------------------------------------------------
  // Sub-components
  // ---------------------------------------------------------------------------

  function InsightCard({ insight }: { insight: Insight }) {
    const Icon = INSIGHT_ICONS[insight.type] ?? TrendingUp;
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-muted p-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-semibold text-sm">{insight.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[insight.severity]}`}
                >
                  {insight.severity}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{insight.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function RecommendationCard({ rec }: { rec: Recommendation }) {
    const isSaving = rec.suggested_goal < rec.current_goal;
    const diff = Math.abs(rec.suggested_goal - rec.current_goal).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
    });
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{rec.category}</p>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isSaving ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isSaving ? `Save ${diff}` : `Increase ${diff}`}
                </span>
                <Badge variant="outline" className="text-xs">
                  {rec.confidence} confidence
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Current:{' '}
                <strong>
                  {rec.current_goal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </strong>
              </span>
              <span>→</span>
              <span>
                Suggested:{' '}
                <strong
                  className={isSaving ? 'text-green-700' : 'text-amber-700'}
                >
                  {rec.suggested_goal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </strong>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
            <p className="text-xs font-medium text-muted-foreground italic">{rec.impact}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function SkeletonCard() {
    return (
      <div className="rounded-lg border bg-card p-5 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  function HistoryItem({ record }: { record: AnalysisHistory }) {
    const [expanded, setExpanded] = useState(false);
    const isExpense = record.analysis_type === 'expense_analysis';
    const result = record.result as Record<string, unknown>;

    return (
      <Card>
        <CardHeader
          className="cursor-pointer pb-3"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isExpense ? 'default' : 'secondary'}>
                {isExpense ? 'Expense Analysis' : 'Budget Recommendations'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {record.created_at
                  ? new Date(record.created_at).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {record.tokens_used?.toLocaleString() ?? '—'} tokens · {record.model_used}
          </p>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0">
            {isExpense ? (
              <>
                {(result.insights as Insight[] | undefined)?.map((ins, i) => (
                  <InsightCard key={i} insight={ins} />
                ))}
                {result.summary && (
                  <p className="mt-4 text-sm text-muted-foreground">{result.summary as string}</p>
                )}
              </>
            ) : (
              <>
                {(result.recommendations as Recommendation[] | undefined)?.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
                {result.overall_advice && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {result.overall_advice as string}
                  </p>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Tab views
  // ---------------------------------------------------------------------------

  function ExpenseAnalysisTab() {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.slice(0, 8) + '01';

    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ExpenseAnalysisResponse | null>(null);

    const handleAnalyze = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.post<ExpenseAnalysisResponse>('/analysis/expenses', {
          start_date: startDate,
          end_date: endDate,
        });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-4">
        {/* Controls */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  max={today}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="mt-4 w-full sm:w-auto"
              onClick={handleAnalyze}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                'Analyze My Spending'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              className="ml-2 underline"
              onClick={handleAnalyze}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
            {result.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overall Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {result.summary}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {result.tokens_used.toLocaleString()} tokens · {result.model_used}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  function BudgetRecommendationsTab() {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [month, setMonth] = useState(thisMonth);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BudgetRecommendationsResponse | null>(null);

    const handleRecommend = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.post<BudgetRecommendationsResponse>('/analysis/recommendations', {
          month,
        });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Recommendations failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-4">
        {/* Controls */}
        <Card>
          <CardContent className="pt-5">
            <div className="space-y-1 max-w-xs">
              <Label htmlFor="month-picker">Month</Label>
              <Input
                id="month-picker"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <Button
              className="mt-4 w-full sm:w-auto"
              onClick={handleRecommend}
              disabled={loading || !month}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Recommendations…
                </>
              ) : (
                'Get Recommendations'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              className="ml-2 underline"
              onClick={handleRecommend}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {result.recommendations.length === 0 && (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground">
                    No specific recommendations for this month — you appear to be on track!
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))}
            </div>
            {result.overall_advice && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overall Budget Advice</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {result.overall_advice}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {result.tokens_used.toLocaleString()} tokens · {result.model_used}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  function HistoryTab() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<AnalysisHistory[] | null>(null);

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<AnalysisHistoryResponse>('/analysis/history?limit=20');
        setHistory(data.history);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history.');
      } finally {
        setLoading(false);
      }
    };

    // Load on first render
    if (history === null && !loading && !error) {
      loadHistory();
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Past analyses (most recent first)</p>
          <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {history && !loading && history.length === 0 && (
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">
                No analysis history yet. Run your first analysis above.
              </p>
            </CardContent>
          </Card>
        )}

        {history && !loading && history.map((record) => (
          <HistoryItem key={record.id} record={record} />
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Page root
  // ---------------------------------------------------------------------------

  export default function AnalysisPage() {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">AI Analysis</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered insights into your spending patterns and budget health.
          </p>
        </div>

        <Tabs defaultValue="expenses">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses">Expense Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Budget Recs</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4">
            <ExpenseAnalysisTab />
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <BudgetRecommendationsTab />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: No errors (fix any TypeScript errors before continuing)

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/AnalysisPage.tsx
  git commit -m "feat: build AnalysisPage with expense analysis, recommendations, and history tabs"
  ```

---

### Task 9: Add AI Usage to Settings Page

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `backend/apps/analysis/views.py` (add token_usage_summary endpoint)
- Modify: `backend/apps/analysis/urls.py` (add route)

- [ ] **Step 1: Add token_usage_summary view to analysis/views.py**

  Append to `backend/apps/analysis/views.py`:

  ```python
  @api_view(['GET'])
  def token_usage_summary(request):
      """
      GET /api/analysis/token-usage

      Returns AI token usage summary for the current calendar month.

      Output:
          {
              "total_tokens": 12345,
              "analysis_count": 5,
              "estimated_cost_usd": 0.037
          }
      """
      if not hasattr(request, 'user_id'):
          return Response({'error': 'Authentication required'}, status=401)

      user_id = request.user_id
      from django.db.models import Sum, Count
      from django.utils import timezone

      now = timezone.now()
      month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

      agg = (
          AnalysisHistory.objects
          .filter(user_id=user_id, created_at__gte=month_start)
          .aggregate(total_tokens=Sum('tokens_used'), analysis_count=Count('id'))
      )
      total_tokens = agg['total_tokens'] or 0
      analysis_count = agg['analysis_count'] or 0
      # Claude Sonnet: ~$3/1M input + $15/1M output. Using $3/1M as conservative estimate.
      estimated_cost_usd = round((total_tokens / 1_000_000) * 3.0, 4)

      return Response({
          'total_tokens': total_tokens,
          'analysis_count': analysis_count,
          'estimated_cost_usd': estimated_cost_usd,
      })
  ```

- [ ] **Step 2: Add URL for token_usage_summary**

  Update `backend/apps/analysis/urls.py`:

  ```python
  from django.urls import path

  from . import views

  urlpatterns = [
      path('expenses', views.analyze_expenses),
      path('recommendations', views.budget_recommendations),
      path('history', views.analysis_history_list),
      path('token-usage', views.token_usage_summary),
  ]
  ```

- [ ] **Step 3: Read the current SettingsPage before modifying it**

  Read `frontend/src/pages/SettingsPage.tsx` to understand existing structure, then add the AI Usage section. The section should show:
  - Total tokens this month
  - Number of analyses run
  - Estimated cost (USD)

  The pattern to add (adapt to fit the existing page structure):

  ```tsx
  // Add to imports:
  import { api } from '@/lib/api';
  import type { TokenUsageSummary } from '@/types';
  import { useEffect, useState } from 'react';

  // Add this component inside the file:
  function AiUsageSection() {
    const [usage, setUsage] = useState<TokenUsageSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      api.get<TokenUsageSummary>('/analysis/token-usage')
        .then(setUsage)
        .catch(() => setUsage(null))
        .finally(() => setLoading(false));
    }, []);

    return (
      <div className="space-y-2">
        <h3 className="font-semibold">AI Usage (This Month)</h3>
        {loading ? (
          <div className="animate-pulse h-16 rounded-lg bg-muted" />
        ) : usage ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{usage.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Tokens Used</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{usage.analysis_count}</p>
              <p className="text-xs text-muted-foreground">Analyses Run</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">${usage.estimated_cost_usd.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground">Est. Cost (USD)</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No AI usage data available.</p>
        )}
      </div>
    );
  }
  ```

  Add `<AiUsageSection />` in an appropriate location within the existing SettingsPage layout.

- [ ] **Step 4: TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: No errors

- [ ] **Step 5: Commit**

  ```bash
  git add backend/apps/analysis/views.py backend/apps/analysis/urls.py frontend/src/pages/SettingsPage.tsx
  git commit -m "feat: add AI token usage tracking endpoint and Settings page section"
  ```

---

## Final Verification

- [ ] **Backend integration test** — Start the server and run the full API flow with a real auth token:

  ```bash
  cd backend && python manage.py runserver
  ```

  Then from a separate terminal, with a valid JWT from Supabase:
  ```bash
  TOKEN="your-supabase-jwt-here"

  # Expense analysis
  curl -s -X POST http://localhost:8000/api/analysis/expenses \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"start_date": "2026-01-01", "end_date": "2026-03-21"}' | python -m json.tool

  # Budget recommendations
  curl -s -X POST http://localhost:8000/api/analysis/recommendations \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"month": "2026-03"}' | python -m json.tool

  # History
  curl -s http://localhost:8000/api/analysis/history \
    -H "Authorization: Bearer $TOKEN" | python -m json.tool
  ```

  Expected for expenses: `{"insights": [...], "summary": "...", "tokens_used": N, ...}`

- [ ] **Frontend integration** — Start the frontend and manually test each tab:

  ```bash
  cd frontend && npm run dev
  ```

  Verify:
  1. Expense Analysis tab: date pickers render, loading state shows, insight cards appear with icons and severity colors
  2. Budget Recs tab: month picker renders, recommendation cards show current→suggested goal with colored indicator
  3. History tab: loads on mount, past analyses are expandable
  4. Settings page: AI Usage section shows token counts

- [ ] **Acceptance criteria checklist** (from phase-3.md):
  - [ ] `POST /api/analysis/expenses` returns structured insights within 15 seconds
  - [ ] `POST /api/analysis/recommendations` returns structured recommendations
  - [ ] `GET /api/analysis/history` returns past results
  - [ ] Insights reference actual user data (not generic advice)
  - [ ] Journal entries are used as context in budget recommendations
  - [ ] LLM response parsing handles malformed JSON gracefully
  - [ ] All results are stored in `analysis_history` table
  - [ ] Token usage is tracked per analysis
  - [ ] Frontend displays insight cards with correct type icons and severity colors
  - [ ] Frontend displays recommendation cards with current/suggested goal comparison
  - [ ] Loading states shown during AI processing
  - [ ] Error states shown if LLM call fails (with retry option)
  - [ ] Analysis history is viewable and expandable
  - [ ] Settings page shows token usage summary

- [ ] **Final commit**

  ```bash
  git add -A
  git commit -m "feat: complete Phase 3 LLM integration — expense analysis, budget recommendations, history"
  ```

---

*Plan saved: 2026-03-21. Execute using `superpowers:subagent-driven-development`.*
