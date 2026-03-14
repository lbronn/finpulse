# Phase 1 Prompt — Foundation (Week 1)

> **Goal:** Project scaffolding, authentication, and basic data entry (expenses + journal) working end-to-end.
> **Prerequisites:** Supabase project created, database migration run (see database_schema.md), environment variables configured.

---

## Context Files to Read First

Before starting any implementation, read these files in order:
1. `product-brief.md` — what we're building and why
2. `prd.md` — detailed feature specs and data models
3. `architecture.md` — key technical decisions (especially ADR-001 and ADR-002)
4. `database_schema.md` — table definitions and RLS policies

---

## Environment Variables Required

Create a `.env` file at the project root with these values (Bronn will provide the actual values):

```
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Django
DJANGO_SECRET_KEY=generate-a-random-key
DJANGO_DEBUG=True
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

---

## Step-by-Step Implementation

### Step 1: Scaffold the Monorepo

Create the following project structure:

```
finance-app/
├── frontend/          # React.TS + Vite
├── backend/           # Django + DRF
├── supabase/          # Migration SQL files
├── docs/              # These documentation files
├── .env.example
├── .gitignore
├── Makefile
└── README.md
```

Create a `Makefile` with common commands:
```makefile
.PHONY: dev-frontend dev-backend dev install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && pip install -r requirements.txt

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && python manage.py runserver 8000

dev:
	make dev-frontend & make dev-backend
```

Create a `.gitignore` covering both Python and Node.js artifacts, `.env`, `node_modules/`, `__pycache__/`, `.venv/`, `dist/`, etc.

### Step 2: Scaffold Frontend (React.TS + Vite + Tailwind + shadcn/ui)

Initialize the frontend:
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install @supabase/supabase-js zustand react-router-dom
npm install lucide-react
```

Set up Tailwind CSS with the Vite plugin approach (Tailwind v4):
- Add the Tailwind plugin to `vite.config.ts`
- Add `@import "tailwindcss"` to the main CSS file

Set up shadcn/ui:
```bash
npx shadcn@latest init
```
- When prompted: select New York style, Zinc base color, and CSS variables enabled.
- Install commonly used components:
```bash
npx shadcn@latest add button card input label select textarea dialog alert badge tabs progress separator
```

Create the Supabase client at `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Create the Django API client at `src/lib/api.ts`:
```typescript
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }
    return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

export const api = {
    async get<T>(path: string): Promise<T> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}${path}`, { headers });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    },
    async post<T>(path: string, body: unknown): Promise<T> {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    },
};
```

Create TypeScript type definitions at `src/types/index.ts` matching the data models in prd.md section 3.

### Step 3: Set Up Routing and Layout

Use `react-router-dom` v6+ with the following route structure:

```
/login        → LoginPage (public)
/signup       → SignUpPage (public)
/             → DashboardPage (protected)
/expenses     → ExpensesPage (protected)
/journal      → JournalPage (protected)
/budget       → BudgetPage (protected)
/analysis     → AnalysisPage (protected)
/settings     → SettingsPage (protected)
```

Create an `AuthLayout` wrapper that:
- Checks for active Supabase session
- Redirects to `/login` if no session
- Renders child routes if authenticated

Create a `MainLayout` with:
- Sidebar or bottom navigation (mobile-first — use bottom nav for mobile, sidebar for desktop)
- Navigation links to all protected routes
- User display name + logout button

### Step 4: Implement Authentication

Build `/login` and `/signup` pages using Supabase Auth:

**Sign Up Flow:**
1. User fills email + password + display name
2. Call `supabase.auth.signUp({ email, password })`
3. On success, create a `user_profiles` row with display name
4. Redirect to `/`

**Sign In Flow:**
1. User fills email + password
2. Call `supabase.auth.signInWithPassword({ email, password })`
3. On success, redirect to `/`

**Auth State Management:**
Create a Zustand store at `src/stores/authStore.ts`:
```typescript
interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    initialize: () => Promise<void>;
    signOut: () => Promise<void>;
}
```

Subscribe to `supabase.auth.onAuthStateChange()` in the store's `initialize` method to keep auth state in sync.

### Step 5: Build Expense Tracker (CRUD)

Implement the Expenses page (`/expenses`) with these components:

