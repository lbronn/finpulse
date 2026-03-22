# Phase 4 — PWA, Responsive Polish & Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FinPulse production-ready — installable as a PWA, fully responsive from 375px to 1440px+, polished with proper loading/error/empty states, CSV export, security hardening, a complete settings page, and deployment configuration for Vercel + Railway.

**Architecture:** Phase 4 is purely additive polish on top of the working Phase 3 app. Frontend changes cover PWA manifest/service worker config, responsive layout fixes, state improvements, and settings expansion. Backend changes add rate limiting to LLM endpoints and production deployment config (Procfile, gunicorn, STATIC_ROOT). No database schema changes.

**Tech Stack:** React.TS + Vite (vite-plugin-pwa), Tailwind CSS, shadcn/ui Skeleton, Django 5.x (built-in cache for rate limiting), gunicorn, Vercel (frontend), Railway (backend)

---

## File Map

### Files to Create
- `frontend/public/pwa-192x192.png` — PWA icon 192×192 (placeholder SVG-to-PNG or generated)
- `frontend/public/pwa-512x512.png` — PWA icon 512×512
- `frontend/public/apple-touch-icon.png` — Apple touch icon 180×180
- `frontend/src/components/layout/OfflineBanner.tsx` — "You're offline" banner component
- `frontend/src/lib/export.ts` — CSV export utility function
- `backend/Procfile` — Railway/Heroku process declaration
- `backend/runtime.txt` — Python version for Railway

### Files to Modify
- `frontend/vite.config.ts` — Add vite-plugin-pwa with manifest and workbox config
- `frontend/package.json` — Add vite-plugin-pwa devDependency (after npm install)
- `frontend/src/App.tsx` — Wrap with OfflineBanner; improve initial loading state
- `frontend/src/components/layout/MainLayout.tsx` — Collapsible desktop sidebar, ensure Settings in mobile nav
- `frontend/src/pages/DashboardPage.tsx` — Responsive grid, skeleton loading states
- `frontend/src/pages/ExpensesPage.tsx` — Add CSV export button, responsive layout
- `frontend/src/components/expenses/ExpenseList.tsx` — Skeleton rows, proper empty state with CTA
- `frontend/src/pages/JournalPage.tsx` — Skeleton loading, empty state with CTA
- `frontend/src/pages/BudgetPage.tsx` — Skeleton loading, empty state with CTA
- `frontend/src/pages/AnalysisPage.tsx` — Responsive mx-auto centering
- `frontend/src/pages/SettingsPage.tsx` — Full rebuild: profile edit, currency, budget goal, AI usage, CSV export, sign out
- `frontend/src/components/expenses/ExpenseForm.tsx` — Mobile input optimizations (inputMode, type)
- `backend/core/settings.py` — ALLOWED_HOSTS from env, STATIC_ROOT, production guards
- `backend/apps/analysis/views.py` — Rate limiting on analyze_expenses + budget_recommendations
- `backend/requirements.txt` — Add gunicorn (for Railway deployment)

---

## Task 1: Install vite-plugin-pwa

**Files:**
- Modify: `frontend/package.json` (auto-updated by npm)
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Install the PWA plugin**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npm install -D vite-plugin-pwa
```

Expected: `vite-plugin-pwa` appears in devDependencies in package.json.

- [ ] **Step 2: Update vite.config.ts with PWA configuration**

Replace the full contents of `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'FinPulse — Personal Finance Tracker',
        short_name: 'FinPulse',
        description: 'Track expenses, journal decisions, and get AI-powered budget insights.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/vite.config.ts frontend/package.json frontend/package-lock.json && git commit -m "feat: add vite-plugin-pwa with manifest and workbox service worker"
```

---

## Task 2: Generate PWA Icons

**Files:**
- Create: `frontend/public/pwa-192x192.png`
- Create: `frontend/public/pwa-512x512.png`
- Create: `frontend/public/apple-touch-icon.png`

- [ ] **Step 1: Generate SVG source icon**

Create `frontend/public/icon-source.svg` with this content (FinPulse logo — pulse waveform on dark background):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#09090b"/>
  <polyline
    points="64,256 160,256 192,128 224,384 272,192 304,320 336,256 448,256"
    fill="none"
    stroke="#22c55e"
    stroke-width="32"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <text x="256" y="460" font-family="system-ui,sans-serif" font-size="72" font-weight="700"
    fill="#ffffff" text-anchor="middle" opacity="0.6">FP</text>
</svg>
```

