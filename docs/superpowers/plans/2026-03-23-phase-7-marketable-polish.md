# Phase 7 — Marketable Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FinPulse from a personal tool into a marketable SaaS product with multi-user onboarding, a public landing page, demo mode, dark mode, visual polish, and AI usage quotas.

**Architecture:** The frontend gets three new public-facing surfaces (landing page, demo page, onboarding overlay) plus a ThemeProvider for dark mode. The backend gains a public demo endpoint exempt from JWT auth, a quota utility used by all AI views, and Django settings for per-feature AI limits. All new Supabase tables (`onboarding_progress`, `demo_expenses`) are created via raw SQL (Django models use `managed = False`).

**Tech Stack:** React + TypeScript, Tailwind CSS, shadcn/ui, Zustand, react-router-dom, Django REST Framework, Anthropic Claude, Supabase Postgres

---

## File Structure

### Files to Create

**Frontend:**
- `frontend/src/pages/LandingPage.tsx` — Public marketing page (/, unauthenticated)
- `frontend/src/pages/DemoPage.tsx` — Read-only dashboard with seeded demo data
- `frontend/src/components/ThemeProvider.tsx` — Dark/light/system theme context + CSS class toggle
- `frontend/src/components/features/Onboarding/Onboarding.tsx` — Full-screen stepper wrapper
- `frontend/src/components/features/Onboarding/OnboardingProgressBar.tsx` — Step dots indicator
- `frontend/src/components/features/Onboarding/steps/WelcomeStep.tsx`
- `frontend/src/components/features/Onboarding/steps/ProfileStep.tsx`
- `frontend/src/components/features/Onboarding/steps/BudgetStep.tsx`
- `frontend/src/components/features/Onboarding/steps/CategoriesStep.tsx`
- `frontend/src/components/features/Onboarding/steps/FirstExpenseStep.tsx`
- `frontend/src/components/features/Onboarding/steps/DoneStep.tsx`
- `frontend/src/hooks/useOnboarding.ts` — Onboarding status check + completion logic

**Backend:**
- `backend/services/quota.py` — `check_quota(user_id, analysis_type)` utility
- `backend/apps/expenses/demo_urls.py` — URL config for demo endpoint

### Files to Modify

**Frontend:**
- `frontend/src/App.tsx` — Add LandingPage + DemoPage routes, wrap with ThemeProvider, add onboarding gate
- `frontend/src/components/layout/AuthLayout.tsx` — Add onboarding check and gate
- `frontend/src/components/layout/MainLayout.tsx` — Add theme toggle button to header
- `frontend/src/pages/SettingsPage.tsx` — Add dark mode toggle section
- `frontend/src/pages/AnalysisPage.tsx` — Add quota display indicators
- `frontend/src/index.css` — Add page transition CSS classes, dark mode chart overrides

**Backend:**
- `backend/core/settings.py` — Add AI_MONTHLY_* quota constants
- `backend/core/urls.py` — Add `api/demo/` include
- `backend/apps/users/middleware.py` — Exclude `/api/demo/` paths from JWT enforcement
- `backend/apps/expenses/views.py` — Add `demo_data()` view
- `backend/apps/analysis/views.py` — Add `usage_quota()` view + quota checks to all AI endpoints

**Database (manual SQL in Supabase dashboard):**
- Create `onboarding_progress` table with RLS
- Create `demo_expenses` table + seed data
- Add `OnboardingProgress` model (managed=False) to `apps/users/models.py`

---

## Task 1: Database Tables (Supabase SQL)

Run these SQL statements in the Supabase SQL editor for your project.

**Files:** No Django files — Supabase schema only. After running SQL, add the Django model mirror.
- Modify: `backend/apps/users/models.py`

- [ ] **Step 1: Run onboarding_progress table SQL**

Go to Supabase Dashboard → SQL Editor and run:

```sql
CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    step VARCHAR(30) NOT NULL DEFAULT 'welcome',
    completed_at TIMESTAMPTZ,
    skipped BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select_own" ON onboarding_progress
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "onboarding_insert_own" ON onboarding_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "onboarding_update_own" ON onboarding_progress
    FOR UPDATE USING (auth.uid() = user_id);
```

Expected: Table created, RLS enabled, 3 policies created.

- [ ] **Step 2: Run demo_expenses table + seed data SQL**