1. **ExpenseList** — displays expenses in a table or card list, sorted by date DESC. Include:
   - Category badge (colored pill with category name)
   - Amount (formatted in user's currency)
   - Description
   - Date
   - Edit and Delete action buttons

2. **ExpenseForm** — modal dialog (shadcn Dialog) for adding/editing expenses:
   - Amount input (number, required)
   - Description input (text, required)
   - Category select (populated from `categories` table)
   - Date picker (defaults to today)
   - Notes textarea (optional)
   - Form validation with error messages

3. **ExpenseFilters** — filter bar above the list:
   - Category dropdown filter
   - Date range picker (start date, end date)
   - Clear filters button

**Data fetching pattern** (use for all Supabase CRUD):
```typescript
// src/hooks/useExpenses.ts
export function useExpenses() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchExpenses(filters?: ExpenseFilters) {
        setLoading(true);
        let query = supabase
            .from('expenses')
            .select('*, categories(name, icon, color)')
            .order('expense_date', { ascending: false });

        if (filters?.categoryId) {
            query = query.eq('category_id', filters.categoryId);
        }
        if (filters?.startDate) {
            query = query.gte('expense_date', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('expense_date', filters.endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        setExpenses(data || []);
        setLoading(false);
    }

    // ... createExpense, updateExpense, deleteExpense

    return { expenses, loading, fetchExpenses, createExpense, updateExpense, deleteExpense };
}
```

### Step 6: Build Journal (CRUD)

Implement the Journal page (`/journal`) with the same pattern as expenses:

1. **JournalList** — entries displayed as cards (title, date, tags, content preview)
2. **JournalForm** — dialog for adding/editing entries (title, content, tags, date)
3. **TagFilter** — clickable tag pills to filter by tag

Tag input component: simple text input where pressing Enter adds a tag as a badge. Clicking the badge removes it.

### Step 7: Build Dashboard Shell

Create a minimal dashboard at `/` showing:
- Welcome message with user's display name
- Quick "Add Expense" button (opens ExpenseForm dialog)
- Summary cards: total spent this month, number of expenses, number of journal entries
- Recent expenses (last 5)

The summary data comes from Supabase queries on the frontend (simple count/sum aggregations). The more complex aggregation endpoints come in Phase 2.

### Step 8: Scaffold Django Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install django djangorestframework django-cors-headers psycopg2-binary python-dotenv PyJWT
pip freeze > requirements.txt
django-admin startproject core .
```

Configure `core/settings.py`:
- Load env vars from `.env` (using `python-dotenv`)
- Set `DATABASE_URL` to point at Supabase Postgres
- Add `rest_framework` and `corsheaders` to `INSTALLED_APPS`
- Add CORS middleware and configure `CORS_ALLOWED_ORIGINS`
- Add `SupabaseAuthMiddleware` to `MIDDLEWARE` (see architecture.md ADR-002)

Create Django apps:
```bash
python manage.py startapp expenses apps/expenses
python manage.py startapp journal apps/journal
python manage.py startapp budgets apps/budgets
python manage.py startapp analysis apps/analysis
python manage.py startapp users apps/users
```

Create the Supabase JWT auth middleware at `apps/users/middleware.py` (see architecture.md ADR-002 for the implementation).

Create unmanaged Django models for each table (see architecture.md ADR-005). These are needed for Phase 2 aggregation queries.

At this stage, Django doesn't need any API endpoints yet — just confirm it starts, connects to the database, and the middleware works.

---

## Phase 1 Acceptance Criteria

- [ ] Monorepo structure created and both services start locally
- [ ] Frontend loads with Tailwind + shadcn/ui styled correctly
- [ ] Supabase Auth: user can sign up, sign in, sign out
- [ ] Protected routes redirect unauthenticated users to login
- [ ] Expense CRUD: create, read (with filters), update, delete — all via Supabase client
- [ ] Journal CRUD: create, read (with tag filter), update, delete — all via Supabase client
- [ ] Dashboard shows basic summary stats and quick-add expense
- [ ] Django project starts and connects to Supabase Postgres
- [ ] Django JWT middleware validates Supabase tokens correctly
- [ ] RLS policies enforce data isolation (test: one user cannot see another's data)
- [ ] TypeScript types match the database schema exactly
- [ ] No TypeScript errors, no console errors in browser

---

## Code Quality Reminders

- Use TypeScript strict mode
- All Supabase queries must handle errors explicitly (no silent failures)
- Every form must have loading states and validation error displays
- Use shadcn/ui components consistently — don't mix custom styles with shadcn patterns
- Mobile-first: design for 375px width first, then scale up