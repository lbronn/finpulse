from datetime import date, datetime

from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response
from services.expense_parser import expense_parser
from services.auto_categorizer import auto_categorizer, AutoCategorizer


def _first_day_n_months_ago(today: date, n: int) -> date:
    """Returns the first day of the month that is n-1 months before today's month."""
    year, month = today.year, today.month
    for _ in range(n - 1):
        if month == 1:
            year -= 1
            month = 12
        else:
            month -= 1
    return date(year, month, 1)


def _next_month_start(d: date) -> date:
    """Returns the first day of the month after d."""
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


@api_view(['GET'])
def expense_trends(request):
    """
    Returns monthly spending totals for the last N months, broken down by category.

    Query params:
        months (int): Number of months to return (default 6, max 24)

    Response shape:
        {
            "months": [
                { "month": "YYYY-MM", "total": float, "categories": [...] }
            ]
        }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id

    try:
        months_count = int(request.query_params.get('months', 6))
    except ValueError:
        return Response({'error': 'Invalid months parameter'}, status=400)

    months_count = max(1, min(months_count, 24))

    today = date.today()
    start_date = _first_day_n_months_ago(today, months_count)
    end_date = _next_month_start(date(today.year, today.month, 1))

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                TO_CHAR(date_trunc('month', e.expense_date), 'YYYY-MM') AS month,
                c.name AS category_name,
                SUM(e.amount) AS amount
            FROM expenses e
            JOIN categories c ON c.id = e.category_id
            WHERE e.user_id = %s
                AND e.expense_date >= %s
                AND e.expense_date < %s
            GROUP BY date_trunc('month', e.expense_date), c.id, c.name
            ORDER BY month ASC, amount DESC
        """, [user_id, start_date, end_date])

        rows = cursor.fetchall()

    months_dict: dict = {}
    for month_str, category_name, amount in rows:
        if month_str not in months_dict:
            months_dict[month_str] = {'month': month_str, 'total': 0.0, 'categories': []}
        amount_float = round(float(amount), 2)
        months_dict[month_str]['total'] = round(months_dict[month_str]['total'] + amount_float, 2)
        months_dict[month_str]['categories'].append({
            'category_name': category_name,
            'amount': amount_float,
        })

    return Response({'months': list(months_dict.values())})


@api_view(['GET'])
def expense_breakdown(request):
    """
    Returns percentage breakdown of spending by category for a date range.

    Query params:
        start_date (str): ISO date YYYY-MM-DD (required)
        end_date   (str): ISO date YYYY-MM-DD (required)

    Response shape:
        {
            "start_date": str, "end_date": str, "total": float,
            "breakdown": [ { "category_name", "amount", "percentage" } ]
        }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if not start_date or not end_date:
        return Response({'error': 'start_date and end_date parameters required'}, status=400)

    try:
        datetime.strptime(start_date, '%Y-%m-%d')
        datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                c.name AS category_name,
                SUM(e.amount) AS amount
            FROM expenses e
            JOIN categories c ON c.id = e.category_id
            WHERE e.user_id = %s
                AND e.expense_date >= %s
                AND e.expense_date <= %s
            GROUP BY c.id, c.name
            ORDER BY amount DESC
        """, [user_id, start_date, end_date])

        rows = cursor.fetchall()

    breakdown = [(name, round(float(amount), 2)) for name, amount in rows]
    total = round(sum(amt for _, amt in breakdown), 2)

    return Response({
        'start_date': start_date,
        'end_date': end_date,
        'total': total,
        'breakdown': [
            {
                'category_name': name,
                'amount': amt,
                'percentage': round(amt / total * 100, 2) if total > 0 else 0,
            }
            for name, amt in breakdown
        ],
    })