- [ ] **Step 2: Convert SVG to PNG icons using Node script**

Create and run `frontend/scripts/generate-icons.mjs`:

```javascript
// One-time icon generation script — delete after use
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

// Check if sharp is available; if not, use a simpler approach
// This script uses the svg2img approach via canvas or Inkscape
// ALTERNATIVE: Use an online tool like https://realfavicongenerator.net/
// and place the generated files in frontend/public/

console.log('Icon generation script');
console.log('If this script fails, manually create PNG icons from frontend/public/icon-source.svg');
console.log('Required files:');
console.log('  frontend/public/pwa-192x192.png  (192x192)');
console.log('  frontend/public/pwa-512x512.png  (512x512)');
console.log('  frontend/public/apple-touch-icon.png  (180x180)');

// Try using Inkscape if available
try {
  execSync('which inkscape', { stdio: 'ignore' });
  execSync(`inkscape ${path.join(publicDir, 'icon-source.svg')} --export-type=png --export-filename=${path.join(publicDir, 'pwa-512x512.png')} --export-width=512`);
  execSync(`inkscape ${path.join(publicDir, 'icon-source.svg')} --export-type=png --export-filename=${path.join(publicDir, 'pwa-192x192.png')} --export-width=192`);
  execSync(`inkscape ${path.join(publicDir, 'icon-source.svg')} --export-type=png --export-filename=${path.join(publicDir, 'apple-touch-icon.png')} --export-width=180`);
  console.log('Icons generated with Inkscape.');
} catch {
  // Try ImageMagick
  try {
    execSync('which convert', { stdio: 'ignore' });
    execSync(`convert -background none -size 512x512 ${path.join(publicDir, 'icon-source.svg')} ${path.join(publicDir, 'pwa-512x512.png')}`);
    execSync(`convert -background none -size 192x192 ${path.join(publicDir, 'icon-source.svg')} ${path.join(publicDir, 'pwa-192x192.png')}`);
    execSync(`convert -background none -size 180x180 ${path.join(publicDir, 'icon-source.svg')} ${path.join(publicDir, 'apple-touch-icon.png')}`);
    console.log('Icons generated with ImageMagick.');
  } catch {
    console.warn('Neither Inkscape nor ImageMagick found.');
    console.warn('Manually convert frontend/public/icon-source.svg to PNG at 192x192, 512x512, and 180x180.');
    console.warn('Save as: pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png in frontend/public/');
  }
}
```

Run:
```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && node scripts/generate-icons.mjs
```

If both tools fail, manually convert the SVG using any online tool (realfavicongenerator.net, cloudconvert.com) and place the PNG files in `frontend/public/`.

- [ ] **Step 3: Verify icons exist**

```bash
ls /Users/bronny/SaaSProjects/finpulse/frontend/public/*.png
```

Expected: `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png` all present.

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/public/ frontend/scripts/ && git commit -m "feat: add PWA icons and apple-touch-icon"
```

---

## Task 3: Offline Banner Component

**Files:**
- Create: `frontend/src/components/layout/OfflineBanner.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the OfflineBanner component**

Create `frontend/src/components/layout/OfflineBanner.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline. Data operations require a connection.</span>
    </div>
  );
}
```

- [ ] **Step 2: Add OfflineBanner to App.tsx**

Open `frontend/src/App.tsx`. Add the import at the top:

```typescript
import OfflineBanner from '@/components/layout/OfflineBanner';
```

Then wrap the return in App with a fragment including `<OfflineBanner />` at the very top, before BrowserRouter. The return should look like:

```typescript
  return (
    <>
      <OfflineBanner />
      <BrowserRouter>
        ...existing content...
      </BrowserRouter>
    </>
  );
```

Also improve the loading spinner (replace the plain text with a centered skeleton):

```typescript
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading FinPulse...</p>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/components/layout/OfflineBanner.tsx frontend/src/App.tsx && git commit -m "feat: add offline banner and improve initial loading state"
```

