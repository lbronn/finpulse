# Phase 2 Prompt — Budget Tracking & Core Logic (Week 2)

> **Goal:** Budget features working, aggregation endpoints in Django, data visualization on dashboard.
> **Prerequisites:** Phase 1 complete — auth works, expense + journal CRUD functional, Django starts and connects to DB.

---

## Context Files to Read First

1. `product-brief.md` — overall product context
2. `prd.md` — section 5.4 (Budget Tracker) and section 6 (Page Structure)
3. `architecture.md` — ADR-001 (why aggregation lives in Django, not Supabase)
4. `database_schema.md` — `budget_goals` table definition
5. `phase-1.md` — understand what's already been built

---

## Step-by-Step Implementation

### Step 1: Build Budget Goal Management (Frontend → Supabase)

Budget goals are simple CRUD — they go directly to Supabase, not through Django.

Create a `useBudgetGoals` hook following the same pattern as `useExpenses`:
- Fetch goals for a given month: `supabase.from('budget_goals').select('*, categories(name, icon, color)').eq('month', monthString)`
- Create/update goal: upsert on (user_id, category_id, month) — use `supabase.from('budget_goals').upsert()`
- Delete goal

**Budget Goal Form:**
- Category select (pre-populated from categories, exclude categories that already have a goal for the selected month)
- Amount input (required, > 0)
- Month selector (defaults to current month)

Also allow editing the user's overall monthly budget goal in `user_profiles.monthly_budget_goal` via the Settings page or inline on the Budget page.

### Step 2: Build Django Aggregation Endpoints

These are the first real Django API endpoints. They exist because the aggregation queries are too complex for the Supabase JS client (multi-table JOINs, GROUP BY with CASE expressions, etc.).

**Important:** All Django endpoints must be protected by the `SupabaseAuthMiddleware` from Phase 1. Every endpoint uses `request.user_id` (the Supabase UUID) to scope queries.

#### Endpoint 1: Budget Summary

```
GET /api/budgets/summary?month=2026-03

Purpose: Returns aggregated spending per category for a given month,
compared against budget goals.
```

**Django implementation guidance:**

```python
# apps/budgets/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection

@api_view(['GET'])
def budget_summary(request):
    user_id = request.user_id
    month = request.query_params.get('month')  # Format: YYYY-MM

    if not month:
        return Response({'error': 'month parameter required'}, status=400)

    # Parse month to get date range
    start_date = f"{month}-01"
    # Calculate end_date as first day of next month

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                c.id AS category_id,
                c.name AS category_name,
                c.icon,
                c.color,
                COALESCE(SUM(e.amount), 0) AS spent,
                bg.amount AS goal
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
            GROUP BY c.id, c.name, c.icon, c.color, bg.amount
            ORDER BY spent DESC
        """, [user_id, start_date, end_date, user_id, start_date, user_id])

        # Format and return response
```

**Response shape (see prd.md section 5.4 for full spec):**
```json
{
    "month": "2026-03",
    "overall": {
        "goal": 50000.00,
        "spent": 32450.00,
        "remaining": 17550.00,
        "percentage": 64.9
    },
    "categories": [
        {
            "category_id": "uuid",
            "category_name": "Food & Dining",
            "icon": "utensils",
            "color": "#EF9F27",
            "goal": 15000.00,
            "spent": 12300.00,
            "remaining": 2700.00,
            "percentage": 82.0
        }
    ]
}
```

#### Endpoint 2: Monthly Trends

```
GET /api/expenses/trends?months=6

Purpose: Returns monthly spending totals for the last N months,
broken down by category. Used for the dashboard chart.
```

**Response shape:**
```json
{
    "months": [
        {
            "month": "2025-10",
            "total": 45200.00,
            "categories": [
                { "category_name": "Food & Dining", "amount": 14000.00 },
                { "category_name": "Transportation", "amount": 8500.00 }
            ]
        }
    ]
}
```

#### Endpoint 3: Category Breakdown

```
GET /api/expenses/breakdown?start_date=2026-01-01&end_date=2026-03-14

Purpose: Percentage breakdown of spending by category for a date range.
Used for pie/donut chart on the dashboard.
```

