# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the FinPulse monorepo, implement Supabase Auth, build Expense + Journal CRUD via Supabase JS client, create a Dashboard shell, and scaffold the Django backend with JWT middleware — all working end-to-end locally.

**Architecture:** Hybrid backend — frontend talks directly to Supabase JS client for CRUD (with RLS) and to Django REST API for complex operations. Auth is unified via Supabase JWTs that Django validates through custom SupabaseAuthMiddleware. Django models are `managed = False` (Supabase owns the schema).

**Tech Stack:** React 18 + TypeScript (strict), Vite 5, Tailwind CSS v4, shadcn/ui (New York style, Zinc), Zustand, react-router-dom v6, @supabase/supabase-js, Django 5.x, Django REST Framework, PyJWT, psycopg2-binary

---

## Pre-flight Checklist

Before running any tasks, verify:
- [ ] Supabase project created and migration SQL from `docs/database-schema.md` has been run in Supabase SQL Editor
- [ ] `.env` file has real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values ✅ (already set)
- [ ] `.env` has `SUPABASE_JWT_SECRET` set to the real value from Supabase Dashboard → Settings → API → JWT Secret ✅ (already set)
- [ ] `.env` `DATABASE_URL` updated with real Supabase Postgres connection string (Supabase Dashboard → Settings → Database → Connection string → URI)
- [ ] Node.js 18+ and Python 3.11+ installed

---

## File Map

### Files to Create

**Monorepo root:**
- `Makefile` — dev commands
- `.env.example` — template for env vars
- `supabase/migrations/001_initial_schema.sql` — migration SQL

**Frontend (`frontend/`):**
- `frontend/src/lib/supabase.ts` — Supabase client singleton
- `frontend/src/lib/api.ts` — Django API client with auth headers
- `frontend/src/types/index.ts` — TypeScript interfaces matching DB schema
- `frontend/src/stores/authStore.ts` — Zustand auth state
- `frontend/src/components/layout/AuthLayout.tsx` — session guard
- `frontend/src/components/layout/MainLayout.tsx` — nav sidebar/bottom-nav
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/SignUpPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/ExpensesPage.tsx`
- `frontend/src/pages/JournalPage.tsx`
- `frontend/src/pages/BudgetPage.tsx` — stub only (Phase 2)
- `frontend/src/pages/AnalysisPage.tsx` — stub only (Phase 3)
- `frontend/src/pages/SettingsPage.tsx` — stub only (Phase 4)
- `frontend/src/hooks/useExpenses.ts`
- `frontend/src/hooks/useJournalEntries.ts`
- `frontend/src/hooks/useCategories.ts`
- `frontend/src/components/expenses/ExpenseList.tsx`
- `frontend/src/components/expenses/ExpenseForm.tsx`
- `frontend/src/components/expenses/ExpenseFilters.tsx`
- `frontend/src/components/journal/JournalList.tsx`
- `frontend/src/components/journal/JournalForm.tsx`
- `frontend/src/components/journal/TagFilter.tsx`
- `frontend/src/components/journal/TagInput.tsx`
- `frontend/src/components/dashboard/SummaryCard.tsx`
- `frontend/src/components/dashboard/RecentExpenses.tsx`
- `frontend/src/App.tsx` — router config
- `frontend/src/main.tsx` — app entry point
- `frontend/index.html`
- `frontend/.env.local` — symlink/copy of root .env for Vite
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/src/index.css` — Tailwind import

**Backend (`backend/`):**
- `backend/core/settings.py` — Django settings
- `backend/core/urls.py` — URL routing
- `backend/core/wsgi.py`
- `backend/apps/users/middleware.py` — SupabaseAuthMiddleware
- `backend/apps/expenses/models.py` — unmanaged Expense, Category models
- `backend/apps/journal/models.py` — unmanaged JournalEntry model
- `backend/apps/budgets/models.py` — unmanaged BudgetGoal model
- `backend/apps/analysis/models.py` — unmanaged AnalysisHistory model
- `backend/apps/users/models.py` — unmanaged UserProfile model
- `backend/requirements.txt`
- `backend/manage.py`
- `backend/.python-version` (optional, set to 3.11)

---

## Chunk 1: Monorepo Foundation + Frontend Scaffold

### Task 1: Update .gitignore and Create Monorepo Files

**Files:**
- Modify: `.gitignore`
- Create: `Makefile`
- Create: `.env.example`
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Update `.gitignore`** with complete Python + Node coverage

Replace current contents with:
```gitignore
# ENV
.env
.env.local
.env.*.local

# Node
node_modules/
dist/
build/
.vite/

# Python
__pycache__/
*.py[cod]
*.pyo
.venv/
venv/
*.egg-info/
.eggs/
*.egg
dist/

# Django
*.sqlite3

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Logs
*.log
logs/
cache/

# Coverage
.coverage
htmlcov/
```

- [ ] **Step 2: Create `Makefile`**

