"""
Summary: Builds a rich context package about a user's financial behavior.
This context is injected into every LLM prompt — analysis, recommendations, and chat.
Pre-computing patterns means the LLM reasons about meaning, not math.

Parameters:
    user_id (str): Authenticated user UUID

Output:
    dict with structured context:
        - profile: user preferences and goals
        - summary: current month totals
        - patterns: behavioral patterns (day-of-week, category distribution, velocity)
        - trends: month-over-month category trends
        - anomalies: detected spending anomalies
        - journal_context: recent journal entries (summarized)
        - budget_status: current budget goal progress

Dependencies: Django ORM / raw SQL, Django cache framework
"""
import calendar
import logging
from datetime import date, timedelta

from django.core.cache import cache
from django.db import connection

logger = logging.getLogger(__name__)

CONTEXT_CACHE_TTL = 300  # 5 minutes


class FinancialContextEngine:

    def build_context(self, user_id: str) -> dict:
        """Build the full financial context for a user. Cached per-user for 5 minutes."""
        cache_key = f'financial_context:{user_id}'
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        context = {
            'profile': self._get_profile(user_id),
            'summary': self._get_current_month_summary(user_id),
            'patterns': self._get_behavioral_patterns(user_id),
            'trends': self._get_category_trends(user_id),
            'anomalies': self._detect_anomalies(user_id),
            'journal_context': self._get_journal_context(user_id),
            'budget_status': self._get_budget_status(user_id),
        }
        cache.set(cache_key, context, timeout=CONTEXT_CACHE_TTL)
        return context

    def invalidate_cache(self, user_id: str) -> None:
        """Invalidate the cached context for a user (call after new expenses are added)."""
        cache.delete(f'financial_context:{user_id}')

    def format_for_prompt(self, context: dict) -> str:
        """Convert the context dict into a formatted string for LLM prompts."""
        profile = context['profile']
        summary = context['summary']
        patterns = context['patterns']
        trends = context['trends']
        anomalies = context['anomalies']
        journal = context['journal_context']
        budget = context['budget_status']

        sections = []

        # Section 1: User profile
        sections.append(f"""USER PROFILE:
- Currency: {profile.get('currency', 'PHP')}
- Monthly budget goal: {profile.get('monthly_budget_goal', 'Not set')}
- Account age: {profile.get('account_age_days', 0)} days
- Total expenses tracked: {profile.get('total_expenses', 0)}""")

        # Section 2: Current month summary
        sections.append(f"""CURRENT MONTH ({summary.get('month', 'N/A')}):
- Total spent: {summary.get('total_spent', 0):,.2f}
- Transaction count: {summary.get('transaction_count', 0)}
- Daily average: {summary.get('daily_average', 0):,.2f}
- Days remaining: {summary.get('days_remaining', 0)}
- Projected month total: {summary.get('projected_total', 0):,.2f}""")

        # Section 3: Behavioral patterns
        if patterns:
            dow_spending = patterns.get('day_of_week', [])
            dow_str = (
                ', '.join([f"{d['day']}: {d['avg']:,.0f}" for d in dow_spending])
                if dow_spending
                else 'Insufficient data'
            )
            sections.append(f"""BEHAVIORAL PATTERNS:
- Average spending by day of week: {dow_str}
- Highest spending day: {patterns.get('peak_day', 'N/A')} (avg {patterns.get('peak_day_avg', 0):,.0f})
- Most frequent category: {patterns.get('top_category', 'N/A')} ({patterns.get('top_category_pct', 0):.0f}% of transactions)
- Spending velocity: {patterns.get('current_velocity', 0):,.0f}/day (vs {patterns.get('prev_velocity', 0):,.0f}/day last month)""")

        # Section 4: Category trends
        if trends:
            trend_lines = []
            for t in trends:
                trend_lines.append(
                    f"- {t['category']}: {t['change_pct']:+.0f}% MoM "
                    f"({t['prev_amount']:,.0f} \u2192 {t['curr_amount']:,.0f})"
                )
            sections.append('CATEGORY TRENDS (month-over-month):\n' + '\n'.join(trend_lines))

        # Section 5: Anomalies
        if anomalies:
            anomaly_lines = []
            for a in anomalies:
                anomaly_lines.append(
                    f"- [{a['date']}] {a['description']}: {a['amount']:,.0f} "
                    f"({a['multiplier']:.1f}x your average for {a['category']})"
                )
            sections.append('ANOMALIES DETECTED:\n' + '\n'.join(anomaly_lines))
        else:
            sections.append('ANOMALIES DETECTED:\nNone — spending patterns are consistent.')

        # Section 6: Journal context
        if journal:
            journal_lines = []
            for j in journal:
                tags_str = f" — Tags: {', '.join(j['tags'])}" if j.get('tags') else ''
                preview = (
                    j['content'][:150] + '...'
                    if len(j.get('content', '')) > 150
                    else j.get('content', '')
                )
                journal_lines.append(
                    f"- [{j['date']}] \"{j['title']}\"{tags_str}\n  {preview}"
                )
            sections.append('RECENT JOURNAL ENTRIES:\n' + '\n'.join(journal_lines))
        else:
            sections.append('RECENT JOURNAL ENTRIES:\nNo recent journal entries.')

        # Section 7: Budget status
        if budget:
            budget_lines = []
            for b in budget:
                pct = (b['spent'] / b['goal'] * 100) if b['goal'] > 0 else 0
                status = 'ON TRACK' if pct < 80 else ('WARNING' if pct < 100 else 'OVER BUDGET')
                budget_lines.append(
                    f"- {b['category']}: {b['spent']:,.0f} / {b['goal']:,.0f} ({pct:.0f}%) [{status}]"
                )
            sections.append('BUDGET STATUS:\n' + '\n'.join(budget_lines))

        return '\n\n'.join(sections)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_profile(self, user_id: str) -> dict:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    up.currency,
                    up.monthly_budget_goal,
                    up.created_at,
                    (SELECT COUNT(*) FROM expenses WHERE user_id = %s) AS total_expenses
                FROM user_profiles up
                WHERE up.id = %s
                """,
                [user_id, user_id],
            )
            row = cursor.fetchone()
            if not row:
                return {}
            return {
                'currency': row[0],
                'monthly_budget_goal': float(row[1]) if row[1] else None,
                'account_age_days': (date.today() - row[2].date()).days if row[2] else 0,
                'total_expenses': row[3],
            }

    def _get_current_month_summary(self, user_id: str) -> dict:
        today = date.today()
        month_start = today.replace(day=1)
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        days_elapsed = today.day

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COALESCE(SUM(amount), 0), COUNT(*)
                FROM expenses
                WHERE user_id = %s AND expense_date >= %s AND expense_date <= %s
                """,
                [user_id, month_start, today],
            )
            row = cursor.fetchone()
            total_spent = float(row[0])
            count = row[1]
            daily_avg = total_spent / max(days_elapsed, 1)

            return {
                'month': today.strftime('%Y-%m'),
                'total_spent': total_spent,
                'transaction_count': count,
                'daily_average': daily_avg,
                'days_remaining': days_in_month - days_elapsed,
                'projected_total': daily_avg * days_in_month,
            }

    def _get_behavioral_patterns(self, user_id: str) -> dict:
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)
        sixty_days_ago = today - timedelta(days=60)

        with connection.cursor() as cursor:
            # Day-of-week average spending
            cursor.execute(
                """
                SELECT TO_CHAR(expense_date, 'Dy') AS dow,
                       AVG(daily_total) AS avg_daily
                FROM (
                    SELECT expense_date, SUM(amount) AS daily_total
                    FROM expenses
                    WHERE user_id = %s AND expense_date >= %s
                    GROUP BY expense_date
                ) sub
                GROUP BY TO_CHAR(expense_date, 'Dy'), EXTRACT(DOW FROM expense_date)
                ORDER BY EXTRACT(DOW FROM expense_date)
                """,
                [user_id, thirty_days_ago],
            )
            dow = [{'day': row[0], 'avg': float(row[1])} for row in cursor.fetchall()]
            peak = max(dow, key=lambda d: d['avg']) if dow else {'day': 'N/A', 'avg': 0}

            # Most frequent category
            cursor.execute(
                """
                SELECT c.name, COUNT(*) AS cnt,
                       COUNT(*) * 100.0 / NULLIF(
                           (SELECT COUNT(*) FROM expenses WHERE user_id = %s AND expense_date >= %s), 0
                       ) AS pct
                FROM expenses e JOIN categories c ON c.id = e.category_id
                WHERE e.user_id = %s AND e.expense_date >= %s
                GROUP BY c.name ORDER BY cnt DESC LIMIT 1
                """,
                [user_id, thirty_days_ago, user_id, thirty_days_ago],
            )
            top_cat = cursor.fetchone()

            # Spending velocity (current vs previous 30 days)
            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN expense_date >= %s THEN amount END), 0)
                        / GREATEST((%s - %s + 1), 1) AS curr_velocity,
                    COALESCE(SUM(CASE WHEN expense_date >= %s AND expense_date < %s THEN amount END), 0)
                        / 30.0 AS prev_velocity
                FROM expenses
                WHERE user_id = %s AND expense_date >= %s
                """,
                [
                    thirty_days_ago,
                    today,
                    thirty_days_ago,
                    sixty_days_ago,
                    thirty_days_ago,
                    user_id,
                    sixty_days_ago,
                ],
            )
            vel = cursor.fetchone()

            return {
                'day_of_week': dow,
                'peak_day': peak['day'],
                'peak_day_avg': peak['avg'],
                'top_category': top_cat[0] if top_cat else 'N/A',
                'top_category_pct': float(top_cat[2]) if top_cat else 0,
                'current_velocity': float(vel[0]) if vel else 0,
                'prev_velocity': float(vel[1]) if vel else 0,
            }

    def _get_category_trends(self, user_id: str) -> list:
        today = date.today()
        curr_start = today.replace(day=1)
        prev_start = (curr_start - timedelta(days=1)).replace(day=1)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    c.name,
                    COALESCE(SUM(CASE WHEN e.expense_date >= %s THEN e.amount END), 0) AS curr,
                    COALESCE(SUM(CASE WHEN e.expense_date >= %s AND e.expense_date < %s THEN e.amount END), 0) AS prev
                FROM categories c
                LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = %s AND e.expense_date >= %s
                WHERE c.is_default = true OR c.user_id = %s
                GROUP BY c.name
                HAVING
                    COALESCE(SUM(CASE WHEN e.expense_date >= %s THEN e.amount END), 0) > 0
                    OR COALESCE(SUM(CASE WHEN e.expense_date >= %s AND e.expense_date < %s THEN e.amount END), 0) > 0
                ORDER BY curr DESC
                """,
                [
                    curr_start,
                    prev_start,
                    curr_start,
                    user_id,
                    prev_start,
                    user_id,
                    curr_start,
                    prev_start,
                    curr_start,
                ],
            )

            trends = []
            for row in cursor.fetchall():
                curr, prev = float(row[1]), float(row[2])
                change = ((curr - prev) / prev * 100) if prev > 0 else (100 if curr > 0 else 0)
                trends.append({
                    'category': row[0],
                    'curr_amount': curr,
                    'prev_amount': prev,
                    'change_pct': change,
                })
            return trends

    def _detect_anomalies(self, user_id: str) -> list:
        """Find expenses that are 2x+ the user's average for that category."""
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH category_avgs AS (
                    SELECT category_id, AVG(amount) AS avg_amount, STDDEV(amount) AS stddev_amount
                    FROM expenses WHERE user_id = %s
                    GROUP BY category_id HAVING COUNT(*) >= 3
                )
                SELECT e.expense_date, e.description, e.amount, c.name,
                       e.amount / ca.avg_amount AS multiplier
                FROM expenses e
                JOIN categories c ON c.id = e.category_id
                JOIN category_avgs ca ON ca.category_id = e.category_id
                WHERE e.user_id = %s
                AND e.expense_date >= (CURRENT_DATE - INTERVAL '30 days')
                AND e.amount > ca.avg_amount * 2
                ORDER BY multiplier DESC
                LIMIT 5
                """,
                [user_id, user_id],
            )

            return [
                {
                    'date': row[0].isoformat(),
                    'description': row[1],
                    'amount': float(row[2]),
                    'category': row[3],
                    'multiplier': float(row[4]),
                }
                for row in cursor.fetchall()
            ]

    def _get_journal_context(self, user_id: str) -> list:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT title, content, tags, entry_date
                FROM journal_entries
                WHERE user_id = %s
                ORDER BY entry_date DESC
                LIMIT 10
                """,
                [user_id],
            )
            return [
                {
                    'title': row[0],
                    'content': row[1],
                    'tags': row[2] or [],
                    'date': row[3].isoformat(),
                }
                for row in cursor.fetchall()
            ]

    def _get_budget_status(self, user_id: str) -> list:
        today = date.today()
        month_start = today.replace(day=1)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.name, bg.amount AS goal,
                       COALESCE(SUM(e.amount), 0) AS spent
                FROM budget_goals bg
                JOIN categories c ON c.id = bg.category_id
                LEFT JOIN expenses e ON e.category_id = bg.category_id
                    AND e.user_id = %s
                    AND e.expense_date >= %s
                    AND e.expense_date <= %s
                WHERE bg.user_id = %s AND bg.month = %s
                GROUP BY c.name, bg.amount
                ORDER BY c.name
                """,
                [user_id, month_start, today, user_id, month_start],
            )

            return [
                {'category': row[0], 'goal': float(row[1]), 'spent': float(row[2])}
                for row in cursor.fetchall()
            ]


# Singleton
financial_context_engine = FinancialContextEngine()