---

## Task 4: Responsive Navigation — Collapsible Sidebar + Settings in Mobile Nav

**Files:**
- Modify: `frontend/src/components/layout/MainLayout.tsx`

The current sidebar is fixed at `w-60`. Phase 4 requires a collapsible sidebar (full on desktop, icon-only when collapsed). Also, Settings is currently excluded from the mobile bottom nav (only first 5 items shown). Settings should be accessible on mobile via the header or included in the nav.

- [ ] **Step 1: Rewrite MainLayout.tsx**

Replace the full contents of `frontend/src/components/layout/MainLayout.tsx`:

```typescript
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Target,
  BarChart2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/budget', icon: Target, label: 'Budget' },
  { to: '/analysis', icon: BarChart2, label: 'Analysis' },
];

// Settings shown in sidebar + mobile header (not bottom nav to preserve 5-item rule)
const settingsItem = { to: '/settings', icon: Settings, label: 'Settings' };

export default function MainLayout() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

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
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-r p-3 gap-1 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center mb-6 px-1 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold">FinPulse</h1>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.display_name ?? '...'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col gap-1">
          {[...navItems, settingsItem].map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-md px-2 py-2 text-sm transition-colors min-h-[44px] ${
                  collapsed ? 'justify-center' : 'gap-3'
                } ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="mt-auto border-t pt-3">
          <Button
            variant="ghost"
            className={`w-full text-muted-foreground min-h-[44px] ${
              collapsed ? 'justify-center px-2' : 'justify-start gap-3'
            }`}
            onClick={handleSignOut}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — shows app name + settings access */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-background">
          <h1 className="text-lg font-bold">FinPulse</h1>
          <div className="flex items-center gap-1">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center justify-center h-10 w-10 rounded-md transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background flex justify-around py-1 z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[48px] px-2 rounded-md text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/components/layout/MainLayout.tsx && git commit -m "feat: collapsible desktop sidebar, settings accessible on mobile header"
```

---

## Task 5: Responsive Layout Pass — All Pages

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/ExpensesPage.tsx`
- Modify: `frontend/src/pages/JournalPage.tsx`
- Modify: `frontend/src/pages/BudgetPage.tsx`
- Modify: `frontend/src/pages/AnalysisPage.tsx`

The goal is to ensure all pages use `max-w-7xl mx-auto` (wider cap for desktop), responsive column grids, and no horizontal overflow at 375px.

- [ ] **Step 1: Update DashboardPage.tsx responsive grid**

In `DashboardPage.tsx`, change:
- Container from `max-w-4xl` → `max-w-7xl`
- KPI summary cards already use `grid-cols-1 sm:grid-cols-3` — keep this ✅
- Charts grid: change from `grid-cols-1 md:grid-cols-2` → keep but wrap in `max-w-full`
- Ensure `QuickAddExpense` has full-width on mobile

Edit the main div:
```typescript
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
```

And the charts grid section (already `md:grid-cols-2`). Also add `xl:grid-cols-3` to the KPI cards:
```typescript
<div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-4 mb-6">
```

- [ ] **Step 2: Update ExpensesPage.tsx responsive layout**

In `ExpensesPage.tsx`, change:
```typescript
// Container
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">

// Header
<div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
  <h1 className="text-2xl font-bold">Expenses</h1>
  <div className="flex items-center gap-2">
    {/* CSV export button — added in Task 7 */}
    <Button onClick={() => setFormOpen(true)} className="min-h-[44px]">
      <Plus className="h-4 w-4 mr-2" />
      Add expense
    </Button>
  </div>
</div>
```

- [ ] **Step 3: Update JournalPage.tsx responsive layout**

In `JournalPage.tsx` (read it first), change the container:
```typescript
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
```

Ensure the "Add entry" button has `min-h-[44px]`.

- [ ] **Step 4: Update BudgetPage.tsx responsive layout**

In `BudgetPage.tsx`, change:
```typescript
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
```

Also update CategoryBudgetGrid to use a responsive grid. In `frontend/src/components/budget/CategoryBudgetGrid.tsx` (read first), the grid should be:
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

- [ ] **Step 5: Update AnalysisPage.tsx responsive layout**

In `AnalysisPage.tsx`, change:
```typescript
// From:
<div className="p-4 space-y-4 max-w-3xl">
// To:
<div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-4xl mx-auto">
```

The insight cards grid (currently `grid-cols-1 gap-3 sm:grid-cols-2`) stays as-is.

- [ ] **Step 6: Verify TypeScript and no regressions**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/pages/ frontend/src/components/budget/ && git commit -m "feat: responsive layout pass — wider desktop containers, consistent padding"
```