```makefile
.PHONY: dev-frontend dev-backend dev install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && pip install -r requirements.txt

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && source .venv/bin/activate && python manage.py runserver 8000

dev:
	make dev-frontend & make dev-backend
```

- [ ] **Step 3: Create `.env.example`**

```env
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

# Frontend Django API URL
VITE_API_BASE_URL=http://localhost:8000/api
```

- [ ] **Step 4: Copy migration SQL to `supabase/migrations/001_initial_schema.sql`**

Create `supabase/migrations/` directory and copy the full SQL from `docs/database-schema.md` into `001_initial_schema.sql`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore Makefile .env.example supabase/
git commit -m "chore: add monorepo scaffolding files"
```

---

### Task 2: Initialize Frontend (Vite + React.TS)

**Files:**
- Create: `frontend/` (entire Vite project)

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /Users/bronny/SaaSProjects/finpulse
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install core dependencies**

```bash
cd frontend
npm install
npm install @supabase/supabase-js zustand react-router-dom lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure `vite.config.ts`** with Tailwind plugin

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Note: Add `path` types: `npm install -D @types/node`

- [ ] **Step 4: Update `frontend/src/index.css`** to import Tailwind

Replace all contents with:
```css
@import "tailwindcss";
```

- [ ] **Step 5: Update `frontend/tsconfig.json`** for strict mode + path aliases

Ensure these options exist in `compilerOptions`:
```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 6: Create `frontend/.env.local`** pointing to root .env values

```env
VITE_SUPABASE_URL=https://elvoyebgkgnvsbbahmej.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_v0mJ7QxzkRxXbJpsXNzwsw_JZESV19Q
VITE_API_BASE_URL=http://localhost:8000/api
```

> Note: Copy the real values from root `.env`. Add `frontend/.env.local` to `.gitignore`.

- [ ] **Step 7: Verify frontend starts**

```bash
cd frontend && npm run dev
```
Expected: Vite dev server running at `http://localhost:5173`. Default Vite+React page loads.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite + React.TS + Tailwind v4"
```

---

### Task 3: Install and Configure shadcn/ui

**Files:**
- Modify: `frontend/src/index.css`, `frontend/components.json`, various shadcn component files in `frontend/src/components/ui/`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

- [ ] **Step 2: Install required components**

```bash
npx shadcn@latest add button card input label select textarea dialog alert badge tabs progress separator
```

Expected: Components created in `frontend/src/components/ui/`

- [ ] **Step 3: Verify shadcn renders**

In `frontend/src/App.tsx`, temporarily import and render a `<Button>` from shadcn:
```tsx
import { Button } from '@/components/ui/button'
export default function App() {
  return <Button>Hello FinPulse</Button>
}
```
Run `npm run dev` and confirm the button renders with Zinc styling.

- [ ] **Step 4: Revert App.tsx** — remove the test button (we'll rewrite App.tsx in Task 5)

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: add shadcn/ui with New York style and Zinc base color"
```

---

### Task 4: Create Frontend Library Files + TypeScript Types

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/types/index.ts`

- [ ] **Step 1: Create `frontend/src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Summary:** Exports a singleton Supabase client. Throws at startup if env vars are missing (fail-fast).
**Dependencies:** `@supabase/supabase-js`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` env vars.

- [ ] **Step 2: Create `frontend/src/lib/api.ts`**

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
    return response.json() as Promise<T>;
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json() as Promise<T>;
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json() as Promise<T>;
  },

  async delete(path: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
  },
};
```

**Summary:** Typed Django REST API client that automatically attaches the Supabase JWT to every request.

- [ ] **Step 3: Create `frontend/src/types/index.ts`** with all DB-mirroring interfaces

```typescript
// Mirrors database-schema.md exactly

export interface UserProfile {
  id: string; // UUID — matches auth.users.id
  display_name: string;
  currency: string; // ISO 4217, default 'PHP'
  monthly_budget_goal: number | null;
  created_at: string; // ISO 8601
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null; // null for default categories
  name: string;
  icon: string | null;
  color: string | null; // hex, e.g. '#EF9F27'
  is_default: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  description: string;
  notes: string | null;
  expense_date: string; // ISO date string 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
  // Joined from categories table when fetched with select('*, categories(*)')
  categories?: Pick<Category, 'name' | 'icon' | 'color'>;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  entry_date: string; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
}

export interface BudgetGoal {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: string; // 'YYYY-MM-DD' — always first day of month
  created_at: string;
  updated_at: string;
}

export interface AnalysisHistory {
  id: string;
  user_id: string;
  analysis_type: 'expense_analysis' | 'budget_recommendation';
  input_summary: Record<string, unknown>;
  result: Record<string, unknown>;
  model_used: string;
  tokens_used: number | null;
  created_at: string;
}

// Form input types (no id/timestamps — used for create/update)
export type ExpenseFormData = Pick<Expense, 'amount' | 'description' | 'category_id' | 'expense_date' | 'notes'>;
export type JournalEntryFormData = Pick<JournalEntry, 'title' | 'content' | 'tags' | 'entry_date'>;

// Filter types
export interface ExpenseFilters {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ frontend/src/types/
git commit -m "feat: add Supabase client, Django API client, and TypeScript types"
```

