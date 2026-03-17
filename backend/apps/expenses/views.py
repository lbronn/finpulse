from datetime import date, datetime

from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


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
