from django.db import connection
from django.conf import settings
from datetime import date


def check_quota(user_id: str, analysis_type: str) -> dict:
    """
    Check if a user has remaining quota for an AI feature this month.

    Parameters:
        user_id (str): Supabase user UUID. Required.
        analysis_type (str): One of 'expense_analysis', 'budget_recommendation',
                             'chat', 'weekly_digest'. Required.

    Returns:
        dict: {
            "allowed": bool,
            "used": int,
            "limit": int,
            "remaining": int,
        }
    """
    limits = {
        'expense_analysis': settings.AI_MONTHLY_ANALYSIS_LIMIT,
        'budget_recommendation': settings.AI_MONTHLY_RECOMMENDATION_LIMIT,
        'chat': settings.AI_MONTHLY_CHAT_LIMIT,
        'weekly_digest': settings.AI_MONTHLY_DIGEST_LIMIT,
    }
    limit = limits.get(analysis_type, 10)
    month_start = date.today().replace(day=1)

    with connection.cursor() as cursor:
        if analysis_type == 'chat':
            cursor.execute("""
                SELECT COUNT(*) FROM chat_messages
                WHERE user_id = %s AND role = 'user' AND created_at >= %s
            """, [user_id, month_start])
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM analysis_history
                WHERE user_id = %s AND analysis_type = %s AND created_at >= %s
            """, [user_id, analysis_type, month_start])

        used = cursor.fetchone()[0]

    return {
        "allowed": used < limit,
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
    }