---

## Chunk 2: Authentication + Routing

### Task 5: App Router Setup

**Files:**
- Modify: `frontend/src/main.tsx`
- Create/Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Create `frontend/src/App.tsx`** with full route config

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import AuthLayout from '@/components/layout/AuthLayout';
import MainLayout from '@/components/layout/MainLayout';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import DashboardPage from '@/pages/DashboardPage';
import ExpensesPage from '@/pages/ExpensesPage';
import JournalPage from '@/pages/JournalPage';
import BudgetPage from '@/pages/BudgetPage';
import AnalysisPage from '@/pages/AnalysisPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  const { initialize, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected routes */}
        <Route element={<AuthLayout />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

> Note: This depends on stores and pages created in Tasks 6-8. Create stubs for missing files first (Task 5, Step 3).

- [ ] **Step 3: Create stub pages** to prevent TypeScript errors while building

For each page not yet built, create a minimal stub:
```tsx
// Example: frontend/src/pages/BudgetPage.tsx
export default function BudgetPage() {
  return <div className="p-4"><h1 className="text-2xl font-bold">Budget</h1><p className="text-muted-foreground">Coming in Phase 2.</p></div>;
}
```

Create stubs for: `BudgetPage`, `AnalysisPage`, `SettingsPage`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx frontend/src/pages/
git commit -m "feat: add React Router with public/protected route structure"
```

---

### Task 6: Auth Store (Zustand)

**Files:**
- Create: `frontend/src/stores/authStore.ts`

- [ ] **Step 1: Create `frontend/src/stores/authStore.ts`**

```typescript
import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: async () => {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    set({ user: session?.user ?? null, loading: false });

    // If user exists, fetch their profile
    if (session?.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      set({ profile: profile ?? null });
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      set({ user: currentUser });

      if (currentUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        set({ profile: profile ?? null });
      } else {
        set({ profile: null });
      }
    });
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, profile: null });
  },

  setProfile: (profile: UserProfile) => set({ profile }),
}));
```

**Summary:** Zustand store managing auth state. Initializes from existing session, subscribes to Supabase auth changes, fetches user profile on login.
**Parameters:** None — all state initialized via `initialize()` called in `App.tsx`.
**Dependencies:** `@supabase/supabase-js`, `zustand`, Supabase `user_profiles` table.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/
git commit -m "feat: add Zustand auth store with Supabase session management"
```

---

### Task 7: AuthLayout and MainLayout Components

**Files:**
- Create: `frontend/src/components/layout/AuthLayout.tsx`
- Create: `frontend/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: Create `frontend/src/components/layout/AuthLayout.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

**Summary:** Route guard — redirects unauthenticated users to `/login`. Renders child routes via `<Outlet>` if authenticated.

- [ ] **Step 2: Create `frontend/src/components/layout/MainLayout.tsx`**

```tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Target,
  BarChart2,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/budget', icon: Target, label: 'Budget' },
  { to: '/analysis', icon: BarChart2, label: 'Analysis' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function MainLayout() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch {
      console.error('Sign out failed');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex flex-col w-60 border-r p-4 gap-1">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-bold">FinPulse</h1>
          <p className="text-sm text-muted-foreground truncate">
            {profile?.display_name ?? '...'}
          </p>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t pt-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background flex justify-around py-2 z-50">
        {navItems.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 p-2 rounded-md text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

**Summary:** App shell with desktop sidebar (hidden on mobile) and a mobile bottom navigation bar. Displays user name and sign-out button.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat: add AuthLayout guard and MainLayout with responsive navigation"
```

---

### Task 8: Login and SignUp Pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/SignUpPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/LoginPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">FinPulse</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="underline underline-offset-4 hover:text-primary">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/SignUpPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { setProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Supabase auth user
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Sign up failed — no user returned.');

      // 2. Create user_profiles row
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({ id: data.user.id, display_name: displayName.trim() })
        .select()
        .single();
      if (profileError) throw profileError;

      setProfile(profile);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Start tracking your finances</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Bronn"
                required
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Navigate to `/signup`, create a test account. Confirm:
- Redirected to `/` (dashboard) after sign up
- Supabase Dashboard → Authentication → Users shows the new user
- Supabase Dashboard → Table Editor → `user_profiles` has a row for the user