@api_view(['POST'])
def parse_expense(request):
    """
    POST /api/expenses/parse
    Body: { "text": "Jollibee lunch 250" }

    Parses natural language into structured expense data.
    Does NOT create the expense — returns parsed data for user confirmation.
    Rate limited: 30 requests per minute per user.

    Output:
        200: { amount, description, category_id, category_name, expense_date, confidence, raw_text }
        400: { error: "text is required" }
        429: { error: "Rate limit exceeded. Try again in a minute." }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id

    # Rate limit: 30 requests per minute per user
    cache_key = f'parse_ratelimit_{user_id}'
    call_count = cache.get(cache_key, 0)
    if call_count >= 30:
        return Response({'error': 'Rate limit exceeded. Try again in a minute.'}, status=429)
    cache.set(cache_key, call_count + 1, timeout=60)

    raw_text = request.data.get('text', '').strip()

    if not raw_text:
        return Response({'error': 'text is required'}, status=400)

    if len(raw_text) > 500:
        return Response({'error': 'text must be under 500 characters'}, status=400)

    # Get user currency from profile
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT currency FROM user_profiles WHERE id = %s", [user_id]
        )
        row = cursor.fetchone()
        currency = row[0] if row else 'PHP'

    result = expense_parser.parse(raw_text, user_id, currency)
    return Response(result, status=200)


@api_view(['POST'])
def categorize_expense(request):
    """
    POST /api/expenses/categorize
    Body: { "description": "Grab ride to office", "amount": 180.00 }

    Returns a suggested category for the given expense.

    Output:
        200: { category_id, category_name, method, confidence }
        400: { error: "description is required" }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id
    description = request.data.get('description', '').strip()
    amount = request.data.get('amount', 0)

    if not description:
        return Response({'error': 'description is required'}, status=400)

    result = auto_categorizer.categorize(description, float(amount), user_id)
    return Response(result, status=200)


@api_view(['POST'])
def confirm_categorization(request):
    """
    POST /api/expenses/confirm-category
    Body: { "description": "Grab ride to office", "category_id": "uuid" }

    Records a confirmed categorization to improve future suggestions.
    Call this AFTER the user saves an expense.

    Output:
        200: { "status": "recorded" }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id
    description = request.data.get('description', '').strip()
    category_id = request.data.get('category_id', '').strip()

    if not description or not category_id:
        return Response({'error': 'description and category_id are required'}, status=400)

    AutoCategorizer.record_categorization(user_id, description, category_id)
    return Response({'status': 'recorded'}, status=200)


@api_view(['GET'])
def demo_data(request):
    """
    GET /api/demo/data

    Returns pre-seeded demo data for the public demo page. No auth required.

    Output:
        200: {
            expenses: list of {category_name, amount, description, expense_date},
            budget_goals: list of {category, goal, spent},
            monthly_summary: {total_spent, transaction_count, daily_average},
            category_breakdown: list of {category, amount, count}
        }
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT category_name, amount, description, expense_date
                FROM demo_expenses ORDER BY expense_date DESC
            """)
            expenses = [
                {
                    "category_name": row[0],
                    "amount": float(row[1]),
                    "description": row[2],
                    "expense_date": row[3].isoformat(),
                }
                for row in cursor.fetchall()
            ]

            cursor.execute("""
                SELECT
                    COALESCE(SUM(amount), 0) AS total,
                    COUNT(*) AS count,
                    COALESCE(SUM(amount) / GREATEST(EXTRACT(DAY FROM CURRENT_DATE), 1), 0) AS daily_avg
                FROM demo_expenses
                WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)
            """)
            summary_row = cursor.fetchone()

            cursor.execute("""
                SELECT category_name, SUM(amount), COUNT(*)
                FROM demo_expenses
                WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)
                GROUP BY category_name ORDER BY SUM(amount) DESC
            """)
            breakdown = [
                {"category": row[0], "amount": float(row[1]), "count": row[2]}
                for row in cursor.fetchall()
            ]

        month_start_date = date.today().replace(day=1)

        def is_current_month(expense_date_str: str) -> bool:
            return date.fromisoformat(expense_date_str) >= month_start_date

        demo_goals = [
            {
                "category": "Food & Dining",
                "goal": 12000,
                "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Food & Dining" and is_current_month(e["expense_date"])),
            },
            {
                "category": "Transportation",
                "goal": 5000,
                "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Transportation" and is_current_month(e["expense_date"])),
            },
            {
                "category": "Entertainment",
                "goal": 3000,
                "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Entertainment" and is_current_month(e["expense_date"])),
            },
        ]

        return Response({
            "expenses": expenses,
            "budget_goals": demo_goals,
            "monthly_summary": {
                "total_spent": float(summary_row[0]),
                "transaction_count": summary_row[1],
                "daily_average": float(summary_row[2]),
            },
            "category_breakdown": breakdown,
        }, status=200)
    except Exception:
        return Response({'error': 'Demo data unavailable'}, status=503)
