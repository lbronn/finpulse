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

BUDGET_RECOMMENDATION_SYSTEM_PROMPT = """You are a personal budget advisor. You interpret pre-computed spending patterns and behavioral context to provide realistic budget adjustment recommendations.

CRITICAL: The patterns, trends, and anomalies below are already computed from the user's actual data. Your job is to INTERPRET them and recommend specific budget adjustments. Do NOT re-derive numbers; use what is provided.

RULES:
- Recommendations must reference specific amounts, categories, and trends from the context.
- Consider journal entries for WHY spending changed — reference them explicitly.
- Be realistic — don't suggest cutting categories to zero unless the user indicated they want to.
- If a category is over budget, explain why based on the data, then suggest an adjustment.
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
            "reasoning": "Specific reasoning referencing patterns, amounts, and journal context",
            "confidence": "high|medium|low",
            "impact": "Human-readable impact statement with specific numbers"
        }}
    ],
    "overall_advice": "1-2 paragraph overall budget advice grounded in the pre-computed patterns"
}}

Provide 2-5 recommendations. Only include categories where you have a meaningful suggestion.
"""

BUDGET_RECOMMENDATION_USER_PROMPT = """Review my budget and provide recommendations based on this pre-computed financial data:

{formatted_context}

Provide your budget recommendations as JSON."""

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
        from services.financial_context import financial_context_engine
        context = financial_context_engine.build_context(user_id)
        formatted = financial_context_engine.format_for_prompt(context)
        goal_count = len(context['budget_status'])

        system = BUDGET_RECOMMENDATION_SYSTEM_PROMPT.replace('{currency}', currency)
        # Use replace() to avoid KeyError if journal content contains literal braces
        user_prompt = BUDGET_RECOMMENDATION_USER_PROMPT.replace('{formatted_context}', formatted)

        llm = get_llm_client()
        llm_result = llm.complete(system_prompt=system, user_prompt=user_prompt)

        parsed = self._parse_llm_response(llm_result['content'])

        history_id = self._store_result(
            user_id=user_id,
            input_summary={'month': month, 'goal_count': goal_count},
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
                f"[{e['entry_date']}] \"{e['title']}\" — Tags: {tags}\n{e['content'][:500]}"  # cap to guard against prompt injection
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
        # Deferred to avoid import-time Django app registry dependency in unit tests
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