Then sign out and sign back in at `/login`. Confirm redirect to `/`.
Then navigate to `http://localhost:5173/expenses` while logged out — confirm redirect to `/login`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/SignUpPage.tsx
git commit -m "feat: implement Login and SignUp pages with Supabase Auth"
```

---

## Chunk 3: Expense Feature

### Task 9: useExpenses Hook + useCategories Hook

**Files:**
- Create: `frontend/src/hooks/useCategories.ts`
- Create: `frontend/src/hooks/useExpenses.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useCategories.ts`**

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (fetchError) throw fetchError;
      setCategories(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  return { categories, loading, error, refetch: fetchCategories };
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useExpenses.ts`**

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseFormData, ExpenseFilters } from '@/types';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (filters?: ExpenseFilters) => {
    setLoading(true);
    setError(null);
    try {
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

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setExpenses(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = async (formData: ExpenseFormData): Promise<Expense> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...formData, user_id: user.id })
      .select('*, categories(name, icon, color)')
      .single();

    if (error) throw error;
    setExpenses((prev) => [data, ...prev]);
    return data;
  };

  const updateExpense = async (id: string, formData: Partial<ExpenseFormData>): Promise<Expense> => {
    const { data, error } = await supabase
      .from('expenses')
      .update(formData)
      .eq('id', id)
      .select('*, categories(name, icon, color)')
      .single();

    if (error) throw error;
    setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  };

  const deleteExpense = async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}
```

**Summary:** Custom React hook encapsulating all Supabase CRUD for expenses. Manages local state to avoid unnecessary refetches (optimistic updates on create/update/delete).

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add useExpenses and useCategories hooks"
```

---

### Task 10: Expense Components

**Files:**
- Create: `frontend/src/components/expenses/ExpenseFilters.tsx`
- Create: `frontend/src/components/expenses/ExpenseForm.tsx`
- Create: `frontend/src/components/expenses/ExpenseList.tsx`

- [ ] **Step 1: Create `frontend/src/components/expenses/ExpenseFilters.tsx`**

```tsx
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Category, ExpenseFilters as Filters } from '@/types';

interface Props {
  categories: Category[];
  onFiltersChange: (filters: Filters) => void;
}

export default function ExpenseFilters({ categories, onFiltersChange }: Props) {
  const [categoryId, setCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const applyFilters = () => {
    onFiltersChange({
      categoryId: categoryId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  const clearFilters = () => {
    setCategoryId('');
    setStartDate('');
    setEndDate('');
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
      </div>
      <Button variant="secondary" size="sm" onClick={applyFilters}>Apply</Button>
      <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/expenses/ExpenseForm.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Expense, ExpenseFormData, Category } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  categories: Category[];
  initialData?: Expense;
}

const today = new Date().toISOString().split('T')[0];

export default function ExpenseForm({ open, onOpenChange, onSubmit, categories, initialData }: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setAmount(String(initialData.amount));
      setDescription(initialData.description);
      setCategoryId(initialData.category_id);
      setExpenseDate(initialData.expense_date);
      setNotes(initialData.notes ?? '');
    } else {
      setAmount('');
      setDescription('');
      setCategoryId('');
      setExpenseDate(today);
      setNotes('');
    }
    setError(null);
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }
    if (!expenseDate) {
      setError('Date is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        amount: amountNum,
        description: description.trim(),
        category_id: categoryId,
        expense_date: expenseDate,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              type="text"
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this expense for?"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expenseDate">Date *</Label>
            <Input
              id="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : initialData ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/expenses/ExpenseList.tsx`**

```tsx
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Expense } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  expenses: Expense[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => Promise<void>;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function ExpenseList({ expenses, loading, onEdit, onDelete }: Props) {
  const { profile } = useAuthStore();
  const currency = profile?.currency ?? 'PHP';
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm py-8 text-center">Loading expenses...</p>;
  }

  if (expenses.length === 0) {
    return <p className="text-muted-foreground text-sm py-8 text-center">No expenses found. Add your first one!</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{expense.description}</span>
                  {expense.categories && (
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: expense.categories.color ?? undefined, color: '#fff' }}
                    >
                      {expense.categories.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                  <span>{formatDate(expense.expense_date)}</span>
                  {expense.notes && <span className="truncate">· {expense.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold">{formatCurrency(expense.amount, currency)}</span>
                <Button variant="ghost" size="icon" onClick={() => onEdit(expense)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(expense.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

> Note: `AlertDialog` requires `npx shadcn@latest add alert-dialog` — run this before the above.

- [ ] **Step 4: Add missing shadcn components**

```bash
cd frontend && npx shadcn@latest add alert-dialog
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/expenses/
git commit -m "feat: add expense components (ExpenseList, ExpenseForm, ExpenseFilters)"
```

---

### Task 11: ExpensesPage

**Files:**
- Create: `frontend/src/pages/ExpensesPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/ExpensesPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import ExpenseFilters from '@/components/expenses/ExpenseFilters';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { Expense, ExpenseFilters as Filters } from '@/types';

