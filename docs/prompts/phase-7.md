# Phase 7 Prompt — Marketable Polish (Week 8–9)

> **Goal:** Transform the personal tool into something other people would want to use. Multi-user onboarding, public landing page, demo mode, and visual polish.
> **Prerequisites:** Phase 6 complete — AI chat working, weekly digests generating, improved analysis prompts live.

---

## Context Files to Read First

1. `product-brief.md` — "Future: potential SaaS product" and design principles
2. `architecture.md` — ADR-001 (hybrid backend already supports multi-user via RLS)
3. `database-schema.md` — RLS policies already scope data per user

---

## Database Changes

### New table: `onboarding_progress`

Tracks where each new user is in the onboarding flow.

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

### New table: `demo_expenses` (read-only seed data for demo mode)

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

-- No RLS — demo data is public read-only
-- Seed data is inserted below in Step 3
```

### Django model mirrors

```python
# apps/users/models.py — add
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

---

## Step-by-Step Implementation

### Step 1: Build the Onboarding Flow (Frontend)

New users currently land on an empty dashboard after sign-up. That's a dead-end — no data, no value, no direction. The onboarding flow guides them to first value in under 2 minutes.

**Onboarding steps:**

| Step | Screen | What It Collects |
|---|---|---|
| 1. Welcome | "Welcome to FinPulse" + value proposition | Nothing (just a continue button) |
| 2. Profile | Display name + currency selector | display_name, currency |
| 3. Budget | "Set your monthly budget goal" + slider or input | monthly_budget_goal |
| 4. Categories | "Pick your top spending categories" + multi-select from defaults | (pre-selection, no DB change — just primes their mental model) |
| 5. First Expense | Quick capture input: "Add your first expense" | Creates first expense via quick capture |
| 6. Done | "You're all set!" + dashboard redirect | Marks onboarding complete |

**Create `src/components/features/Onboarding.tsx`:**

This is a full-screen stepper that overlays the app when the user hasn't completed onboarding.

```typescript
// Component structure
Onboarding/
├── Onboarding.tsx           — Main stepper wrapper
├── steps/
│   ├── WelcomeStep.tsx      — Logo + value prop + Continue
│   ├── ProfileStep.tsx      — Name + currency form
│   ├── BudgetStep.tsx       — Monthly budget goal slider
│   ├── CategoriesStep.tsx   — Category multi-select
│   ├── FirstExpenseStep.tsx  — Quick capture for first expense
│   └── DoneStep.tsx         — Success + redirect
└── OnboardingProgress.tsx   — Step indicator dots
```

**Key UX details:**
- Progress indicator at the top: dots or a progress bar (● ● ○ ○ ○ ○)
- Each step has a "Continue" button and a "Skip" link (except Welcome and Done)
- Skipping any step marks it skipped in `onboarding_progress` and moves forward
- Back button on steps 2–5
- Step 5 (First Expense) uses the QuickCapture component from Phase 5
- Step 6 auto-redirects to dashboard after 2 seconds

**When to show onboarding:**
```typescript
// In AuthLayout or App.tsx
const { profile } = useAuthStore();
const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

useEffect(() => {
    async function checkOnboarding() {
        const { data } = await supabase
            .from('onboarding_progress')
            .select('completed_at, skipped')
            .eq('user_id', profile.id)
            .single();

        if (!data) {
            // No onboarding record — new user, create one and show onboarding
            await supabase.from('onboarding_progress').insert({
                user_id: profile.id,
                step: 'welcome'
            });
            setOnboardingComplete(false);
        } else if (data.completed_at || data.skipped) {
            setOnboardingComplete(true);
        } else {
            setOnboardingComplete(false);
        }
    }
    if (profile) checkOnboarding();
}, [profile]);

if (onboardingComplete === false) return <Onboarding />;
```

**On onboarding completion:**
```typescript
await supabase
    .from('onboarding_progress')
    .update({ completed_at: new Date().toISOString(), step: 'done' })
    .eq('user_id', user.id);
```

### Step 2: Build the Landing Page (Frontend)

Create a public landing page that lives at the root URL for unauthenticated users. Authenticated users go straight to the dashboard.

**Route structure update:**
```
/                → LandingPage (public) | DashboardPage (authenticated)
/login           → LoginPage (public)
/signup          → SignUpPage (public)
/demo            → DemoPage (public, read-only)
/app/*           → Protected app routes (dashboard, expenses, journal, budget, analysis, settings)
```

**LandingPage sections (single scrollable page):**

