"""
Analysis API views.

Summary: Exposes endpoints that trigger AI analysis of expense data, budget
goals, conversational finance chat, and weekly spending digests.
All LLM calls are orchestrated by the service layer.

Endpoints:
    POST /api/analysis/expenses                        → analyze_expenses
    POST /api/analysis/recommendations                 → budget_recommendations
    GET  /api/analysis/history                         → analysis_history_list
    POST /api/analysis/chat                            → chat_message
    GET  /api/analysis/chat/sessions                   → chat_sessions_list
    GET  /api/analysis/chat/sessions/<id>/messages     → chat_session_messages
    GET  /api/analysis/digest/latest                   → latest_digest
"""
import logging
import time
from datetime import datetime

from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.analysis.models import AnalysisHistory
from services.quota import check_quota

logger = logging.getLogger(__name__)


def _check_rate_limit(user_id: str, endpoint: str, max_calls: int = 10, window_seconds: int = 3600) -> bool:
    """
    Returns True if the user is within the rate limit, False if exceeded.
    Uses Django cache with atomic incr() to count calls per user per endpoint per hour window.
    """
    window_start = int(time.time() // window_seconds)
    cache_key = f'ratelimit:{endpoint}:{user_id}:{window_start}'
    # cache.add() is atomic: sets to 1 only if key absent, returns False if already exists.
    added = cache.add(cache_key, 1, timeout=window_seconds)
    if added:
        return True  # first call in this window
    try:
        count = cache.incr(cache_key)
    except ValueError:
        # Key expired between add() and incr() — treat as first call.
        cache.set(cache_key, 1, timeout=window_seconds)
        return True
    return count <= max_calls


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
    if not _check_rate_limit(user_id, 'analyze_expenses'):
        return Response(
            {'error': 'Rate limit exceeded. Maximum 10 analyses per hour. Please try again later.'},
            status=429,
        )
    quota = check_quota(user_id, 'expense_analysis')
    if not quota['allowed']:
        return Response({
            'error': 'Monthly analysis limit reached.',
            'quota': quota,
        }, status=429)
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
    if not _check_rate_limit(user_id, 'budget_recommendations'):
        return Response(
            {'error': 'Rate limit exceeded. Maximum 10 recommendations per hour. Please try again later.'},
            status=429,
        )
    quota = check_quota(user_id, 'budget_recommendation')
    if not quota['allowed']:
        return Response({
            'error': 'Monthly recommendation limit reached.',
            'quota': quota,
        }, status=429)
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
        limit = max(1, min(limit, 100))  # clamp between 1 and 100
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
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT currency FROM user_profiles WHERE id = %s',
                [user_id],
            )
            row = cursor.fetchone()
        return row[0] if row and row[0] else 'PHP'
    except Exception as e:
        logger.error(f'Failed to fetch currency for user {user_id}: {e}. Defaulting to PHP.')
        return 'PHP'


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

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    agg = (
        AnalysisHistory.objects
        .filter(user_id=user_id, created_at__gte=month_start)
        .aggregate(total_tokens=Coalesce(Sum('tokens_used'), 0), analysis_count=Count('id'))
    )
    total_tokens = agg['total_tokens']
    analysis_count = agg['analysis_count'] or 0
    # Claude Sonnet: ~$3/1M input + $15/1M output. Using $3/1M as conservative estimate.
    estimated_cost_usd = round((total_tokens / 1_000_000) * 3.0, 4)

    return Response({
        'total_tokens': total_tokens,
        'analysis_count': analysis_count,
        'estimated_cost_usd': estimated_cost_usd,
    })


# ---------------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------------

@api_view(['POST'])
def chat_message(request):
    """
    POST /api/analysis/chat
    Body: { "message": "How much did I spend on food this month?", "session_id": "uuid" | null }

    Output:
        200: { session_id, response, tokens_used }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id

    if not _check_rate_limit(user_id, 'chat_message', max_calls=15, window_seconds=3600):
        return Response(
            {'error': 'Rate limit exceeded. Please wait a moment.'},
            status=429,
        )
    quota = check_quota(user_id, 'chat')
    if not quota['allowed']:
        return Response({
            'error': 'Monthly chat limit reached.',
            'quota': quota,
        }, status=429)

    message = request.data.get('message', '').strip()
    session_id = request.data.get('session_id')

    if not message:
        return Response({'error': 'message is required'}, status=400)
    if len(message) > 2000:
        return Response({'error': 'message must be under 2000 characters'}, status=400)

    try:
        from services.finance_chat import finance_chat
        result = finance_chat.send_message(user_id, session_id, message)
        return Response(result, status=200)
    except Exception as e:
        logger.exception(f'Chat error for user {user_id}: {e}')
        return Response({'error': 'Chat service temporarily unavailable.'}, status=503)


@api_view(['GET'])
def chat_sessions_list(request):
    """
    GET /api/analysis/chat/sessions?limit=20

    Returns the user's chat sessions (most recent first).
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id
    limit = min(int(request.query_params.get('limit', 20)), 50)

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id::text, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = %s
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            [user_id, limit],
        )
        sessions = [
            {
                'id': row[0],
                'title': row[1],
                'created_at': row[2].isoformat(),
                'updated_at': row[3].isoformat(),
            }
            for row in cursor.fetchall()
        ]
    return Response(sessions, status=200)


@api_view(['GET'])
def chat_session_messages(request, session_id):
    """
    GET /api/analysis/chat/sessions/<session_id>/messages

    Returns all messages in a chat session.
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s',
            [session_id, user_id],
        )
        if not cursor.fetchone():
            return Response({'error': 'Session not found'}, status=404)

        cursor.execute(
            """
            SELECT role, content, created_at FROM chat_messages
            WHERE session_id = %s AND user_id = %s
            ORDER BY created_at ASC
            """,
            [session_id, user_id],
        )
        messages = [
            {'role': row[0], 'content': row[1], 'created_at': row[2].isoformat()}
            for row in cursor.fetchall()
        ]
    return Response(messages, status=200)


# ---------------------------------------------------------------------------
# Weekly digest endpoint
# ---------------------------------------------------------------------------

@api_view(['GET'])
def latest_digest(request):
    """
    GET /api/analysis/digest/latest

    Returns the most recent weekly digest, if one exists from the past 7 days.

    Output:
        200: { digest: {...} | null, generated_at: ISO string | null }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT result, created_at FROM analysis_history
            WHERE user_id = %s AND analysis_type = 'weekly_digest'
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY created_at DESC LIMIT 1
            """,
            [user_id],
        )
        row = cursor.fetchone()
        if not row:
            return Response({'digest': None, 'generated_at': None}, status=200)
        return Response({'digest': row[0], 'generated_at': row[1].isoformat()}, status=200)


@api_view(['GET'])
def usage_quota(request):
    """
    GET /api/analysis/quota

    Returns the current month's AI usage for the authenticated user.

    Output:
        200: {
            expense_analysis: {allowed, used, limit, remaining},
            budget_recommendation: {allowed, used, limit, remaining},
            chat: {allowed, used, limit, remaining},
        }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id
    return Response({
        'expense_analysis': check_quota(user_id, 'expense_analysis'),
        'budget_recommendation': check_quota(user_id, 'budget_recommendation'),
        'chat': check_quota(user_id, 'chat'),
    }, status=200)