```sql
CREATE TABLE IF NOT EXISTS demo_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    notes TEXT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO demo_expenses (category_name, amount, description, expense_date) VALUES
    ('Food & Dining', 450.00, 'Lunch at Jollibee', '2026-03-14'),
    ('Food & Dining', 380.00, 'Groceries at SM', '2026-03-13'),
    ('Food & Dining', 250.00, 'Coffee at Starbucks', '2026-03-12'),
    ('Food & Dining', 520.00, 'Dinner at Kuya J', '2026-03-10'),
    ('Food & Dining', 180.00, 'Street food', '2026-03-08'),
    ('Food & Dining', 890.00, 'Weekly groceries', '2026-03-06'),
    ('Food & Dining', 350.00, 'Lunch delivery', '2026-03-04'),
    ('Food & Dining', 420.00, 'Team lunch', '2026-03-02'),
    ('Transportation', 200.00, 'Grab to office', '2026-03-14'),
    ('Transportation', 180.00, 'Grab home', '2026-03-13'),
    ('Transportation', 50.00, 'Jeepney fare', '2026-03-11'),
    ('Transportation', 200.00, 'Grab to meeting', '2026-03-09'),
    ('Transportation', 50.00, 'Jeepney fare', '2026-03-07'),
    ('Transportation', 1200.00, 'Grab long distance', '2026-03-05'),
    ('Entertainment', 549.00, 'Netflix subscription', '2026-03-01'),
    ('Entertainment', 350.00, 'Movie tickets', '2026-03-08'),
    ('Entertainment', 1200.00, 'Concert tickets', '2026-03-12'),
    ('Shopping', 2500.00, 'New headphones', '2026-03-10'),
    ('Shopping', 850.00, 'Clothes at Uniqlo', '2026-03-03'),
    ('Utilities', 2800.00, 'Electricity bill', '2026-03-01'),
    ('Utilities', 1500.00, 'Internet bill', '2026-03-01'),
    ('Utilities', 800.00, 'Water bill', '2026-03-01'),
    ('Healthcare', 500.00, 'Vitamins', '2026-03-06'),
    ('Personal Care', 400.00, 'Haircut', '2026-03-09'),
    ('Education', 1500.00, 'Online course', '2026-03-02'),
    ('Food & Dining', 380.00, 'Lunch at Mang Inasal', '2026-02-28'),
    ('Food & Dining', 420.00, 'Groceries', '2026-02-25'),
    ('Food & Dining', 280.00, 'Coffee', '2026-02-22'),
    ('Food & Dining', 350.00, 'Dinner out', '2026-02-19'),
    ('Food & Dining', 750.00, 'Weekly groceries', '2026-02-15'),
    ('Food & Dining', 300.00, 'Lunch delivery', '2026-02-12'),
    ('Food & Dining', 390.00, 'Team lunch', '2026-02-08'),
    ('Food & Dining', 200.00, 'Snacks', '2026-02-05'),
    ('Transportation', 180.00, 'Grab to office', '2026-02-27'),
    ('Transportation', 50.00, 'Jeepney', '2026-02-24'),
    ('Transportation', 200.00, 'Grab', '2026-02-20'),
    ('Transportation', 50.00, 'Jeepney', '2026-02-16'),
    ('Transportation', 180.00, 'Grab', '2026-02-12'),
    ('Entertainment', 549.00, 'Netflix', '2026-02-01'),
    ('Entertainment', 300.00, 'Movie', '2026-02-14'),
    ('Shopping', 1800.00, 'New shoes', '2026-02-18'),
    ('Utilities', 2600.00, 'Electricity', '2026-02-01'),
    ('Utilities', 1500.00, 'Internet', '2026-02-01'),
    ('Utilities', 750.00, 'Water', '2026-02-01'),
    ('Healthcare', 1200.00, 'Dental checkup', '2026-02-10'),
    ('Personal Care', 350.00, 'Haircut', '2026-02-05');
```

Expected: 46 rows inserted.

- [ ] **Step 3: Add OnboardingProgress model mirror to Django**

In `backend/apps/users/models.py`, append:

```python
class OnboardingProgress(models.Model):
    user_id = models.UUIDField(primary_key=True)
    step = models.CharField(max_length=30, default='welcome')
    completed_at = models.DateTimeField(null=True, blank=True)
    skipped = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'onboarding_progress'
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse
git add backend/apps/users/models.py
git commit -m "feat: add OnboardingProgress model mirror (managed=False)"
```

---

## Task 2: Backend — Demo Endpoint

Create the public `/api/demo/data` endpoint that reads from `demo_expenses`. This endpoint is excluded from JWT auth.

**Files:**
- Create: `backend/apps/expenses/demo_urls.py`
- Modify: `backend/apps/expenses/views.py`
- Modify: `backend/core/urls.py`
- Modify: `backend/apps/users/middleware.py`

- [ ] **Step 1: Exempt `/api/demo/` from JWT middleware**

In `backend/apps/users/middleware.py`, change line 36:
```python
# BEFORE:
if request.path.startswith('/api/'):

# AFTER:
if request.path.startswith('/api/') and not request.path.startswith('/api/demo/'):
```

- [ ] **Step 2: Add `demo_data` view to expenses/views.py**

At the top of `backend/apps/expenses/views.py`, ensure this import is present:
```python
from datetime import date
```

At the bottom of `backend/apps/expenses/views.py`, add:

```python
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

    month_start = date.today().replace(day=1).isoformat()
    demo_goals = [
        {
            "category": "Food & Dining",
            "goal": 12000,
            "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Food & Dining" and e["expense_date"] >= month_start),
        },
        {
            "category": "Transportation",
            "goal": 5000,
            "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Transportation" and e["expense_date"] >= month_start),
        },
        {
            "category": "Entertainment",
            "goal": 3000,
            "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Entertainment" and e["expense_date"] >= month_start),
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
```

**Parameters:** None (no auth)
**Output:** 200 JSON with expenses, budget_goals, monthly_summary, category_breakdown
**Dependencies:** `from django.db import connection` (already imported in this file)

- [ ] **Step 3: Create demo_urls.py**

Create `backend/apps/expenses/demo_urls.py`:

```python
from django.urls import path
from . import views

urlpatterns = [
    path('data', views.demo_data),
]
```

- [ ] **Step 4: Register demo URLs in core/urls.py**

In `backend/core/urls.py`, add:

```python
# BEFORE:
urlpatterns = [
    path('api/budgets/', include('apps.budgets.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
    path('api/analysis/', include('apps.analysis.urls')),
]

# AFTER:
urlpatterns = [
    path('api/budgets/', include('apps.budgets.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
    path('api/analysis/', include('apps.analysis.urls')),
    path('api/demo/', include('apps.expenses.demo_urls')),
]
```

- [ ] **Step 5: Test the demo endpoint manually**

Start backend: `cd backend && python manage.py runserver`
Run: `curl http://localhost:8000/api/demo/data`
Expected: 200 JSON with expenses array. No Authorization header needed.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/users/middleware.py backend/apps/expenses/views.py \
        backend/apps/expenses/demo_urls.py backend/core/urls.py
git commit -m "feat: add public demo data endpoint (no auth required)"
```

---

## Task 3: Backend — Usage Quotas

Add a quota system for all AI endpoints: settings constants, a reusable `check_quota` utility, quota checks in all AI views, and a `/api/analysis/quota` endpoint.

**Files:**
- Create: `backend/services/quota.py`
- Modify: `backend/core/settings.py`
- Modify: `backend/apps/analysis/views.py`

- [ ] **Step 1: Add quota settings to settings.py**

Append to `backend/core/settings.py`:

```python
# AI usage quotas — free tier limits per user per month
AI_MONTHLY_ANALYSIS_LIMIT = 10
AI_MONTHLY_RECOMMENDATION_LIMIT = 10
AI_MONTHLY_CHAT_LIMIT = 50
AI_MONTHLY_DIGEST_LIMIT = 4
```

- [ ] **Step 2: Write failing test for check_quota**

Create `backend/services/test_quota.py`:

```python
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings


@override_settings(
    AI_MONTHLY_ANALYSIS_LIMIT=10,
    AI_MONTHLY_RECOMMENDATION_LIMIT=10,
    AI_MONTHLY_CHAT_LIMIT=50,
    AI_MONTHLY_DIGEST_LIMIT=4,
)
class CheckQuotaTest(TestCase):
    def test_returns_allowed_when_under_limit(self):
        with patch('services.quota.connection') as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=False)
            mock_cursor.fetchone.return_value = (3,)
            mock_conn.cursor.return_value = mock_cursor

            from services.quota import check_quota
            result = check_quota('user-123', 'expense_analysis')

        self.assertTrue(result['allowed'])
        self.assertEqual(result['used'], 3)
        self.assertEqual(result['limit'], 10)
        self.assertEqual(result['remaining'], 7)

    def test_returns_not_allowed_when_at_limit(self):
        with patch('services.quota.connection') as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=False)
            mock_cursor.fetchone.return_value = (10,)
            mock_conn.cursor.return_value = mock_cursor

            from services.quota import check_quota
            result = check_quota('user-123', 'expense_analysis')

        self.assertFalse(result['allowed'])
        self.assertEqual(result['remaining'], 0)

    def test_chat_uses_chat_messages_table(self):
        with patch('services.quota.connection') as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
            mock_cursor.__exit__ = MagicMock(return_value=False)
            mock_cursor.fetchone.return_value = (5,)
            mock_conn.cursor.return_value = mock_cursor

            from services.quota import check_quota
            result = check_quota('user-123', 'chat')

        # Verify it used the chat_messages table query
        call_args = mock_cursor.execute.call_args[0][0]
        self.assertIn('chat_messages', call_args)
        self.assertEqual(result['limit'], 50)
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend
python manage.py test services.test_quota -v 2
```

Expected: ImportError or ModuleNotFoundError for `services.quota`

- [ ] **Step 4: Implement check_quota in services/quota.py**

Create `backend/services/quota.py`:

```python
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
            "allowed": bool,   # True if user has quota remaining
            "used": int,       # How many times used this month
            "limit": int,      # Monthly cap for this type
            "remaining": int,  # How many left (min 0)
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend
python manage.py test services.test_quota -v 2
```

Expected: 3 tests pass.

- [ ] **Step 6: Apply quota checks to AI views + add quota endpoint**

In `backend/apps/analysis/views.py`, add at the top of the file (after existing imports):
```python
from services.quota import check_quota
```

Then at the top of each AI view function, add quota check before calling any LLM service:

For `analyze_expenses` view, add after `user_id = request.user_id`:
```python
quota = check_quota(user_id, 'expense_analysis')
if not quota['allowed']:
    return Response({
        'error': 'Monthly analysis limit reached.',
        'quota': quota,
    }, status=429)
```

For `budget_recommendations` view (or equivalent name), add:
```python
quota = check_quota(user_id, 'budget_recommendation')
if not quota['allowed']:
    return Response({
        'error': 'Monthly recommendation limit reached.',
        'quota': quota,
    }, status=429)
```

For `chat_message` view, add:
```python
quota = check_quota(user_id, 'chat')
if not quota['allowed']:
    return Response({
        'error': 'Monthly chat limit reached.',
        'quota': quota,
    }, status=429)
```

Then add the quota endpoint at the bottom of `views.py`:

```python
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
    user_id = request.user_id
    return Response({
        'expense_analysis': check_quota(user_id, 'expense_analysis'),
        'budget_recommendation': check_quota(user_id, 'budget_recommendation'),
        'chat': check_quota(user_id, 'chat'),
    }, status=200)
```

- [ ] **Step 7: Register usage_quota URL**

In `backend/apps/analysis/urls.py`, add:
```python
path('quota', views.usage_quota),
```

- [ ] **Step 8: Test quota endpoint manually**

```bash
# Get a valid JWT token from the frontend dev tools (Supabase session)
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/analysis/quota
```

Expected: 200 JSON with quota objects for each AI type.

- [ ] **Step 9: Commit**

```bash
git add backend/core/settings.py backend/services/quota.py \
        backend/services/test_quota.py backend/apps/analysis/views.py \
        backend/apps/analysis/urls.py
git commit -m "feat: add AI usage quota system with per-feature monthly limits"
```

---

## Task 4: Frontend — ThemeProvider (Dark Mode)

Create the theme context and toggle. This task must come before all other frontend tasks since other components will need `useTheme`.

**Files:**
- Create: `frontend/src/components/ThemeProvider.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create ThemeProvider.tsx**

Create `frontend/src/components/ThemeProvider.tsx`:

```typescript
import { createContext, useContext, useEffect, useState } from 'react';

// Summary: Provides dark/light/system theme switching via CSS class on <html>.
// Persists user preference in localStorage. Listens to OS preference when set to 'system'.

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('finpulse_theme') as Theme) || 'system'
  );

  useEffect(() => {
    const root = document.documentElement;

    function applyTheme(t: Theme) {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(isDark ? 'dark' : 'light');
      } else {
        root.classList.add(t);
      }
    }

    applyTheme(theme);

    // When theme is 'system', follow OS changes in real time
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem('finpulse_theme', t);
    setThemeState(t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

- [ ] **Step 2: Wrap App with ThemeProvider**

In `frontend/src/App.tsx`, import and wrap the root:

```typescript
import { ThemeProvider } from '@/components/ThemeProvider';