1. **Hero section:**
   - Headline: "Track smarter. Spend wiser."
   - Subheadline: "AI-powered expense tracking that understands your spending patterns and gives you advice that actually works."
   - Two CTAs: "Get Started" (→ /signup) and "Try Demo" (→ /demo)
   - Hero visual: screenshot or mockup of the dashboard with charts and quick capture

2. **Features section:**
   Three feature cards:
   - "Quick capture" — "Log an expense in 3 seconds. Just type what you spent."
   - "AI insights" — "Get spending analysis grounded in your actual data, not generic tips."
   - "Budget tracking" — "Set goals, track progress, get recommendations to stay on track."

3. **How it works section:**
   Three-step visual:
   - Step 1: "Track your expenses" (quick capture screenshot)
   - Step 2: "AI analyzes your patterns" (analysis screenshot)
   - Step 3: "Get actionable recommendations" (chat screenshot)

4. **CTA section:**
   - "Start tracking for free" button (→ /signup)

**Implementation notes:**
- This is a static page — no API calls, no auth needed
- Use Tailwind for layout, minimal custom CSS
- Mobile-responsive: single column on mobile, multi-column on desktop
- No animations beyond subtle fade-in-on-scroll (use CSS `@keyframes` + `IntersectionObserver`, not a library)
- Keep the page fast — no heavy images. Use SVG illustrations or CSS-drawn shapes

### Step 3: Build Demo Mode (Frontend + Django)

Demo mode lets potential users explore the app with pre-seeded data without signing up. All data is read-only.

**Seed demo data:**

```sql
-- Insert into demo_expenses (60 expenses across 2 months, realistic patterns)
INSERT INTO demo_expenses (category_name, amount, description, expense_date) VALUES
    -- March 2026 (current month)
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
    -- February 2026 (previous month, for trend comparison)
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

**Django demo endpoint:**

```python
# apps/expenses/views.py — add:

@api_view(['GET'])
def demo_data(request):
    """
    GET /api/demo/data

    Returns pre-seeded demo data for the demo page. No auth required.
    This endpoint is public.

    Output:
        200: {
            expenses: [...],
            budget_goals: [...],
            monthly_summary: {...},
            category_breakdown: [...]
        }
    """
    with connection.cursor() as cursor:
        # Fetch demo expenses
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

        # Compute summary for current month demo data
        cursor.execute("""
            SELECT
                COALESCE(SUM(amount), 0) AS total,
                COUNT(*) AS count,
                COALESCE(SUM(amount) / GREATEST(EXTRACT(DAY FROM CURRENT_DATE), 1), 0) AS daily_avg
            FROM demo_expenses
            WHERE expense_date >= DATE_TRUNC('month', CURRENT_DATE)
        """)
        summary_row = cursor.fetchone()

        # Category breakdown
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

    # Fake budget goals for demo
    demo_goals = [
        {"category": "Food & Dining", "goal": 12000, "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Food & Dining" and e["expense_date"] >= date.today().replace(day=1).isoformat())},
        {"category": "Transportation", "goal": 5000, "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Transportation" and e["expense_date"] >= date.today().replace(day=1).isoformat())},
        {"category": "Entertainment", "goal": 3000, "spent": sum(e["amount"] for e in expenses if e["category_name"] == "Entertainment" and e["expense_date"] >= date.today().replace(day=1).isoformat())},
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

**Important:** Exclude this endpoint from the `SupabaseAuthMiddleware`. Add a path check:
```python
# In SupabaseAuthMiddleware.__call__:
if request.path.startswith('/api/') and not request.path.startswith('/api/demo/'):
    # ... auth logic
```

**Register URL:**
```python
# core/urls.py — add:
path('api/demo/', include('apps.expenses.demo_urls')),

# apps/expenses/demo_urls.py (new file):
from django.urls import path
from . import views

urlpatterns = [
    path('data', views.demo_data),
]
```

**Frontend demo page (`/demo`):**

Create a read-only version of the dashboard that uses demo data:
- Fetch from `GET /api/demo/data` (no auth)
- Render the same dashboard components (summary cards, charts, budget progress, expense list)
- All interactive elements are disabled or show a tooltip: "Sign up to use this feature"
- Quick capture input shows a demo: animated typing "jollibee lunch 250" → parsed result card
- Banner at the top: "You're viewing a demo. [Sign Up] to start tracking your own finances."
- Chat shows a sample conversation (static, pre-written)

### Step 4: Dark Mode

shadcn/ui has built-in dark mode support. Enable it:

**Add a theme provider and toggle:**

```typescript
// src/components/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (theme: Theme) => void;
}>({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(
        () => (window.localStorage.getItem('theme') as Theme) || 'system'
    );

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }

        window.localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
```

