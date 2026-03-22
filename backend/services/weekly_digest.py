"""
Summary: Generates a weekly spending digest using the financial context engine.
Intended to run as a scheduled job every Sunday evening.

Parameters:
    user_id (str): User to generate digest for (or call generate_all_digests for batch)

Output:
    Stores digest in analysis_history with analysis_type='weekly_digest'

Dependencies: financial_context engine, LLM client (Sonnet)
"""
import json
import logging
import uuid

from django.db import connection

from services.financial_context import financial_context_engine
from services.llm_client import get_llm_client

logger = logging.getLogger(__name__)

DIGEST_SYSTEM_PROMPT = """You write concise weekly spending digests. The user opens their finance app and sees this as a summary card — keep it short, scannable, and useful.

FORMAT (respond with valid JSON only):
{{
    "headline": "One-line summary (max 15 words)",
    "body": "2-3 short paragraphs. Highlight: total spent, biggest change from last week, one actionable tip.",
    "key_stat": {{ "label": "Top category", "value": "Food & Dining", "detail": "\u20b18,200 (42%)" }},
    "mood": "on_track|needs_attention|over_budget|great_week"
}}

RULES:
- Be specific with numbers. Reference actual categories and amounts.
- Keep total length under 150 words.
- Use currency {currency}.
- Mood should reflect actual budget status, not be artificially positive.
"""

DIGEST_USER_PROMPT = """Generate my weekly spending digest.

{formatted_context}"""


def generate_digest_for_user(user_id: str) -> dict | None:
    """
    Generate and store a weekly digest for a single user.
    Idempotent: skips if a digest already exists for this user within the past 6 days.

    Parameters:
        user_id (str): User UUID to generate digest for.

    Output:
        dict with headline, body, key_stat, mood — or None if skipped/failed.
    """
    try:
        # Idempotency check: skip if digest already generated within the past 6 days
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM analysis_history
                WHERE user_id = %s AND analysis_type = 'weekly_digest'
                AND created_at >= CURRENT_DATE - INTERVAL '6 days'
                LIMIT 1
                """,
                [user_id],
            )
            if cursor.fetchone():
                logger.info(f'Skipping digest for user {user_id} — already generated this week')
                return None

        # Skip users with fewer than 3 expenses in the past 7 days (weekly activity check)
        with connection.cursor() as weekly_cursor:
            weekly_cursor.execute(
                """
                SELECT COUNT(*) FROM expenses
                WHERE user_id = %s AND expense_date >= CURRENT_DATE - INTERVAL '7 days'
                """,
                [user_id],
            )
            weekly_count = weekly_cursor.fetchone()[0]

        if weekly_count < 3:
            logger.info(f'Skipping digest for user {user_id} — insufficient weekly data')
            return None

        context = financial_context_engine.build_context(user_id)
        currency = context['profile'].get('currency', 'PHP')

        formatted = financial_context_engine.format_for_prompt(context)
        system = DIGEST_SYSTEM_PROMPT.replace('{currency}', currency)
        # Use replace() to avoid KeyError if journal content contains literal braces
        user_prompt = DIGEST_USER_PROMPT.replace('{formatted_context}', formatted)

        llm = get_llm_client()
        llm_result = llm.complete(system_prompt=system, user_prompt=user_prompt, max_tokens=500, temperature=0.3)

        content = llm_result['content'].strip()
        if content.startswith('```'):
            content = content.split('\n', 1)[1].rsplit('```', 1)[0].strip()
        digest = json.loads(content)

        digest_id = str(uuid.uuid4())
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO analysis_history
                    (id, user_id, analysis_type, input_summary, result, model_used, tokens_used, created_at)
                VALUES (%s, %s, 'weekly_digest', %s, %s, %s, %s, now())
                """,
                [
                    digest_id,
                    user_id,
                    json.dumps({'week_of': context['summary']['month']}),
                    json.dumps(digest),
                    llm_result['model'],
                    llm_result['tokens_used'],
                ],
            )

        return digest

    except Exception as e:
        logger.exception(f'Failed to generate digest for user {user_id}: {e}')
        return None


def generate_all_digests() -> int:
    """
    Generate digests for all active users (those with expenses in the past 7 days).
    Call from the generate_digests management command or a scheduler.

    Output:
        int — number of digests successfully generated
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT user_id::text FROM expenses
            WHERE expense_date >= CURRENT_DATE - INTERVAL '7 days'
            """
        )
        user_ids = [row[0] for row in cursor.fetchall()]

    generated = 0
    for uid in user_ids:
        result = generate_digest_for_user(uid)
        if result:
            generated += 1

    logger.info(f'Generated {generated} weekly digests out of {len(user_ids)} active users')
    return generated
