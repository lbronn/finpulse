from datetime import datetime

from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


def _next_month_start(year: int, month: int) -> str:
    """Returns the ISO date string for the first day of the next month."""
    if month == 12:
        return f"{year + 1}-01-01"
    return f"{year}-{month + 1:02d}-01"


@api_view(['GET'])
def budget_summary(request):
    """
    Returns aggregated spending per category for a given month compared against budget goals.

    Query params:
        month (str): Format YYYY-MM (required)

    Response shape:
        {
            "month": "2026-03",
            "overall": { "goal", "spent", "remaining", "percentage" },
            "categories": [ { "category_id", "category_name", "icon", "color",
                               "goal", "spent", "remaining", "percentage" } ]
        }
    """
    if not hasattr(request, 'user_id'):
        return Response({'error': 'Authentication required'}, status=401)

    user_id = request.user_id
    month = request.query_params.get('month')

    if not month:
        return Response({'error': 'month parameter required'}, status=400)

    try:
        parsed = datetime.strptime(month, '%Y-%m')
    except ValueError:
        return Response({'error': 'Invalid month format. Use YYYY-MM'}, status=400)

    start_date = f"{month}-01"
    end_date = _next_month_start(parsed.year, parsed.month)

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                c.id AS category_id,
                c.name AS category_name,
                c.icon,
                c.color,
                COALESCE(SUM(e.amount), 0) AS spent,
                MAX(bg.amount) AS goal
            FROM categories c
            LEFT JOIN expenses e
                ON e.category_id = c.id
                AND e.user_id = %s
                AND e.expense_date >= %s
                AND e.expense_date < %s
            LEFT JOIN budget_goals bg
                ON bg.category_id = c.id
                AND bg.user_id = %s
                AND bg.month = %s
            WHERE c.is_default = true OR c.user_id = %s
            GROUP BY c.id, c.name, c.icon, c.color
            ORDER BY spent DESC
        """, [user_id, start_date, end_date, user_id, start_date, user_id])

        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT monthly_budget_goal FROM user_profiles WHERE id = %s",
            [user_id]
        )
        profile_row = cursor.fetchone()

    overall_goal = float(profile_row[0]) if profile_row and profile_row[0] is not None else None
    total_spent = sum(float(row['spent']) for row in rows)

    formatted_categories = []
    for row in rows:
        spent = float(row['spent'])
        goal = float(row['goal']) if row['goal'] is not None else None
        remaining = round(goal - spent, 2) if goal is not None else None
        percentage = round(spent / goal * 100, 1) if goal else None
        formatted_categories.append({
            'category_id': str(row['category_id']),
            'category_name': row['category_name'],
            'icon': row['icon'],
            'color': row['color'],
            'goal': goal,
            'spent': round(spent, 2),
            'remaining': remaining,
            'percentage': percentage,
        })

    overall_remaining = round(overall_goal - total_spent, 2) if overall_goal is not None else None
    overall_percentage = round(total_spent / overall_goal * 100, 1) if overall_goal else None

    return Response({
        'month': month,
        'overall': {
            'goal': overall_goal,
            'spent': round(total_spent, 2),
            'remaining': overall_remaining,
            'percentage': overall_percentage,
        },
        'categories': formatted_categories,
    })