**Add theme toggle to Settings page and to the navigation header** (sun/moon icon button).

**Audit all custom colors:**
- Category colors (from seed data: `#EF9F27`, `#378ADD`, etc.) must be readable in both light and dark mode
- Chart colors in recharts must work on both backgrounds
- Budget progress bar colors (green/yellow/red) must have sufficient contrast in dark mode
- Quick capture preview card must be readable in dark mode

### Step 5: Visual Polish & Micro-Interactions

**Page transitions:**
Use CSS transitions on route changes. Wrap route content in a fade container:
```css
.page-enter { opacity: 0; transform: translateY(8px); }
.page-enter-active { opacity: 1; transform: translateY(0); transition: opacity 200ms, transform 200ms; }
```

**Skeleton loading consistency:**
Audit all pages — every data-fetching component should show shadcn `Skeleton` components during loading. Ensure skeleton shapes match the final content layout (same heights, widths, spacing).

**Toast notifications:**
Use shadcn's toast component (or install `sonner` for a lighter alternative):
```bash
cd frontend && npx shadcn@latest add sonner
```

Add toasts for:
- Expense saved (success)
- Expense deleted (neutral with undo option)
- Budget goal updated (success)
- AI analysis started (info)
- Error states (destructive)

**Empty state illustrations:**
For each empty state (no expenses, no journal entries, no budget goals), add a simple SVG illustration or lucide icon composition + descriptive text + CTA button.

**Chart visual upgrade:**
- Add smooth animations to recharts charts (use `animationDuration={800}`)
- Add hover tooltips with formatted currency values
- Donut chart: add center label showing total
- Bar chart: add value labels on top of bars

### Step 6: Usage Quotas (Pre-SaaS Preparation)

Add a quota system to LLM endpoints. This doesn't enforce payments yet — it just tracks usage and sets limits.

**Add to Django settings:**
```python
# Free tier limits (per user per month)
AI_MONTHLY_ANALYSIS_LIMIT = 10   # Expense analyses
AI_MONTHLY_RECOMMENDATION_LIMIT = 10  # Budget recommendations
AI_MONTHLY_CHAT_LIMIT = 50  # Chat messages
AI_MONTHLY_DIGEST_LIMIT = 4  # Weekly digests (auto, ~1/week)
```

**Create a quota check utility:**
```python
# backend/services/quota.py
from django.db import connection
from django.conf import settings
from datetime import date

def check_quota(user_id: str, analysis_type: str) -> dict:
    """
    Check if a user has remaining quota for an AI feature.

    Returns:
        { "allowed": bool, "used": int, "limit": int, "remaining": int }
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

**Apply to all AI endpoints:**
```python
# At the top of each AI view:
from services.quota import check_quota

quota = check_quota(request.user_id, 'expense_analysis')
if not quota['allowed']:
    return Response({
        'error': 'Monthly analysis limit reached.',
        'quota': quota,
    }, status=429)
```

**Frontend: show remaining quota on the Analysis page:**
Create a small "X/10 analyses remaining this month" indicator on the Analysis page and in the chat interface.

**Add a quota endpoint:**
```python
# apps/analysis/views.py
@api_view(['GET'])
def usage_quota(request):
    """
    GET /api/analysis/quota

    Returns current month's AI usage for the authenticated user.
    """
    user_id = request.user_id
    return Response({
        'expense_analysis': check_quota(user_id, 'expense_analysis'),
        'budget_recommendation': check_quota(user_id, 'budget_recommendation'),
        'chat': check_quota(user_id, 'chat'),
    }, status=200)
```

---

## Validation Tests

### Test 1: Onboarding — New User Flow
```
Action: Sign up a new user account
Expected:
  - Onboarding screen appears immediately after signup
  - Can navigate through all 6 steps
  - Profile data saved correctly (name, currency, budget goal)
  - First expense created via quick capture in step 5
  - After completion, redirected to dashboard with data visible
  - Onboarding does NOT show again on subsequent logins
```

### Test 2: Onboarding — Skip Flow
```
Action: Sign up a new user, click "Skip" on every skippable step
Expected:
  - Skipping works on steps 2-5
  - After skipping all, lands on dashboard
  - onboarding_progress.skipped = true
  - Onboarding does not show again
  - App still works (default currency PHP, no budget goal set)
