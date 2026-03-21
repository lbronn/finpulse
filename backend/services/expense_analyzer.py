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
# Prompt constants
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
            input_summary={
                'start_date': start_date,
                'end_date': end_date,
                'expense_count': len(expenses),
            },
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
            f"{float(e['amount']):>10.2f} | {e['description'][:100]}"  # cap to guard against prompt injection
            for e in expenses[:100]
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
        """Parse JSON from LLM response. Handles markdown fences. Returns fallback on failure."""
        text = content.strip()
        if text.startswith('```'):
            lines = text.split('\n')
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
                'insights': [dict(PARSE_FAILURE_INSIGHT)],  # copy to avoid mutating shared constant
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