// Wrap the entire return:
return (
  <ThemeProvider>
    <>
      <Toaster position="top-center" richColors />
      <OfflineBanner />
      <BrowserRouter>
        ...
      </BrowserRouter>
    </>
  </ThemeProvider>
);
```

- [ ] **Step 3: Ensure tailwind.config enables dark mode class strategy**

Check if `frontend/tailwind.config.ts` (or `tailwind.config.js`) exists. If it does, ensure it has:
```ts
darkMode: 'class',
```

If the project uses `@tailwindcss/vite` without a config file, create `frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config
```

- [ ] **Step 4: Add theme toggle to MainLayout header**

In `frontend/src/components/layout/MainLayout.tsx`, add a sun/moon toggle button in the header area. Import `useTheme` and `Sun`/`Moon` from lucide-react:

```typescript
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';

// Inside the component:
const { theme, setTheme } = useTheme();

function cycleTheme() {
  const next: Record<string, 'dark' | 'system' | 'light'> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };
  setTheme(next[theme]);
}

// In JSX, add to the header/nav area:
<button
  onClick={cycleTheme}
  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  aria-label="Toggle theme"
>
  {theme === 'dark' ? <Moon className="h-4 w-4" /> :
   theme === 'light' ? <Sun className="h-4 w-4" /> :
   <Monitor className="h-4 w-4" />}
</button>
```

- [ ] **Step 5: Add theme selector to SettingsPage**

In `frontend/src/pages/SettingsPage.tsx`, add a Theme section. Import `useTheme` and add a radio group or button group for Light / Dark / System options. The exact position: add it as the first card section, above existing settings.

```typescript
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';

// Inside component:
const { theme, setTheme } = useTheme();

// In JSX, add a Card section:
<Card>
  <CardHeader>
    <CardTitle>Appearance</CardTitle>
    <CardDescription>Choose your preferred color theme.</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex gap-2">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm capitalize transition-colors ${
            theme === t
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-accent'
          }`}
        >
          {t === 'light' && <Sun className="h-4 w-4" />}
          {t === 'dark' && <Moon className="h-4 w-4" />}
          {t === 'system' && <Monitor className="h-4 w-4" />}
          {t}
        </button>
      ))}
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 6: Test dark mode manually**

Run `npm run dev` in `frontend/`. Toggle between light/dark/system from Settings. Verify:
- All pages switch theme
- Preference persists after page reload
- System option follows OS preference

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ThemeProvider.tsx \
        frontend/src/App.tsx \
        frontend/src/components/layout/MainLayout.tsx \
        frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add dark mode with light/dark/system theme toggle"
```

---

## Task 5: Frontend — Landing Page

Create the public marketing page at `/` for unauthenticated users. Authenticated users route to dashboard.

**Files:**
- Create: `frontend/src/pages/LandingPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create LandingPage.tsx**

Create `frontend/src/pages/LandingPage.tsx`:

```typescript
// Summary: Public marketing page for FinPulse. Shown to unauthenticated users
// at the root URL. Static — no API calls required. Sections: Hero, Features,
// How It Works, CTA.