```

### Test 3: Onboarding — Existing User Not Affected
```
Action: Log in with the original (Bronn's) account
Expected:
  - No onboarding screen appears
  - Dashboard loads normally
```

### Test 4: Landing Page — Unauthenticated
```
Action: Visit the root URL while logged out
Expected:
  - Landing page displays with hero, features, how-it-works, CTA
  - "Get Started" links to /signup
  - "Try Demo" links to /demo
  - Page is fully responsive (test at 375px, 768px, 1440px)
  - No API calls made, no auth required
```

### Test 5: Landing Page — Authenticated Redirect
```
Action: Visit the root URL while logged in
Expected:
  - Redirected to dashboard (not landing page)
```

### Test 6: Demo Mode — Data Display
```
Action: Visit /demo while logged out
Expected:
  - Dashboard renders with demo data (charts, expense list, budget cards)
  - Monthly summary shows correct totals from demo_expenses
  - Charts render with demo data
  - All interactive elements disabled or show "Sign up" tooltip
  - Banner at top with "Sign Up" CTA
  - Quick capture shows animated demo
```

### Test 7: Demo Mode — No Write Operations
```
Action: In demo mode, attempt to interact with forms
Expected:
  - Cannot add, edit, or delete expenses
  - Cannot trigger AI analysis (shows "Sign up to use AI features")
  - Cannot access settings
  - No auth-related errors or crashes
```

### Test 8: Dark Mode
```
Action: Toggle dark mode from settings or header
Expected:
  - All pages switch to dark theme
  - Charts are readable (check axis labels, legend, tooltips)
  - Category color badges are readable on dark backgrounds
  - Quick capture input and preview card work in dark mode
  - Budget progress bars have sufficient contrast
  - Preference persists across page reloads and sessions
```

### Test 9: Dark Mode — System Preference
```
Action: Set theme to "System", then change OS dark mode preference
Expected:
  - App follows OS preference
  - Switching OS preference updates app theme without refresh (via matchMedia listener)
```

### Test 10: Quota Enforcement
```
Action: Trigger 11 expense analyses in one month (with limit set to 10)
Expected:
  - First 10 succeed
  - 11th returns 429 with quota information
  - Frontend shows "Monthly limit reached" message with quota details
  - Chat has its own separate quota (50 messages)
```

### Test 11: Quota Display
```
Action: Use some AI features, then check the Analysis page
Expected:
  - Quota indicator shows "X/10 remaining" for analyses
  - Quota indicator shows "X/50 remaining" for chat messages
  - Numbers update after each use
```

### Test 12: Toast Notifications
```
Action: Perform various actions: save expense, delete expense, trigger analysis
Expected:
  - Each action shows an appropriate toast notification
  - Toasts auto-dismiss after 3-5 seconds
  - Toasts are visible in both light and dark mode
  - Delete toast includes "Undo" option (optional but nice)
```

### Test 13: Page Transitions
```
Action: Navigate between Dashboard → Expenses → Budget → Analysis
Expected:
  - Smooth fade/slide transition between pages (no harsh jumps)
  - No flash of unstyled content
  - Back navigation (browser back button) works correctly
```

### Test 14: Full Multi-User Isolation
```
Action:
  1. Create User A, add 5 expenses and a budget goal
  2. Create User B, add 3 different expenses
  3. Log in as User A
Expected:
  - User A sees only their 5 expenses
  - User A's budget shows only their spending
  - User A's AI analysis references only their data
  - No data leakage from User B
```

### Test 15: End-to-End New User Journey
```
Action: Full journey as a brand new user:
  1. Visit landing page
  2. Click "Try Demo" — explore demo
  3. Click "Sign Up" — create account
  4. Complete onboarding (all steps)
  5. Add 3 expenses via quick capture
  6. Set 2 budget goals
  7. Ask the AI chat "How am I doing?"
Expected:
  - Entire journey works without errors
  - AI chat responds meaningfully even with limited data
  - Budget page shows correct data
  - Total time: under 5 minutes
```

---

## Code Quality Reminders

- Landing page must load fast — no unnecessary JS bundles. Consider code-splitting: the landing page should not load React components used only inside the app.
- Demo mode must NEVER write to real tables. Double-check that the demo endpoint only reads from `demo_expenses` and computes in-memory.
- Dark mode: test EVERY page in dark mode before marking this phase complete. The most common failures are hardcoded colors in custom components and chart configurations.
- Onboarding should gracefully handle edge cases: user refreshes mid-onboarding, user closes browser and returns, user signs out during onboarding.
- Quota limits are configurable via Django settings. When SaaS conversion happens, these become plan-based (free tier vs paid tier). The `check_quota` function is structured to accept plan-based limits later.
- The landing page is a marketing asset. Spend time on copy and layout — it's the first thing potential users see. Bad landing page = no signups regardless of how good the product is.