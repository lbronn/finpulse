# Phase 4 Prompt — Polish & PWA (Week 4)

> **Goal:** Production-ready personal tool, installable as PWA, deployed and accessible.
> **Prerequisites:** Phase 3 complete — all features working end-to-end including AI analysis.

---

## Context Files to Read First

1. `product-brief.md` — design principles (fast data entry, mobile-first, no dark patterns)
2. `prd.md` — section 7 (Non-Functional Requirements)
3. Previous phase prompts — full feature context

---

## Step-by-Step Implementation

### Step 1: PWA Configuration

**Install Vite PWA plugin:**
```bash
cd frontend && npm install -D vite-plugin-pwa
```

**Configure in `vite.config.ts`:**
```typescript
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
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-cache',
                            expiration: { maxEntries: 50, maxAgeSeconds: 300 }
                        }
                    }
                ]
            }
        })
    ]
});
```

**Create PWA icons:**
- Generate icons at 192x192 and 512x512 from a simple logo (can be a text-based icon initially)
- Place in `frontend/public/`

**Offline fallback:** The service worker should cache the app shell. Data operations require connectivity (no offline CRUD in MVP). Show a clear "You're offline" banner when the network is unavailable.

### Step 2: Responsive Design Pass

The app should be fully usable at 375px width (iPhone SE) up to 1440px+ (desktop).

**Navigation:**
- Mobile (< 768px): Bottom navigation bar with 5 icons (Dashboard, Expenses, Journal, Budget, Analysis). Settings accessible via profile icon in header.
- Desktop (≥ 768px): Side navigation with labels + icons. Collapsible to icon-only.

**Layout adjustments:**
- Dashboard: Stack all cards vertically on mobile. 2-column grid on tablet. 3-column on desktop.
- Expense list: Full-width card list on mobile. Table view on desktop.
- Budget page: Single-column category cards on mobile. Grid on desktop.
- Analysis page: Full-width insight cards on all sizes. Tabs remain consistent.
- Charts: Must resize responsively. recharts `ResponsiveContainer` handles this.

**Touch targets:** All buttons and interactive elements must be at least 44x44px on mobile (Apple HIG guideline).

**Form usability on mobile:**
- Date picker should use native date input on mobile (`type="date"`)
- Amount input should trigger numeric keyboard (`inputMode="decimal"`)
- Category select should be easy to tap (large touch targets)

### Step 3: Loading, Error, and Empty States

Every page and component that fetches data must handle three states:

**Loading states:**
- Use shadcn Skeleton components for content placeholders
- Charts show skeleton chart shapes (gray rectangles mimicking bars/slices)
- Lists show 3-5 skeleton rows
- AI analysis shows skeleton cards with pulsing animation

**Error states:**
- API errors: show an Alert component (shadcn) with the error message and a "Retry" button
- Auth errors: redirect to login with a toast notification
- LLM errors: show a specific message ("Analysis couldn't be completed. Please try again.") with retry
- Network errors: show offline banner

**Empty states:**
- No expenses: illustration or icon + "No expenses yet" + CTA button to add first expense
- No journal entries: similar pattern
- No budget goals: "Set your first budget goal to start tracking" + CTA
- No analysis results: "Run your first analysis to see insights"
- Empty chart data: chart area shows a centered message instead of empty axes

### Step 4: Data Export (CSV)

Add a "Export to CSV" button on the Expenses page and Settings page.

**Implementation:**
```typescript
function exportExpensesToCSV(expenses: Expense[]) {
    const headers = ['Date', 'Category', 'Amount', 'Description', 'Notes'];
    const rows = expenses.map(e => [
        e.expense_date,
        e.category_name,
        e.amount.toFixed(2),
        `"${e.description.replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `finpulse-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