---

## Task 6: Mobile Form Optimizations

**Files:**
- Modify: `frontend/src/components/expenses/ExpenseForm.tsx`

- [ ] **Step 1: Read the current ExpenseForm.tsx**

Read `frontend/src/components/expenses/ExpenseForm.tsx` fully before editing.

- [ ] **Step 2: Add mobile input optimizations**

In the ExpenseForm, find the amount input and add `inputMode="decimal"`:
```typescript
<Input
  id="amount"
  type="number"
  step="0.01"
  min="0.01"
  inputMode="decimal"
  {...register('amount', { valueAsNumber: true })}
/>
```

Find the date input and verify it uses `type="date"` (native date picker on mobile):
```typescript
<Input
  id="expense_date"
  type="date"
  {...register('expense_date')}
/>
```

Ensure all buttons in the form have `min-h-[44px]` class.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/components/expenses/ExpenseForm.tsx && git commit -m "feat: mobile form optimizations — inputMode decimal, native date pickers, 44px touch targets"
```

---

## Task 6.5: Install shadcn Skeleton Component (Required — Do Not Skip)

**Files:**
- Create: `frontend/src/components/ui/skeleton.tsx` (auto-generated by shadcn CLI)

The `Skeleton` component from shadcn/ui is NOT yet in the codebase. Tasks 7 and 9 both import it — this install must run before those tasks.

- [ ] **Step 1: Install the shadcn Skeleton component**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx shadcn@latest add skeleton
```

Expected: `frontend/src/components/ui/skeleton.tsx` is created.

- [ ] **Step 2: Verify the component exists**

```bash
ls /Users/bronny/SaaSProjects/finpulse/frontend/src/components/ui/skeleton.tsx
```

Expected: File exists (not "No such file or directory").

- [ ] **Step 3: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/components/ui/skeleton.tsx && git commit -m "feat: add shadcn Skeleton component"
```

---

## Task 7: Loading, Error, and Empty States

**Files:**
- Modify: `frontend/src/components/expenses/ExpenseList.tsx`
- Modify: `frontend/src/pages/JournalPage.tsx` (and JournalList.tsx if it has its own list)
- Modify: `frontend/src/pages/BudgetPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/AnalysisPage.tsx` (empty state for no analyses yet)

The goal is to replace plain text loading states with shadcn Skeleton components, and improve empty states with actionable CTAs.

- [ ] **Step 1: Add Skeleton to ExpenseList.tsx**

In `frontend/src/components/expenses/ExpenseList.tsx`, replace the loading state:

```typescript
import { Skeleton } from '@/components/ui/skeleton';
// ...