import { Link } from 'react-router-dom';
import { TrendingUp, Zap, Target, ArrowRight, BarChart2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl">
          <TrendingUp className="h-5 w-5 text-primary" />
          FinPulse
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Track smarter.<br />Spend wiser.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          AI-powered expense tracking that understands your spending patterns
          and gives you advice that actually works.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Try Demo
            </Button>
          </Link>
        </div>
        {/* Hero visual placeholder */}
        <div className="mt-16 rounded-xl border border-border bg-muted/40 h-64 md:h-96 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChart2 className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-sm">Dashboard preview</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need to stay on budget</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'Quick Capture',
                description: 'Log an expense in 3 seconds. Just type what you spent — our AI parses the rest.',
              },
              {
                icon: MessageSquare,
                title: 'AI Insights',
                description: 'Get spending analysis grounded in your actual data, not generic tips.',
              },
              {
                icon: Target,
                title: 'Budget Tracking',
                description: 'Set goals, track progress, get recommendations to stay on track.',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-border bg-background p-6">
                <div className="rounded-lg bg-primary/10 w-10 h-10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { step: '1', title: 'Track your expenses', description: 'Log expenses instantly with natural language. "Jollibee lunch 250" — done.' },
              { step: '2', title: 'AI analyzes your patterns', description: 'FinPulse spots trends, anomalies, and habits you\'d never catch on your own.' },
              { step: '3', title: 'Get actionable recommendations', description: 'Real advice based on your actual data, updated every week.' },
            ].map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mb-4">
                  {step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20 text-center text-primary-foreground">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">Start tracking for free</h2>
          <p className="opacity-90 mb-8">No credit card required. Set up in under 2 minutes.</p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="gap-2">
              Create Your Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 font-semibold text-foreground mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          FinPulse
        </div>
        <p>© 2026 FinPulse. Built for smarter spending.</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx routing**

In `frontend/src/App.tsx`, update the routing so:
- `/` shows `LandingPage` if unauthenticated, redirects to `/app/` if authenticated
- Protected app routes move to `/app/*`
- Add `/demo` as a new public route

```typescript
import LandingPage from '@/pages/LandingPage';
import DemoPage from '@/pages/DemoPage'; // will create in Task 6

// Update routes:
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignUpPage />} />
  <Route path="/demo" element={<DemoPage />} />

  {/* Root: landing if unauthed, redirect to app if authed */}
  <Route
    path="/"
    element={user ? <Navigate to="/app" replace /> : <LandingPage />}
  />

  {/* Protected app routes */}
  <Route path="/app" element={<AuthLayout />}>
    <Route element={<MainLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="expenses" element={<ExpensesPage />} />
      <Route path="journal" element={<JournalPage />} />
      <Route path="budget" element={<BudgetPage />} />
      <Route path="analysis" element={<AnalysisPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </Route>

  {/* Catch-all */}
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Note: Import `user` from `useAuthStore()` at the top of the component:
```typescript
const { initialize, loading, user } = useAuthStore();
```

- [ ] **Step 3: Update internal navigation links**

Since app routes moved to `/app/*`, update navigation links in `MainLayout.tsx`:
- `"/"` → `"/app"`
- `"/expenses"` → `"/app/expenses"`
- `"/journal"` → `"/app/journal"`
- `"/budget"` → `"/app/budget"`
- `"/analysis"` → `"/app/analysis"`
- `"/settings"` → `"/app/settings"`

Also update any `<Link>` or `navigate()` calls in other components (LoginPage, SignUpPage redirects, etc.) to use `/app` instead of `/`.

- [ ] **Step 4: Test landing page**

- Visit `http://localhost:5173/` while logged out — landing page should show
- Visit `http://localhost:5173/` while logged in — should redirect to `/app`
- Check responsiveness at 375px and 768px

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/App.tsx \
        frontend/src/components/layout/MainLayout.tsx
git commit -m "feat: add public landing page and restructure routes to /app/*"
```

---

## Task 6: Frontend — Demo Page

Create the `/demo` page: a read-only view of the dashboard using seeded demo data. No auth required.

**Files:**
- Create: `frontend/src/pages/DemoPage.tsx`

- [ ] **Step 1: Create DemoPage.tsx**

Create `frontend/src/pages/DemoPage.tsx`:

```typescript
// Summary: Public demo page at /demo. Fetches pre-seeded data from
// GET /api/demo/data (no auth). Renders a read-only dashboard with
// a "Sign up to use this feature" overlay on interactive elements.
// Top banner prompts unauthenticated users to sign up.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/formatters';

const DEMO_API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const CHART_COLORS = ['#EF9F27', '#378ADD', '#9B59B6', '#2ECC71', '#E74C3C', '#1ABC9C', '#F39C12'];

interface DemoData {
  expenses: Array<{ category_name: string; amount: number; description: string; expense_date: string }>;
  budget_goals: Array<{ category: string; goal: number; spent: number }>;
  monthly_summary: { total_spent: number; transaction_count: number; daily_average: number };
  category_breakdown: Array<{ category: string; amount: number; count: number }>;
}

// Tooltip wrapper that shows "Sign up" message on hover
function DemoBlocker({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Link to="/signup">
          <Button size="sm" className="gap-1">Sign up to use this <ArrowRight className="h-3 w-3" /></Button>
        </Link>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${DEMO_API}/api/demo/data`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load demo data');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top banner */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground py-3 px-4 text-center text-sm flex items-center justify-center gap-4">
        <span>You're viewing a demo. Sign up to track your own finances.</span>
        <Link to="/signup">
          <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
            Sign Up Free <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            FinPulse <span className="text-xs font-normal text-muted-foreground ml-1">Demo</span>
          </div>
          <div className="flex gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link to="/signup"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Spent (March)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(data?.monthly_summary.total_spent ?? 0, 'PHP')}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{data?.monthly_summary.transaction_count}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Daily Average</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(data?.monthly_summary.daily_average ?? 0, 'PHP')}</p></CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category breakdown chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Spending by Category</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data?.category_breakdown}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      animationDuration={800}
                    >
                      {data?.category_breakdown.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, 'PHP')} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Budget goals */}
          <Card>
            <CardHeader><CardTitle className="text-base">Budget Goals</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : (
                data?.budget_goals.map((g) => {
                  const pct = Math.min(100, (g.spent / g.goal) * 100);
                  return (
                    <div key={g.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{g.category}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(g.spent, 'PHP')} / {formatCurrency(g.goal, 'PHP')}
                        </span>
                      </div>
                      <Progress value={pct} className={pct >= 100 ? '[&>div]:bg-destructive' : pct >= 80 ? '[&>div]:bg-yellow-500' : ''} />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent expenses */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)
            ) : (
              <div className="divide-y divide-border">
                {data?.expenses.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{e.description}</p>
                      <p className="text-xs text-muted-foreground">{e.category_name} · {e.expense_date}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(e.amount, 'PHP')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocked features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemoBlocker>
            <Card className="cursor-not-allowed">
              <CardHeader><CardTitle className="text-base">AI Analysis</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Get AI-powered insights into your spending patterns.</p>
                <Button className="mt-4" disabled>Analyze My Expenses</Button>
              </CardContent>
            </Card>
          </DemoBlocker>
          <DemoBlocker>
            <Card className="cursor-not-allowed">
              <CardHeader><CardTitle className="text-base">Finance Chat</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Ask your AI finance assistant anything.</p>
                <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  "How am I doing with food spending?"
                </div>
              </CardContent>
            </Card>
          </DemoBlocker>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify demo page loads without auth**

Visit `http://localhost:5173/demo` while logged out.
Expected: Demo page with real data from the seeded `demo_expenses` table (no auth error).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DemoPage.tsx
git commit -m "feat: add public demo page with read-only dashboard"
```

---

## Task 7: Frontend — Onboarding Flow

New users currently land on an empty dashboard. This task adds a full-screen onboarding stepper that guides users to first value in under 2 minutes.

**Files:**
- Create: `frontend/src/hooks/useOnboarding.ts`
- Create: `frontend/src/components/features/Onboarding/Onboarding.tsx`
- Create: `frontend/src/components/features/Onboarding/OnboardingProgressBar.tsx`
- Create: `frontend/src/components/features/Onboarding/steps/WelcomeStep.tsx`
- Create: `frontend/src/components/features/Onboarding/steps/ProfileStep.tsx`
- Create: `frontend/src/components/features/Onboarding/steps/BudgetStep.tsx`
- Create: `frontend/src/components/features/Onboarding/steps/CategoriesStep.tsx`
- Create: `frontend/src/components/features/Onboarding/steps/FirstExpenseStep.tsx`
- Create: `frontend/src/components/features/Onboarding/steps/DoneStep.tsx`
- Modify: `frontend/src/components/layout/AuthLayout.tsx`

- [ ] **Step 1: Create useOnboarding hook**

Create `frontend/src/hooks/useOnboarding.ts`:

```typescript
// Summary: Hook that checks onboarding status for the authenticated user.
// Creates an onboarding_progress record if one doesn't exist (new user).
// Returns { isComplete, loading, markComplete, markSkipped }.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function useOnboarding() {
  const { user } = useAuthStore();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function checkOnboarding() {
      try {
        const { data } = await supabase
          .from('onboarding_progress')
          .select('completed_at, skipped')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!data) {
          // New user — create record and show onboarding
          await supabase.from('onboarding_progress').insert({
            user_id: user!.id,
            step: 'welcome',
          });
          setIsComplete(false);
        } else if (data.completed_at || data.skipped) {
          setIsComplete(true);
        } else {
          setIsComplete(false);
        }
      } catch {
        // On error, don't block the user — treat as complete
        setIsComplete(true);
      } finally {
        setLoading(false);
      }
    }

    checkOnboarding();
  }, [user]);

  async function markComplete() {
    if (!user) return;
    await supabase
      .from('onboarding_progress')
      .update({ completed_at: new Date().toISOString(), step: 'done' })
      .eq('user_id', user.id);
    setIsComplete(true);
  }

  async function markSkipped() {
    if (!user) return;
    await supabase
      .from('onboarding_progress')
      .update({ skipped: true, step: 'skipped' })
      .eq('user_id', user.id);
    setIsComplete(true);
  }

  return { isComplete, loading, markComplete, markSkipped };
}
```

- [ ] **Step 2: Create OnboardingProgressBar.tsx**

Create `frontend/src/components/features/Onboarding/OnboardingProgressBar.tsx`:

```typescript
// Summary: Renders a row of dots indicating onboarding progress.
// Current step dot is filled/primary; completed dots are filled; future dots are outlined.