```

### Step 5: Security Hardening

**Frontend:**
- Verify all Supabase queries go through the JS client (which handles RLS)
- No API keys in frontend code except `VITE_SUPABASE_ANON_KEY` (which is designed to be public)
- Sanitize user inputs before display (prevent XSS in journal entries, expense descriptions)

**Django:**
- Verify every API endpoint uses `request.user_id` from the JWT middleware
- Add rate limiting to LLM endpoints (prevent runaway API costs):
  ```python
  # Simple rate limiting: max 10 analysis requests per hour per user
  # Use Django cache framework or a simple in-memory counter
  ```
- Validate all request body inputs (date formats, required fields)
- Set `DEBUG=False` in production settings
- Configure `ALLOWED_HOSTS`

**Supabase:**
- Review all RLS policies: test that user A cannot access user B's data
- Verify service role key is never exposed to frontend
- Disable Supabase API features you're not using (Realtime, Storage — if unused)

### Step 6: Settings Page

Build the `/settings` page with:

1. **Profile section:** display name, currency preference (editable)
2. **Overall budget goal:** editable monthly budget target
3. **AI Usage section:** tokens used this month, estimated cost, analyses run
4. **Data section:** "Export Expenses to CSV" button
5. **Account section:** "Sign Out" button

### Step 7: Deployment

**Frontend → Vercel:**
```bash
cd frontend
npx vercel
```
- Set environment variables in Vercel dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- Build command: `npm run build`
- Output directory: `dist`

**Backend → Railway:**
- Create a `Procfile` in `backend/`:
  ```
  web: gunicorn core.wsgi --bind 0.0.0.0:$PORT
  ```
- Install gunicorn: `pip install gunicorn && pip freeze > requirements.txt`
- Create `runtime.txt` with Python version
- Set environment variables in Railway: `DATABASE_URL`, `DJANGO_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CORS_ALLOWED_ORIGINS` (set to Vercel URL)
- Ensure `DJANGO_DEBUG=False` and `ALLOWED_HOSTS` includes Railway domain

**Supabase:** Already deployed (Supabase Cloud). No additional deployment needed.

**Post-deployment checklist:**
- [ ] Frontend loads on Vercel URL
- [ ] Auth flow works (sign up, sign in, sign out)
- [ ] Frontend can reach Django API on Railway
- [ ] Django can reach Supabase Postgres
- [ ] LLM analysis works in production
- [ ] PWA installable on mobile (test on actual phone)
- [ ] HTTPS enforced on all services

### Step 8: Final QA Pass

Go through every feature end-to-end:

1. Sign up a new account
2. Set display name and currency
3. Add 10+ expenses across multiple categories
4. Write 3+ journal entries
5. Set budget goals for 4-5 categories
6. View dashboard — verify charts render with real data
7. Navigate to Budget page — verify progress bars are accurate
8. Run expense analysis — verify insights reference real data
9. Run budget recommendations — verify journal context is used
10. Export expenses to CSV — verify file contents
11. Install as PWA on phone — verify it works
12. Test on mobile — verify all pages are usable at 375px width

---

## Phase 4 Acceptance Criteria

- [ ] PWA is installable on Android and iOS (via browser "Add to Home Screen")
- [ ] App works on mobile (375px) through desktop (1440px+)
- [ ] Bottom navigation on mobile, sidebar on desktop
- [ ] All pages have loading, error, and empty states
- [ ] Offline banner shown when network unavailable
- [ ] CSV export works correctly
- [ ] Settings page shows profile, AI usage, and export options
- [ ] Rate limiting on LLM endpoints (max 10/hour)
- [ ] All RLS policies verified — no data leakage between users
- [ ] Deployed: frontend on Vercel, backend on Railway, DB on Supabase Cloud
- [ ] All environment variables set in production
- [ ] HTTPS enforced
- [ ] Full QA pass completed with real data

---

## Code Quality Reminders

- Run TypeScript compiler in strict mode — fix all type errors before deploying
- Run ESLint with no warnings before deploying
- Test on an actual mobile device, not just browser DevTools responsive mode
- Verify that PWA caching doesn't serve stale data after deployments (autoUpdate registration type helps)
- Keep production Django logs at WARNING level (not DEBUG)
- Document any known issues or trade-offs in README.md