// Replace loading block:
if (loading) {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

// Replace empty state:
if (expenses.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <Receipt className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">No expenses yet</p>
        <p className="text-sm text-muted-foreground">Add your first expense to start tracking</p>
      </div>
    </div>
  );
}
```

Add `Receipt` to the lucide-react import at the top of the file.

Note: The Skeleton component was installed in Task 6.5. Import it with `import { Skeleton } from '@/components/ui/skeleton';`.

- [ ] **Step 2: Improve loading state in DashboardPage**

In `DashboardPage.tsx`, the KPI cards show `{expenses.length}` which may be 0 during loading. Add loading prop handling to `SummaryCard` or guard with loading check. Read `frontend/src/components/dashboard/SummaryCard.tsx` first.

In the charts section, when `chartsLoading` is true, replace text "Loading..." with Skeleton components. The `MonthlySpendingChart` and `CategoryBreakdownChart` already receive `loading` prop — verify they use Skeleton internally. If not, read both files and add:

In each chart component, when `loading` is true, return:
```typescript
if (loading) {
  return (
    <Card>
      <CardHeader><Skeleton className="h-5 w-1/3" /></CardHeader>
      <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Improve Journal empty state**

Read `frontend/src/components/journal/JournalList.tsx`. Replace the loading and empty states with Skeleton and proper empty state:

```typescript
// Loading:
if (loading) {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// Empty:
if (entries.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">No journal entries yet</p>
        <p className="text-sm text-muted-foreground">
          Start journaling your financial decisions
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Improve Budget page skeleton**

In `BudgetPage.tsx`, replace the `<p>Loading...</p>` with:

```typescript
{summaryLoading ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    ))}
  </div>
) : (
  // ... existing CategoryBudgetGrid
)}
```

Also handle the empty case when `summary?.categories.length === 0`:
```typescript
{!summaryLoading && (summary?.categories ?? []).length === 0 && (
  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
    <Target className="h-10 w-10 text-muted-foreground" />
    <div>
      <p className="font-medium">No budget goals yet</p>
      <p className="text-sm text-muted-foreground">
        Set your first budget goal to start tracking
      </p>
    </div>
    <Button onClick={() => setGoalDialogOpen(true)}>Set a budget goal</Button>
  </div>
)}
```

Add `Target` to the lucide-react import if not already imported (it is — check line 8 of BudgetPage.tsx).

- [ ] **Step 5: Add AnalysisPage.tsx empty state for the History tab**

In `AnalysisPage.tsx`, the `HistoryTab` function already handles an empty array (lines 492–500). Verify it shows a helpful message. If the message is just "No analysis history yet", update it to be more actionable:

```typescript
{history && !loading && history.length === 0 && (
  <Card>
    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <BarChart2 className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">No analyses run yet</p>
        <p className="text-sm text-muted-foreground">
          Run your first analysis to see insights here
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

Also check the `ExpenseAnalysisTab` and `BudgetRecommendationsTab` — when `result` is null and not loading, show a prompt to run the analysis rather than showing nothing at all:

In `ExpenseAnalysisTab`, after the results block, add:
```typescript
{!result && !loading && !error && (
  <p className="text-center text-sm text-muted-foreground py-8">
    Select a date range and click "Analyze My Spending" to see insights.
  </p>
)}
```

Apply the same pattern to `BudgetRecommendationsTab`.

- [ ] **Step 6: Also confirm no `dangerouslySetInnerHTML` usage (XSS check)**

```bash
grep -r "dangerouslySetInnerHTML" /Users/bronny/SaaSProjects/finpulse/frontend/src/
```

Expected: No matches. React's default JSX escaping protects against XSS for all text-rendered content (journal entries, expense descriptions). If matches are found, wrap them with `DOMPurify.sanitize()` after installing `dompurify` and `@types/dompurify`.

- [ ] **Step 7: Verify TypeScript**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/components/ frontend/src/pages/ && git commit -m "feat: skeleton loading states and proper empty states across all pages"
```

---

## Task 8: CSV Export Utility

**Files:**
- Create: `frontend/src/lib/export.ts`
- Modify: `frontend/src/pages/ExpensesPage.tsx`

- [ ] **Step 1: Create the CSV export utility**

Create `frontend/src/lib/export.ts`:

```typescript
import type { Expense } from '@/types';

/**
 * Converts an array of expenses to a CSV string and triggers a browser download.
 *
 * Parameters:
 *   expenses: Expense[] — the list of expenses to export (already filtered/sorted)
 *
 * Output: Triggers a browser file download of `finpulse-expenses-YYYY-MM-DD.csv`
 *
 * Dependencies: None (uses browser Blob + URL APIs)
 */
export function exportExpensesToCSV(expenses: Expense[]): void {
  const headers = ['Date', 'Category', 'Amount', 'Description', 'Notes'];

  const rows = expenses.map((e) => [
    e.expense_date,
    e.categories?.name ?? '',
    e.amount.toFixed(2),
    `"${e.description.replace(/"/g, '""')}"`,
    `"${(e.notes ?? '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `finpulse-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add Export button to ExpensesPage.tsx**

In `ExpensesPage.tsx`, add the import:
```typescript
import { Download } from 'lucide-react';
import { exportExpensesToCSV } from '@/lib/export';
```

Update the header section to include the Export button next to Add expense:

```typescript
<div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
  <h1 className="text-2xl font-bold">Expenses</h1>
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      onClick={() => exportExpensesToCSV(expenses)}
      disabled={expenses.length === 0}
      className="min-h-[44px]"
    >
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
    <Button onClick={() => setFormOpen(true)} className="min-h-[44px]">
      <Plus className="h-4 w-4 mr-2" />
      Add expense
    </Button>
  </div>
</div>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/lib/export.ts frontend/src/pages/ExpensesPage.tsx && git commit -m "feat: CSV export utility and Export button on Expenses page"
```

---

## Task 9: Full Settings Page

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

The current SettingsPage is a stub. Replace it with a full implementation covering: profile (display name, currency), monthly budget goal, AI usage, CSV export, and sign out.

- [ ] **Step 1: Rewrite SettingsPage.tsx**

Replace the full contents of `frontend/src/pages/SettingsPage.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { exportExpensesToCSV } from '@/lib/export';
import { api } from '@/lib/api';
import type { TokenUsageSummary } from '@/types';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, LogOut, User, Wallet, Bot } from 'lucide-react';

// ── Currency options ──────────────────────────────────────────────────────────
const CURRENCY_OPTIONS = [
  { value: 'PHP', label: 'PHP — Philippine Peso' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
];

// ── Profile Section ───────────────────────────────────────────────────────────
function ProfileSection() {
  const { profile, setProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'PHP');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName.trim(), currency })
        .eq('id', user.id)
        .select()
        .single();

      if (dbError) throw dbError;
      setProfile(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>Profile updated successfully.</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Budget Goal Section ───────────────────────────────────────────────────────
function BudgetGoalSection() {
  const { profile, setProfile } = useAuthStore();
  const [amount, setAmount] = useState(
    profile?.monthly_budget_goal ? String(profile.monthly_budget_goal) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    let num: number | null = null;
    if (amount) {
      num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        setError('Amount must be a positive number.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .update({ monthly_budget_goal: num })
        .eq('id', user.id)
        .select()
        .single();

      if (dbError) throw dbError;
      setProfile(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Monthly Budget Goal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>Budget goal updated.</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="budget-goal">Overall Monthly Budget</Label>
          <Input
            id="budget-goal"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50000.00"
          />
          <p className="text-xs text-muted-foreground">Leave empty to remove the goal.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
          {saving ? 'Saving...' : 'Save Goal'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── AI Usage Section ──────────────────────────────────────────────────────────
function AiUsageSection() {
  const [usage, setUsage] = useState<TokenUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<TokenUsageSummary>('/analysis/token-usage')
      .then(setUsage)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          AI Usage (This Month)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load AI usage data.</p>
        ) : usage ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{usage.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Tokens Used</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{usage.analysis_count}</p>
              <p className="text-xs text-muted-foreground">Analyses Run</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">${usage.estimated_cost_usd.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground">Est. Cost (USD)</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No AI usage this month.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Data Section ──────────────────────────────────────────────────────────────
// Note: We use supabase directly here to fetch-then-export in one flow,
// avoiding the stale closure problem of reading `expenses` from the hook after
// an async fetchExpenses call (hook sets state, but closure captures old value).
function DataSection() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('expenses')
        .select('*, categories(name, icon, color)')
        .eq('user_id', userId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      exportExpensesToCSV(data ?? []);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4" />
          Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Export all your expense data as a CSV file.
        </p>
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="min-h-[44px]">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export Expenses to CSV'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Account Section ───────────────────────────────────────────────────────────
function AccountSection() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LogOut className="h-4 w-4" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={handleSignOut}
          disabled={signingOut}
          className="min-h-[44px]"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Page Root ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
      </div>
      <ProfileSection />
      <BudgetGoalSection />
      <AiUsageSection />
      <DataSection />
      <AccountSection />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add frontend/src/pages/SettingsPage.tsx && git commit -m "feat: full settings page — profile edit, budget goal, AI usage, CSV export, sign out"
```

---

## Task 10: Backend Rate Limiting on LLM Endpoints

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/apps/analysis/views.py`
- Modify: `backend/core/settings.py`

Rate limit: max 10 analysis requests per hour per user (combined across both endpoints). Uses Django's cache framework (in-memory for dev, Redis for prod).

- [ ] **Step 1: Add Django cache configuration to settings.py**

No new packages needed — the rate limiting implementation uses Django's built-in cache framework with the `locmem` backend (already part of Django core). Skip directly to Step 2.

Verify Django cache is not already configured in `backend/core/settings.py` by reading it. If a `CACHES` block already exists, skip this sub-step. Otherwise, see Step 2.

- [ ] **Step 2: Add cache config to settings.py**

In `backend/core/settings.py`, add after the REST_FRAMEWORK block:

```python
# Cache — used for rate limiting. In production, swap to Redis via CACHE_URL.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'finpulse-ratelimit',
    }
}
```

Also add `'django.contrib.sessions'` is not needed, but ensure the cache is configured before analysis views are imported.

- [ ] **Step 3: Add rate limiting to analysis views.py**

In `backend/apps/analysis/views.py`, implement manual rate limiting using Django cache (avoids needing django-ratelimit's decorator which requires request.user which we don't have — we have request.user_id):

Add at the top of the file:
```python
from django.core.cache import cache
import time
```

Add a helper function after the imports:

```python
def _check_rate_limit(user_id: str, endpoint: str, max_calls: int = 10, window_seconds: int = 3600) -> bool:
    """
    Returns True if the user is within the rate limit, False if they've exceeded it.

    Uses Django cache to count calls per user per endpoint per hour.
    Key format: ratelimit:{endpoint}:{user_id}:{window_start}
    """
    window_start = int(time.time() // window_seconds)
    cache_key = f'ratelimit:{endpoint}:{user_id}:{window_start}'

    current = cache.get(cache_key, 0)
    if current >= max_calls:
        return False

    cache.set(cache_key, current + 1, timeout=window_seconds)
    return True
```

In `analyze_expenses` view, add rate limit check right after the user_id check:

```python
    if not _check_rate_limit(user_id, 'analyze_expenses'):
        return Response(
            {'error': 'Rate limit exceeded. Maximum 10 analyses per hour. Please try again later.'},
            status=429,
        )
```

In `budget_recommendations` view, add the same check:

```python
    if not _check_rate_limit(user_id, 'budget_recommendations'):
        return Response(
            {'error': 'Rate limit exceeded. Maximum 10 recommendations per hour. Please try again later.'},
            status=429,
        )
```

- [ ] **Step 4: Verify Django starts without errors**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend && python manage.py check
```

Expected: `System check identified no issues`.

- [ ] **Step 5: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add backend/core/settings.py backend/apps/analysis/views.py && git commit -m "feat: rate limiting on LLM endpoints (10 requests/hour per user, Django locmem cache)"
```

---

## Task 11: Backend Security Hardening

**Files:**
- Modify: `backend/core/settings.py`

- [ ] **Step 1: Update ALLOWED_HOSTS and production security settings**

In `backend/core/settings.py`, replace the ALLOWED_HOSTS line:

```python
# Parse ALLOWED_HOSTS from env var; fall back to local dev defaults
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = (
    [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()]
    if _allowed_hosts_env
    else ['localhost', '127.0.0.1', '0.0.0.0']
)
```

After `DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'`, add:

```python
# Security settings — only apply in production (DEBUG=False)
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = False  # Railway/Vercel handle HTTPS at the load balancer
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
```

Also add STATIC_ROOT for collectstatic in production (Railway needs this):

```python
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
```

Replace the existing `STATIC_URL = '/static/'` line.

- [ ] **Step 2: Add LOGGING config for production**

In `backend/core/settings.py`, at the end, add:

```python
# Logging — WARNING level in production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING' if not DEBUG else 'INFO',
            'propagate': False,
        },
    },
}
```

- [ ] **Step 3: Verify Django**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend && python manage.py check
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add backend/core/settings.py && git commit -m "feat: production security hardening — ALLOWED_HOSTS from env, STATIC_ROOT, production logging"
```

---

## Task 12: Deployment Configuration (Railway + Vercel)

**Files:**
- Create: `backend/Procfile`
- Create: `backend/runtime.txt`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add gunicorn to requirements**

In `backend/requirements.txt`, add:
```
gunicorn==23.0.0
```

Install:
```bash
cd /Users/bronny/SaaSProjects/finpulse/backend && pip install gunicorn && pip freeze | grep gunicorn >> /dev/null
```

Manually add `gunicorn==23.0.0` (or the actual installed version — run `pip show gunicorn | grep Version`) to requirements.txt.

- [ ] **Step 2: Create Procfile**

Create `backend/Procfile`:
```
web: gunicorn core.wsgi --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

- [ ] **Step 3: Create runtime.txt**

Get the current Python version:
```bash
python --version
```

Create `backend/runtime.txt` with the result (e.g.):
```
python-3.12.x
```

Replace `x` with the actual patch version from the command above.

- [ ] **Step 4: Create .env.example for deployment reference**

If there isn't already a `backend/.env.example`, create one (without any real values):

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
DJANGO_SECRET_KEY=generate-a-long-random-string
DJANGO_DEBUG=False
ALLOWED_HOSTS=your-railway-domain.railway.app
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

- [ ] **Step 5: Verify gunicorn can load the WSGI app**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend && gunicorn core.wsgi --check-config
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add backend/Procfile backend/runtime.txt backend/requirements.txt && git commit -m "feat: Railway deployment config — Procfile, gunicorn, runtime.txt"
```

---

## Task 13: Build Verification

Verify the frontend builds cleanly without TypeScript errors or ESLint warnings.

- [ ] **Step 1: TypeScript strict check**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: ESLint check**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npx eslint src --max-warnings=0
```

Fix any warnings before continuing.

- [ ] **Step 3: Production build**

```bash
cd /Users/bronny/SaaSProjects/finpulse/frontend && npm run build
```

Expected: Build succeeds. Output in `frontend/dist/`. Service worker manifest should be present.

- [ ] **Step 4: Verify PWA assets in dist**

```bash
ls /Users/bronny/SaaSProjects/finpulse/frontend/dist/ | grep -E 'manifest|sw|workbox'
```

Expected: `manifest.webmanifest` and `sw.js` (or `workbox-*.js`) present.

- [ ] **Step 5: Django system check**

```bash
cd /Users/bronny/SaaSProjects/finpulse/backend && python manage.py check
```

Expected: No issues.

- [ ] **Step 6: Final commit with build verification note**

```bash
cd /Users/bronny/SaaSProjects/finpulse && git add -A && git commit -m "feat: Phase 4 complete — PWA, responsive polish, settings, rate limiting, deployment config"
```

---

## Acceptance Criteria Checklist

After all tasks complete, verify against the Phase 4 spec:

- [ ] PWA manifest present in build output (`manifest.webmanifest`)
- [ ] PWA icons (192×192, 512×512) exist in `frontend/public/`
- [ ] Service worker generated by workbox (autoUpdate registration)
- [ ] Offline banner appears when `navigator.onLine` is false
- [ ] Desktop sidebar collapses to icon-only width
- [ ] All pages use responsive padding (`p-4 md:p-6 lg:p-8`)
- [ ] Dashboard KPI cards: single column mobile, 3-column sm+
- [ ] Budget category grid: 1-col mobile, 2-col sm, 3-col lg
- [ ] Bottom nav has minimum 44×44px touch targets
- [ ] Amount inputs use `inputMode="decimal"`, date inputs use `type="date"`
- [ ] Expense list shows skeleton rows during loading
- [ ] Expense list shows empty state with icon + CTA when no expenses
- [ ] Journal shows skeleton + empty state
- [ ] Budget page shows skeleton + empty state with "Set a budget goal" CTA
- [ ] CSV export works: clicking button downloads valid `.csv` file
- [ ] Settings page shows all 5 sections (Profile, Budget Goal, AI Usage, Data, Account)
- [ ] Profile editing saves display_name + currency to Supabase
- [ ] LLM endpoints return 429 after 10 requests per hour per user
- [ ] `ALLOWED_HOSTS` reads from environment variable
- [ ] `STATIC_ROOT` configured for production collectstatic
- [ ] `Procfile` and `runtime.txt` present in `backend/`
- [ ] `npm run build` succeeds with 0 TypeScript errors
- [ ] `python manage.py check` reports no issues