interface OnboardingProgressBarProps {
  currentStep: number; // 0-indexed
  totalSteps: number;
}

export default function OnboardingProgressBar({ currentStep, totalSteps }: OnboardingProgressBarProps) {
  return (
    <div className="flex items-center gap-2 justify-center" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemax={totalSteps}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === currentStep
              ? 'w-6 bg-primary'
              : i < currentStep
              ? 'w-2 bg-primary'
              : 'w-2 bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create all step components**

Create `frontend/src/components/features/Onboarding/steps/WelcomeStep.tsx`:
```typescript
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="rounded-full bg-primary/10 p-6">
        <TrendingUp className="h-12 w-12 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-3">Welcome to FinPulse</h1>
        <p className="text-muted-foreground max-w-md">
          Your AI-powered personal finance tracker. Let's set you up in under 2 minutes.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="w-full sm:w-auto">Get Started</Button>
    </div>
  );
}
```

Create `frontend/src/components/features/Onboarding/steps/ProfileStep.tsx`:
```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface ProfileStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD'];

export default function ProfileStep({ onNext, onSkip, onBack }: ProfileStepProps) {
  const { user, profile, setProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'PHP');
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    if (!user) return;
    setSaving(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, display_name: displayName, currency })
        .select()
        .single();
      if (data) setProfile(data);
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Your Profile</h2>
        <p className="text-muted-foreground text-sm">Tell us a little about yourself.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="mt-1" />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleNext} disabled={saving}>{saving ? 'Saving...' : 'Continue'}</Button>
        <div className="flex justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">Skip</button>
        </div>
      </div>
    </div>
  );
}
```

Create `frontend/src/components/features/Onboarding/steps/BudgetStep.tsx`:
```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface BudgetStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function BudgetStep({ onNext, onSkip, onBack }: BudgetStepProps) {
  const { user, profile } = useAuthStore();
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    if (!user || !budget) { onNext(); return; }
    setSaving(true);
    try {
      await supabase
        .from('user_profiles')
        .update({ monthly_budget_goal: parseFloat(budget) })
        .eq('id', user.id);
      onNext();
    } finally {
      setSaving(false);
    }
  }

  const currency = profile?.currency ?? 'PHP';

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Monthly Budget Goal</h2>
        <p className="text-muted-foreground text-sm">How much do you want to spend per month?</p>
      </div>
      <div>
        <Label htmlFor="budget">Budget ({currency})</Label>
        <Input
          id="budget"
          type="number"
          min="0"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g. 30000"
          className="mt-1 text-lg"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleNext} disabled={saving}>{saving ? 'Saving...' : 'Continue'}</Button>
        <div className="flex justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">Skip</button>
        </div>
      </div>
    </div>
  );
}
```

Create `frontend/src/components/features/Onboarding/steps/CategoriesStep.tsx`:
```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CategoriesStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const DEFAULT_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Entertainment', 'Shopping',
  'Utilities', 'Healthcare', 'Education', 'Personal Care', 'Travel', 'Others',
];

export default function CategoriesStep({ onNext, onSkip, onBack }: CategoriesStepProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Food & Dining', 'Transportation', 'Utilities']));

  function toggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Top Spending Categories</h2>
        <p className="text-muted-foreground text-sm">Pick the categories that apply to you. This helps prime your mental model.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              selected.has(cat)
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={onNext}>Continue</Button>
        <div className="flex justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">Skip</button>
        </div>
      </div>
    </div>
  );
}
```

Create `frontend/src/components/features/Onboarding/steps/FirstExpenseStep.tsx`:
```typescript
import { Button } from '@/components/ui/button';
import QuickCapture from '@/components/features/QuickCapture/QuickCapture';
import { useState } from 'react';

interface FirstExpenseStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function FirstExpenseStep({ onNext, onSkip, onBack }: FirstExpenseStepProps) {
  const [saved, setSaved] = useState(false);

  function handleExpenseSaved() {
    setSaved(true);
    setTimeout(onNext, 800);
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Add Your First Expense</h2>
        <p className="text-muted-foreground text-sm">Try typing something like "Jollibee lunch 250" — our AI will parse it for you.</p>
      </div>
      {saved ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center text-sm text-green-600 dark:text-green-400">
          Expense saved!
        </div>
      ) : (
        <QuickCapture onSaved={handleExpenseSaved} compact />
      )}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">Skip</button>
        </div>
      </div>
    </div>
  );
}
```

Create `frontend/src/components/features/Onboarding/steps/DoneStep.tsx`:
```typescript
import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DoneStepProps {
  onComplete: () => void;
}

export default function DoneStep({ onComplete }: DoneStepProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="rounded-full bg-green-500/10 p-6">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>
      <div>
        <h2 className="text-3xl font-bold mb-3">You're all set!</h2>
        <p className="text-muted-foreground">Taking you to your dashboard...</p>
      </div>
      <Button onClick={onComplete} variant="outline">Go to Dashboard</Button>
    </div>
  );
}
```

- [ ] **Step 4: Create main Onboarding.tsx stepper**

Create `frontend/src/components/features/Onboarding/Onboarding.tsx`:

```typescript
// Summary: Full-screen onboarding stepper. Shown to new users immediately after
// sign-in when onboarding_progress has no completed_at or skipped=true record.
// Guides through 6 steps: Welcome → Profile → Budget → Categories → First Expense → Done.

import { useState } from 'react';
import OnboardingProgressBar from './OnboardingProgressBar';
import WelcomeStep from './steps/WelcomeStep';
import ProfileStep from './steps/ProfileStep';
import BudgetStep from './steps/BudgetStep';
import CategoriesStep from './steps/CategoriesStep';
import FirstExpenseStep from './steps/FirstExpenseStep';
import DoneStep from './steps/DoneStep';

interface OnboardingProps {
  onComplete: () => void;
}

// Welcome has no skip/back; Done has no skip.
// Steps 1-4 (Profile, Budget, Categories, FirstExpense) have skip + back.
const STEPS = ['welcome', 'profile', 'budget', 'categories', 'firstExpense', 'done'] as const;
type Step = typeof STEPS[number];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  // Show progress for steps 1-4 (not welcome or done)
  const showProgress = stepIndex > 0 && stepIndex < STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {showProgress && (
          <div className="mb-8">
            <OnboardingProgressBar currentStep={stepIndex - 1} totalSteps={4} />
          </div>
        )}

        <div className="flex justify-center">
          {step === 'welcome' && <WelcomeStep onNext={next} />}
          {step === 'profile' && <ProfileStep onNext={next} onSkip={onComplete} onBack={back} />}
          {step === 'budget' && <BudgetStep onNext={next} onSkip={onComplete} onBack={back} />}
          {step === 'categories' && <CategoriesStep onNext={next} onSkip={onComplete} onBack={back} />}
          {step === 'firstExpense' && <FirstExpenseStep onNext={next} onSkip={onComplete} onBack={back} />}
          {step === 'done' && <DoneStep onComplete={onComplete} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Gate onboarding in AuthLayout**

Replace `frontend/src/components/layout/AuthLayout.tsx` with:

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useOnboarding } from '@/hooks/useOnboarding';
import Onboarding from '@/components/features/Onboarding/Onboarding';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLayout() {
  const { user } = useAuthStore();
  const { isComplete, loading, markComplete, markSkipped } = useOnboarding();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isComplete === false) {
    return <Onboarding onComplete={markComplete} />;
  }

  return <Outlet />;
}
```

- [ ] **Step 6: Check QuickCapture supports compact + onSaved props**

Read `frontend/src/components/features/QuickCapture/QuickCapture.tsx` and check if it accepts `compact` and `onSaved` props. If not, add them:

The `onSaved` prop should be called after a successful expense save. The `compact` prop makes the input inline (no modal). Add these props to the existing component interface and pass them through as needed.

- [ ] **Step 7: Test onboarding flow**

Create a fresh Supabase test user via the signup page:
1. Sign up new user
2. Onboarding should appear immediately
3. Navigate through all 6 steps
4. After completion, dashboard should load
5. Sign out and sign back in — onboarding should NOT show again

Also test: sign up, skip on every step → lands on dashboard, no repeat.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useOnboarding.ts \
        frontend/src/components/features/Onboarding/ \
        frontend/src/components/layout/AuthLayout.tsx
git commit -m "feat: add 6-step onboarding flow for new users"
```

---

## Task 8: Frontend — Visual Polish & Quota Display

Add page transitions, toast notifications for actions, skeleton loading consistency, chart animations, empty states, and quota display on the Analysis page.

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/pages/AnalysisPage.tsx`
- Modify: Various dashboard/expense components (audit pass)

- [ ] **Step 1: Add page transition CSS to index.css**

In `frontend/src/index.css`, add:

```css
/* Page transitions */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms ease, transform 200ms ease;
}
```

Then in `frontend/src/components/layout/MainLayout.tsx`, wrap the `<Outlet />` in an animated container:

```typescript
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

// Inside the component:
const location = useLocation();
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = contentRef.current;
  if (!el) return;
  el.classList.remove('page-enter-active');
  el.classList.add('page-enter');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.remove('page-enter');
      el.classList.add('page-enter-active');
    });
  });
}, [location.pathname]);

// In JSX, replace <Outlet /> with:
<div ref={contentRef} className="page-enter-active">
  <Outlet />
</div>
```

- [ ] **Step 2: Add quota display to AnalysisPage**

In `frontend/src/pages/AnalysisPage.tsx`, add a quota status section.

Add a `useQuota` hook inline or fetch quota from `/api/analysis/quota`:

```typescript
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Inside the component:
const [quota, setQuota] = useState<{
  expense_analysis: { used: number; limit: number; remaining: number };
  budget_recommendation: { used: number; limit: number; remaining: number };
  chat: { used: number; limit: number; remaining: number };
} | null>(null);

useEffect(() => {
  api.get('/api/analysis/quota').then((data) => setQuota(data)).catch(() => {});
}, []);

// In JSX, add a quota info bar near the analysis button:
{quota && (
  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
    <span>{quota.expense_analysis.remaining}/{quota.expense_analysis.limit} analyses remaining</span>
    <span>{quota.chat.remaining}/{quota.chat.limit} chat messages remaining</span>
  </div>
)}
```

When quota is exhausted (`remaining === 0`), show:
```typescript
<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
  Monthly analysis limit reached. Resets on the 1st of next month.
</div>
```

- [ ] **Step 3: Add toast notifications for key actions**

The app already has `sonner` Toaster in `App.tsx`. Import `toast` from `sonner` in components that need it.

Add `toast.success('Expense saved!')` after successful expense creation in:
- `frontend/src/components/features/QuickCapture/QuickCapture.tsx`
- `frontend/src/components/expenses/ExpenseForm.tsx`

Add `toast.success('Budget goal updated')` in `frontend/src/components/budget/BudgetGoalDialog.tsx` after save.

Add `toast.error('Something went wrong. Please try again.')` in catch blocks for AI analysis calls in `AnalysisPage.tsx`.

Add `toast.info('AI analysis started...')` when analysis is initiated.

Check each of these files first with Read to understand the current structure before adding toasts.

- [ ] **Step 4: Audit skeleton loading consistency**

Read each of these pages and check that every data-fetching section has `<Skeleton>` components during loading state:
- `DashboardPage.tsx`
- `ExpensesPage.tsx`
- `BudgetPage.tsx`
- `AnalysisPage.tsx`

For any section missing skeletons, add `<Skeleton className="h-N w-full" />` matching the expected content height.

- [ ] **Step 5: Add chart animations**

In all recharts components that use `<BarChart>`, `<LineChart>`, `<PieChart>`:
- Add `animationDuration={800}` to `<Bar>`, `<Line>`, `<Pie>` elements
- Ensure `<Tooltip>` components have `formatter` for currency display

Check these files:
- `frontend/src/components/dashboard/MonthlySpendingChart.tsx`
- `frontend/src/components/dashboard/CategoryBreakdownChart.tsx`

- [ ] **Step 6: Add empty state messages**

For each empty state (no expenses, no budget goals, no journal entries), verify there is a descriptive message + CTA. If any are missing, add:

```typescript
// Example for no expenses state:
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Receipt className="h-12 w-12 text-muted-foreground/40 mb-4" />
  <h3 className="font-medium mb-1">No expenses yet</h3>
  <p className="text-sm text-muted-foreground mb-4">Start tracking by adding your first expense.</p>
  <Button size="sm" onClick={() => setShowQuickCapture(true)}>Add Expense</Button>
</div>
```

- [ ] **Step 7: Dark mode audit**

Toggle to dark mode and visit each page. Check for:
- Hardcoded hex colors that don't adapt (replace with Tailwind classes using `dark:` prefix)
- Chart axis/legend readability in dark mode
- Any white backgrounds that should be `bg-background`

Common fixes needed:
- In recharts components, text/axis colors should use CSS variables: `fill="currentColor"` or check `stroke` colors
- Badge colors should use Tailwind semantic classes not hardcoded hex

- [ ] **Step 8: Commit**

```bash
git add frontend/src/index.css \
        frontend/src/pages/AnalysisPage.tsx \
        frontend/src/components/layout/MainLayout.tsx
git commit -m "feat: add page transitions, quota display, toasts, chart animations, and visual polish"
```

---

## Task 9: Final Validation

Run through all 15 validation tests from the phase-7 spec before marking the phase complete.

**Files:** No changes — this is a validation-only task.

- [ ] **Test 1: New user onboarding flow**
  Sign up new user → onboarding appears → navigate all 6 steps → dashboard loads → no repeat on next login.

- [ ] **Test 2: Skip flow**
  Sign up → skip all skippable steps → dashboard loads → `onboarding_progress.skipped = true`.

- [ ] **Test 3: Existing user not affected**
  Log in with Bronn's account → no onboarding → dashboard loads normally.

- [ ] **Test 4: Landing page (unauthenticated)**
  Visit `/` while logged out → landing page shows → "Get Started" links to `/signup` → "Try Demo" links to `/demo` → responsive at 375px/768px/1440px.

- [ ] **Test 5: Landing page (authenticated redirect)**
  Visit `/` while logged in → redirects to `/app`.

- [ ] **Test 6: Demo mode data display**
  Visit `/demo` while logged out → charts, expense list, budget cards render with demo data → banner shows → interactive elements disabled.

- [ ] **Test 7: Demo mode no writes**
  In demo mode → cannot add/edit/delete → AI analysis shows "Sign up" → no auth errors.

- [ ] **Test 8: Dark mode toggle**
  Toggle from settings → all pages switch → charts readable → preference persists across reload.

- [ ] **Test 9: Dark mode system preference**
  Set to "System" → change OS dark mode → app follows without refresh.

- [ ] **Test 10: Quota enforcement**
  (Temporarily lower limit to 2 in settings.py) → 3rd analysis returns 429 → frontend shows "limit reached".

- [ ] **Test 11: Quota display**
  Use some AI features → Analysis page shows updated `X/10 remaining`.

- [ ] **Test 12: Toast notifications**
  Save expense → success toast → delete expense → neutral toast → trigger analysis → info toast.

- [ ] **Test 13: Page transitions**
  Navigate Dashboard → Expenses → Budget → Analysis → smooth fade/slide, no flash.

- [ ] **Test 14: Multi-user data isolation**
  Create User A + User B with different expenses → User A sees only their data.

- [ ] **Test 15: End-to-end new user journey**
  Landing → Try Demo → Sign Up → Onboarding → 3 expenses → 2 budget goals → AI chat → under 5 min, no errors.

- [ ] **Step: Commit any final fixes**

```bash
git add -A
git commit -m "fix: phase 7 validation fixes"
```

---

## Summary

| Task | What It Builds | Key Files |
|------|---------------|-----------|
| 1 | Database tables | Supabase SQL + models.py |
| 2 | Demo endpoint (public) | demo_urls.py, expenses/views.py, middleware.py |
| 3 | Usage quotas | services/quota.py, analysis/views.py, settings.py |
| 4 | Dark mode | ThemeProvider.tsx, App.tsx, MainLayout.tsx, SettingsPage.tsx |
| 5 | Landing page | LandingPage.tsx, App.tsx routing |
| 6 | Demo page | DemoPage.tsx |
| 7 | Onboarding flow | Onboarding/* components, useOnboarding.ts, AuthLayout.tsx |
| 8 | Visual polish | index.css, AnalysisPage.tsx, chart components |
| 9 | Validation | Manual test pass for all 15 tests |