export default function ExpensesPage() {
  const { expenses, loading, error, fetchExpenses, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { categories } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | undefined>(undefined);
  const [activeFilters, setActiveFilters] = useState<Filters>({});

  useEffect(() => {
    fetchExpenses(activeFilters);
  }, [fetchExpenses, activeFilters]);

  const handleEdit = (expense: Expense) => {
    setEditTarget(expense);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditTarget(undefined);
  };

  const handleSubmit = async (data: Parameters<typeof createExpense>[0]) => {
    if (editTarget) {
      await updateExpense(editTarget.id, data);
    } else {
      await createExpense(data);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add expense
        </Button>
      </div>

      <div className="mb-4">
        <ExpenseFilters
          categories={categories}
          onFiltersChange={(filters) => setActiveFilters(filters)}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ExpenseList
        expenses={expenses}
        loading={loading}
        onEdit={handleEdit}
        onDelete={deleteExpense}
      />

      <ExpenseForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSubmit={handleSubmit}
        categories={categories}
        initialData={editTarget}
      />
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`. Sign in and navigate to `/expenses`. Verify:
- Add expense works (appears in list)
- Edit expense pre-fills form, saves changes
- Delete shows confirmation, removes from list
- Category filter and date filter work
- All amounts display in PHP currency format
- No console errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ExpensesPage.tsx
git commit -m "feat: complete expense CRUD page with filters"
```

---

## Chunk 4: Journal Feature

### Task 12: useJournalEntries Hook + Journal Components

**Files:**
- Create: `frontend/src/hooks/useJournalEntries.ts`
- Create: `frontend/src/components/journal/TagInput.tsx`
- Create: `frontend/src/components/journal/TagFilter.tsx`
- Create: `frontend/src/components/journal/JournalForm.tsx`
- Create: `frontend/src/components/journal/JournalList.tsx`

- [ ] **Step 1: Create `frontend/src/hooks/useJournalEntries.ts`**

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { JournalEntry, JournalEntryFormData } from '@/types';

export function useJournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (tagFilter?: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });

      if (tagFilter) {
        query = query.contains('tags', [tagFilter]);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setEntries(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, []);

  const createEntry = async (formData: JournalEntryFormData): Promise<JournalEntry> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({ ...formData, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    setEntries((prev) => [data, ...prev]);
    return data;
  };

  const updateEntry = async (id: string, formData: Partial<JournalEntryFormData>): Promise<JournalEntry> => {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  };

  const deleteEntry = async (id: string): Promise<void> => {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id);
    if (error) throw error;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return { entries, loading, error, fetchEntries, createEntry, updateEntry, deleteEntry };
}
```

- [ ] **Step 2: Create `frontend/src/components/journal/TagInput.tsx`**

```tsx
import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: Props) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border p-2 focus-within:ring-1 focus-within:ring-ring">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="ml-0.5">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        className="h-6 flex-1 min-w-24 border-0 p-0 shadow-none focus-visible:ring-0"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && addTag(inputValue)}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter' : ''}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/journal/TagFilter.tsx`**

```tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  allTags: string[];
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export default function TagFilter({ allTags, activeTag, onTagSelect }: Props) {
  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground">Filter:</span>
      {activeTag && (
        <Button variant="ghost" size="sm" onClick={() => onTagSelect(null)}>
          Clear
        </Button>
      )}
      {allTags.map((tag) => (
        <Badge
          key={tag}
          variant={activeTag === tag ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => onTagSelect(activeTag === tag ? null : tag)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/journal/JournalForm.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TagInput from './TagInput';
import { JournalEntry, JournalEntryFormData } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: JournalEntryFormData) => Promise<void>;
  initialData?: JournalEntry;
}

const today = new Date().toISOString().split('T')[0];

export default function JournalForm({ open, onOpenChange, onSubmit, initialData }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [entryDate, setEntryDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      setTags(initialData.tags ?? []);
      setEntryDate(initialData.entry_date);
    } else {
      setTitle('');
      setContent('');
      setTags([]);
      setEntryDate(today);
    }
    setError(null);
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Title is required.'); return; }
    if (!content.trim()) { setError('Content is required.'); return; }
    if (!entryDate) { setError('Date is required.'); return; }

    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim(), tags, entry_date: entryDate });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Entry' : 'New Journal Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened today?" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Content *</Label>
            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your thoughts..." rows={6} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entryDate">Date *</Label>
            <Input id="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : initialData ? 'Save changes' : 'Add entry'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/journal/JournalList.tsx`**

```tsx
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { JournalEntry } from '@/types';

interface Props {
  entries: JournalEntry[];
  loading: boolean;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => Promise<void>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

const PREVIEW_LENGTH = 150;

export default function JournalList({ entries, loading, onEdit, onDelete }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await onDelete(deleteTarget); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  if (loading) return <p className="text-muted-foreground text-sm py-8 text-center">Loading journal...</p>;
  if (entries.length === 0) return <p className="text-muted-foreground text-sm py-8 text-center">No entries yet. Start journaling!</p>;

  return (
    <>
      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div>
                <h3 className="font-semibold">{entry.title}</h3>
                <p className="text-xs text-muted-foreground">{formatDate(entry.entry_date)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => onEdit(entry)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(entry.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                {entry.content.length > PREVIEW_LENGTH
                  ? entry.content.slice(0, PREVIEW_LENGTH) + '...'
                  : entry.content}
              </p>
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete journal entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 6: Create `frontend/src/pages/JournalPage.tsx`**

```tsx
import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import JournalList from '@/components/journal/JournalList';
import JournalForm from '@/components/journal/JournalForm';
import TagFilter from '@/components/journal/TagFilter';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { JournalEntry } from '@/types';

export default function JournalPage() {
  const { entries, loading, error, fetchEntries, createEntry, updateEntry, deleteEntry } = useJournalEntries();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<JournalEntry | undefined>(undefined);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries(activeTag ?? undefined);
  }, [fetchEntries, activeTag]);

  // Collect all unique tags across all entries (unfiltered list would need separate fetch — use entries as proxy)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [entries]);

  const handleEdit = (entry: JournalEntry) => {
    setEditTarget(entry);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditTarget(undefined);
  };

  const handleSubmit = async (data: Parameters<typeof createEntry>[0]) => {
    if (editTarget) {
      await updateEntry(editTarget.id, data);
    } else {
      await createEntry(data);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Journal</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New entry
        </Button>
      </div>

      <div className="mb-4">
        <TagFilter allTags={allTags} activeTag={activeTag} onTagSelect={setActiveTag} />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <JournalList entries={entries} loading={loading} onEdit={handleEdit} onDelete={deleteEntry} />

      <JournalForm open={formOpen} onOpenChange={handleFormClose} onSubmit={handleSubmit} initialData={editTarget} />
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 8: Manual verification**

Navigate to `/journal`. Verify:
- Create entry with tags works
- Edit pre-fills form
- Delete with confirmation works
- Tag filter shows available tags, clicking filters the list
- Clicking same tag deselects it

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/useJournalEntries.ts frontend/src/components/journal/ frontend/src/pages/JournalPage.tsx
git commit -m "feat: complete journal CRUD with tag filtering"
```

---

## Chunk 5: Dashboard

### Task 13: Dashboard Shell

**Files:**
- Create: `frontend/src/components/dashboard/SummaryCard.tsx`
- Create: `frontend/src/components/dashboard/RecentExpenses.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create `frontend/src/components/dashboard/SummaryCard.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
}

export default function SummaryCard({ title, value, description, icon: Icon }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/dashboard/RecentExpenses.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Expense } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  expenses: Expense[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function RecentExpenses({ expenses }: Props) {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const currency = profile?.currency ?? 'PHP';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recent Expenses</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')}>View all</Button>
      </CardHeader>
      <CardContent className="p-0">
        {expenses.length === 0 ? (
          <p className="text-muted-foreground text-sm p-4">No expenses yet.</p>
        ) : (
          <ul className="divide-y">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{expense.description}</span>
                  {expense.categories && (
                    <Badge variant="secondary" style={{ backgroundColor: expense.categories.color ?? undefined, color: '#fff' }} className="text-xs">
                      {expense.categories.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(expense.expense_date)}</span>
                  <span className="text-sm font-medium">{formatCurrency(expense.amount, currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `frontend/src/pages/DashboardPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Plus, Receipt, BookOpen, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SummaryCard from '@/components/dashboard/SummaryCard';
import RecentExpenses from '@/components/dashboard/RecentExpenses';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { useAuthStore } from '@/stores/authStore';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { expenses, fetchExpenses, createExpense } = useExpenses();
  const { categories } = useCategories();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [journalCount, setJournalCount] = useState(0);

  const currency = profile?.currency ?? 'PHP';

  // Fetch this month's expenses for summary
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const startDate = thisMonthStart.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchExpenses({ startDate, endDate: today });

    // Count journal entries
    supabase
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setJournalCount(count ?? 0));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const formattedTotal = new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(totalSpent);
  const recentExpenses = expenses.slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile?.display_name ?? '...'}</h1>
          <p className="text-muted-foreground text-sm">Here's your financial snapshot</p>
        </div>
        <Button onClick={() => setAddExpenseOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add expense
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Spent This Month"
          value={formattedTotal}
          description={`${expenses.length} transactions`}
          icon={TrendingUp}
        />
        <SummaryCard
          title="Expenses"
          value={expenses.length}
          description="This month"
          icon={Receipt}
        />
        <SummaryCard
          title="Journal Entries"
          value={journalCount}
          description="Total entries"
          icon={BookOpen}
        />
      </div>

      <RecentExpenses expenses={recentExpenses} />

      <ExpenseForm
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onSubmit={createExpense}
        categories={categories}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

Navigate to `/`. Verify:
- Welcome message shows user's display name
- Summary cards display (spending may be 0 if no data yet)
- "Add expense" button opens ExpenseForm dialog and saves correctly
- Recent expenses list populates after adding expenses
- "View all" navigates to `/expenses`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add dashboard with summary cards and quick-add expense"
```

---

## Chunk 6: Django Backend

### Task 14: Django Project Scaffold

**Files:**
- Create: `backend/` (entire Django project)

**Prerequisites:** The `DATABASE_URL` in `.env` must be the real Supabase Postgres connection string before running `migrate`. Get it from: Supabase Dashboard → Settings → Database → Connection string → URI (use the session pooler or direct URL).

- [ ] **Step 1: Set up Python virtual environment**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend
python3 -m venv .venv
source .venv/bin/activate
```

- [ ] **Step 2: Install dependencies**

```bash
pip install django djangorestframework django-cors-headers psycopg2-binary python-dotenv PyJWT
pip freeze > requirements.txt
```

- [ ] **Step 3: Create Django project**

```bash
django-admin startproject core .
```
Expected: `manage.py`, `core/` directory created.

- [ ] **Step 4: Create Django apps**

```bash
python manage.py startapp users apps/users
python manage.py startapp expenses apps/expenses
python manage.py startapp journal apps/journal
python manage.py startapp budgets apps/budgets
python manage.py startapp analysis apps/analysis
```

Create `apps/__init__.py` to make it a package:
```bash
touch apps/__init__.py
```

- [ ] **Step 5: Commit skeleton**

```bash
git add backend/
git commit -m "feat: scaffold Django project with DRF and app structure"
```

---

### Task 15: Django Settings Configuration

**Files:**
- Modify: `backend/core/settings.py`

- [ ] **Step 1: Replace `backend/core/settings.py`** with configured version

```python
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent.parent / '.env')

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'change-me-in-production')

DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.users',
    'apps.expenses',
    'apps.journal',
    'apps.budgets',
    'apps.analysis',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'apps.users.middleware.SupabaseAuthMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {'context_processors': ['django.template.context_processors.request']},
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Database — Supabase Postgres
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'OPTIONS': {'options': '-c search_path=public'},
    }
}

# Parse DATABASE_URL manually (python-dotenv loads it as a string)
_db_url = os.environ.get('DATABASE_URL', '')
if _db_url:
    import urllib.parse
    _parsed = urllib.parse.urlparse(_db_url)
    DATABASES['default'].update({
        'NAME': _parsed.path.lstrip('/'),
        'USER': _parsed.username,
        'PASSWORD': _parsed.password,
        'HOST': _parsed.hostname,
        'PORT': _parsed.port or 5432,
    })

# Supabase Auth
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
CORS_ALLOW_CREDENTIALS = True

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

**Summary:** Minimal Django settings loading from root `.env`. No Django auth system — authentication handled by `SupabaseAuthMiddleware`. Database configured from `DATABASE_URL`. `django.contrib.auth` and `django.contrib.admin` intentionally excluded (Supabase owns auth).

- [ ] **Step 2: Create `backend/core/urls.py`**

```python
from django.urls import path, include

urlpatterns = [
    path('api/', include('apps.expenses.urls', namespace='expenses')),
    # Phase 2/3 endpoints will be added here
]
```

Create `apps/expenses/urls.py` as a stub:
```python
from django.urls import path
app_name = 'expenses'
urlpatterns = []
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/settings.py backend/core/urls.py backend/apps/expenses/urls.py
git commit -m "feat: configure Django settings with Supabase Postgres and CORS"
```

---

### Task 16: Supabase JWT Middleware

**Files:**
- Create: `backend/apps/users/middleware.py`

- [ ] **Step 1: Create `backend/apps/users/middleware.py`**

```python
import jwt
from django.conf import settings
from django.http import JsonResponse


class SupabaseAuthMiddleware:
    """
    Validates Supabase JWT tokens on all /api/ requests.
    Sets request.user_id to the Supabase user UUID (sub claim).
    Returns 401 if token is missing or invalid.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return JsonResponse({'error': 'No token provided'}, status=401)

            token = auth_header.removeprefix('Bearer ').strip()
            if not token:
                return JsonResponse({'error': 'No token provided'}, status=401)

            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=['HS256'],
                    audience='authenticated',
                )
                request.user_id = payload['sub']  # Supabase user UUID
            except jwt.ExpiredSignatureError:
                return JsonResponse({'error': 'Token expired'}, status=401)
            except jwt.InvalidTokenError as e:
                return JsonResponse({'error': f'Invalid token: {str(e)}'}, status=401)

        return self.get_response(request)
```

**Summary:** Django middleware that validates Supabase JWT on all `/api/` routes. Sets `request.user_id` for downstream views. Non-API routes bypass auth (health check, static files).
**Dependencies:** `PyJWT`, `SUPABASE_JWT_SECRET` in settings.

- [ ] **Step 2: Update `backend/apps/users/__init__.py`** — ensure it's empty (Django app init)

- [ ] **Step 3: Commit**

```bash
git add backend/apps/users/middleware.py backend/apps/users/__init__.py
git commit -m "feat: implement SupabaseAuthMiddleware for JWT validation"
```

---

### Task 17: Django Unmanaged Models

**Files:**
- Modify: `backend/apps/users/models.py`
- Modify: `backend/apps/expenses/models.py`
- Modify: `backend/apps/journal/models.py`
- Modify: `backend/apps/budgets/models.py`
- Modify: `backend/apps/analysis/models.py`

- [ ] **Step 1: Create `backend/apps/users/models.py`**

```python
import uuid
from django.db import models


class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    display_name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, default='PHP')
    monthly_budget_goal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False  # Supabase owns this table
        db_table = 'user_profiles'

    def __str__(self) -> str:
        return self.display_name
```

- [ ] **Step 2: Create `backend/apps/expenses/models.py`**

```python
import uuid
from django.db import models


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=50)
    icon = models.CharField(max_length=30, null=True, blank=True)
    color = models.CharField(max_length=7, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'categories'

    def __str__(self) -> str:
        return self.name


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    category = models.ForeignKey(Category, on_delete=models.DO_NOTHING, db_column='category_id')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    notes = models.TextField(null=True, blank=True)
    expense_date = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'expenses'

    def __str__(self) -> str:
        return f'{self.description} — {self.amount}'
```

- [ ] **Step 3: Create `backend/apps/journal/models.py`**

```python
import uuid
from django.contrib.postgres.fields import ArrayField
from django.db import models


class JournalEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    title = models.CharField(max_length=200)
    content = models.TextField()
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    entry_date = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'journal_entries'

    def __str__(self) -> str:
        return self.title
```

- [ ] **Step 4: Create `backend/apps/budgets/models.py`**

```python
import uuid
from django.db import models
from apps.expenses.models import Category


class BudgetGoal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    category = models.ForeignKey(Category, on_delete=models.DO_NOTHING, db_column='category_id')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    month = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'budget_goals'
        unique_together = [('user_id', 'category', 'month')]

    def __str__(self) -> str:
        return f'{self.category} — {self.month}'
```

- [ ] **Step 5: Create `backend/apps/analysis/models.py`**

```python
import uuid
from django.db import models


class AnalysisHistory(models.Model):
    ANALYSIS_TYPES = [
        ('expense_analysis', 'Expense Analysis'),
        ('budget_recommendation', 'Budget Recommendation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    analysis_type = models.CharField(max_length=20, choices=ANALYSIS_TYPES)
    input_summary = models.JSONField()
    result = models.JSONField()
    model_used = models.CharField(max_length=50)
    tokens_used = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'analysis_history'

    def __str__(self) -> str:
        return f'{self.analysis_type} — {self.created_at}'
```

- [ ] **Step 6: Commit**

```bash
git add backend/apps/
git commit -m "feat: add unmanaged Django models mirroring Supabase schema"
```

---

### Task 18: Verify Django Starts and Connects

- [ ] **Step 1: Update `DATABASE_URL` in `.env`** with the real Supabase connection string

From Supabase Dashboard → Settings → Database → Connection string → URI (Session pooler recommended for Django).

Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

- [ ] **Step 2: Test Django starts**

```bash
cd backend
source .venv/bin/activate
python manage.py check
```
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Test database connection**

```bash
python manage.py dbshell
```
Expected: psql prompt connected to Supabase Postgres. Run `\dt` — should show tables: `categories`, `expenses`, `journal_entries`, `budget_goals`, `user_profiles`, `analysis_history`.

Type `\q` to exit.

- [ ] **Step 4: Run dev server**

```bash
python manage.py runserver 8000
```
Expected: `Starting development server at http://127.0.0.1:8000/`

- [ ] **Step 5: Test JWT middleware**

```bash
# Without token — should return 401
curl -s http://localhost:8000/api/ | python3 -m json.tool
```
Expected: `{"error": "No token provided"}`

(Any 404 on `/api/` with the middleware returning 401 correctly means the middleware is working.)

- [ ] **Step 6: Final TypeScript check on frontend**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse
git add backend/
git commit -m "chore: verify Django backend starts and connects to Supabase Postgres"
```

---

## Phase 1 Acceptance Checklist

Run through each item manually:

- [ ] Monorepo structure created — `frontend/`, `backend/`, `supabase/`, `Makefile` all present
- [ ] `make install-frontend` installs all packages without errors
- [ ] `make dev-frontend` starts Vite at `http://localhost:5173`
- [ ] Frontend loads with Tailwind + shadcn/ui styled correctly (Zinc theme, New York style)
- [ ] Sign up: new user can register with email + password + display name
- [ ] Sign in: existing user redirected to `/` dashboard
- [ ] Sign out: session cleared, redirected to `/login`
- [ ] Protected routes: visiting `/expenses` unauthenticated redirects to `/login`
- [ ] Expense CRUD: create, read (with category/date filters), update, delete — all working
- [ ] Journal CRUD: create, read (with tag filter), update, delete — all working
- [ ] Dashboard: shows monthly spend, expense count, journal count, recent 5 expenses, quick-add expense
- [ ] `make install-backend` + `make dev-backend` starts Django at `http://localhost:8000`
- [ ] `python manage.py check` returns 0 issues
- [ ] `python manage.py dbshell` connects to Supabase Postgres
- [ ] JWT middleware returns 401 for requests to `/api/` without a token
- [ ] TypeScript strict mode — `npx tsc --noEmit` passes with 0 errors
- [ ] No console errors in browser
- [ ] RLS verification: log in as User A, confirm you cannot see User B's expenses (test in Supabase SQL Editor or by switching accounts)