**Response shape:**
```json
{
    "start_date": "2026-01-01",
    "end_date": "2026-03-14",
    "total": 120000.00,
    "breakdown": [
        { "category_name": "Food & Dining", "amount": 42000.00, "percentage": 35.0 },
        { "category_name": "Transportation", "amount": 25500.00, "percentage": 21.25 }
    ]
}
```

### Step 3: Wire Up Budget Page (Frontend)

Build the `/budget` page with these components:

1. **MonthSelector** — navigate between months (previous/next arrows + current month display). Default to current month.

2. **OverallBudgetCard** — large card at the top showing:
   - Overall monthly goal (from `user_profiles.monthly_budget_goal`)
   - Total spent this month
   - Remaining
   - Progress bar (changes color: green < 75%, yellow 75-90%, red > 90%)

3. **CategoryBudgetGrid** — grid of cards, one per category:
   - Category name + icon
   - Spent / Goal display (e.g., "₱12,300 / ₱15,000")
   - Progress bar (same color logic as overall)
   - "Set Goal" button if no goal exists for that category
   - "Edit" button if goal exists
   - Categories with no goal AND no spending are hidden by default (toggle to show all)

4. **BudgetGoalDialog** — modal for setting/editing a category budget goal

**Data flow:**
- Budget goals (CRUD) → Supabase client directly
- Budget summary (aggregated data) → Django API (`GET /api/budgets/summary?month=...`)
- Refetch summary after any goal change

### Step 4: Enhance Dashboard

Upgrade the dashboard from Phase 1's minimal version to include:

1. **Monthly Spending Chart** — bar chart (use recharts) showing spending per month for the last 6 months. Data from Django `GET /api/expenses/trends?months=6`.

2. **Category Breakdown Chart** — donut/pie chart showing spending by category for the current month. Data from Django `GET /api/expenses/breakdown`.

3. **Budget Status Strip** — horizontal row of compact cards showing each category's budget status (green/yellow/red indicators). Links to the full Budget page.

4. **Recent Activity Feed** — last 5 expenses + last 3 journal entries, interleaved by date.

Install recharts:
```bash
cd frontend && npm install recharts
```

### Step 5: Add Expense Categorization UX Improvements

Improve the expense form from Phase 1:
- Category selector should show the icon and color swatch next to each category name
- "Most used" categories appear at the top of the dropdown
- Add a "Quick Add" mode on the dashboard: amount + description + category (3 fields only, date defaults to today, no notes)

### Step 6: Register Django URL Routes

```python
# core/urls.py
from django.urls import path, include

urlpatterns = [
    path('api/budgets/', include('apps.budgets.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
]

# apps/budgets/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('summary', views.budget_summary),
]

# apps/expenses/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('trends', views.expense_trends),
    path('breakdown', views.expense_breakdown),
]
```

---

## Phase 2 Acceptance Criteria

- [ ] User can set, edit, and delete budget goals per category per month
- [ ] Budget page shows actual vs. goal for each category with progress bars
- [ ] Progress bars change color based on spending percentage
- [ ] Month navigation works (previous/next month)
- [ ] Django `/api/budgets/summary` returns correct aggregated data
- [ ] Django `/api/expenses/trends` returns monthly trend data
- [ ] Django `/api/expenses/breakdown` returns category breakdown
- [ ] Dashboard shows monthly spending bar chart (recharts)
- [ ] Dashboard shows category breakdown donut chart
- [ ] Budget status indicators visible on dashboard
- [ ] All Django endpoints validate Supabase JWT correctly
- [ ] All Django endpoints scope data to the authenticated user
- [ ] API errors return proper HTTP status codes and error messages
- [ ] Charts render correctly on mobile screens
- [ ] Quick-add expense works from dashboard

---

## Code Quality Reminders

- Django views should use raw SQL (via `connection.cursor()`) for complex aggregation, not the ORM — the models are unmanaged and the ORM won't optimize these joins well
- All API responses must follow the exact shapes defined in the prd
- Frontend API calls must handle loading, error, and empty states
- Charts must have proper labels, legends, and currency formatting
- Test with realistic data — add at least 20-30 sample expenses across multiple categories and months to verify charts and aggregations work correctly