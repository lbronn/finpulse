# Product Brief — FinPulse (Personal Finance + AI Insights)

> **Status:** MVP — Active Development
> **Owner:** Bronn
> **Last Updated:** March 14, 2026

---

## What Is This?

FinPulse is a personal finance PWA (Progressive Web App) that combines manual expense tracking, journaling, and budget management with AI-powered financial analysis and recommendations. Think of it as a personal finance tracker that actually *understands* your spending patterns and gives you actionable advice — not just charts.

## Who Is It For?

**Primary user (MVP):** Bronn — personal use. The app is built for a single user who wants to track expenses, journal financial decisions, set budget goals, and get AI-generated insights on spending behavior.

**Future (post-MVP):** Potential SaaS product for individuals who want an AI-powered personal finance assistant. Multi-tenancy and onboarding would be added at that stage.

## Core Problem

Most expense trackers are dumb — they show you *what* you spent, but don't tell you *why* your spending patterns look the way they do, or *what* to do about it. Manual tracking apps lack intelligence; AI finance tools lack the personal context of manual journaling and goal-setting.

## Core Value Proposition

A single app where you:
1. Log expenses and journal entries (the data layer)
2. Set budget goals and track progress (the accountability layer)
3. Get AI-powered analysis of your spending patterns and personalized budget recommendations (the intelligence layer)

## Core Features (MVP Scope)

### 1. Expense Tracker
- Add, edit, delete expenses
- Categorize expenses (manual categorization in MVP; auto-categorization in post-MVP)
- View expense history with filters (date range, category, amount range)
- Recurring expense support is **out of MVP scope**

### 2. Journal
- Add, edit, delete journal entries
- Entries are timestamped and tagged (optional tags)
- Purpose: capture context behind financial decisions ("bought new laptop because old one died", "eating out more because of work stress")
- No rich text editor in MVP — plain text with optional tags

### 3. Budget Tracker
- Set monthly budget goals (overall and per-category)
- Dashboard showing actual vs. target spending
- Visual progress indicators (progress bars, simple charts)
- Alerts/warnings when approaching or exceeding budget limits

### 4. Expense Analysis (AI-Powered)
- User triggers analysis on demand (not automatic in MVP)
- Sends structured expense data to LLM (Claude Sonnet)
- Returns natural language insights: spending trends, anomalies, category breakdowns, month-over-month comparisons
- Displayed as a card-based UI in the Analysis page

### 5. Budget Recommendations (AI-Powered)
- User triggers recommendations on demand
- Takes expense history + budget goals + journal context as input
- Returns actionable budget adjustment suggestions
- Explains *why* each recommendation is made, grounded in the user's actual data

## What's Explicitly Out of MVP Scope

- Multi-user / multi-tenancy
- Bank account linking or auto-import (Plaid, etc.)
- Recurring expenses / subscriptions tracking
- Auto-categorization of expenses (AI-based)
- Mobile native app (PWA only)
- Notifications / push alerts
- Data export beyond CSV
- Shared budgets or household features
- Receipt scanning / OCR

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React.TS + Vite | PWA shell, UI |
| Styling | Tailwind CSS + shadcn/ui | Component library, responsive design |
| Auth | Supabase Auth | Sign-up, login, JWT, session management |
| Database | Supabase Postgres | Schema, RLS, direct CRUD from frontend |
| Backend API | Django + DRF | Business logic, aggregation, LLM orchestration |
| LLM | Anthropic Claude Sonnet (claude-sonnet-4-20250514) | Expense analysis, budget recommendations |
| State Management | Zustand | Client-side state |
| Deployment | Vercel (frontend) + Railway (Django) + Supabase Cloud (DB/Auth) | Hosting |

## Architecture Pattern

**Hybrid backend:** The frontend talks to *two* backends depending on the operation:

- **Supabase (direct):** Simple CRUD — creating/reading/updating/deleting expenses, journal entries, budget goals. Frontend uses the Supabase JS client with RLS for security.
- **Django API:** Complex operations — expense aggregation queries, LLM-powered analysis, budget recommendations, any business logic that requires server-side computation.

Django authenticates requests by validating Supabase JWT tokens (not its own auth system).

## Success Criteria (MVP)

1. **Functional:** All 5 core features work end-to-end for a single user.
2. **Usable:** The app is installable as a PWA and usable on mobile.
3. **Intelligent:** AI analysis returns genuinely useful, personalized insights — not generic finance advice.
4. **Maintainable:** Codebase is clean, typed, and structured for easy post-MVP extension.

## Design Principles

- **Data entry must be fast.** If logging an expense takes more than 10 seconds, the user will stop doing it.
- **AI features are a complement, not the core.** The tracker must be fully usable without AI. AI enhances, not replaces.
- **Mobile-first responsive design.** This is a personal finance app — most usage will be on mobile.
- **No dark patterns.** No gamification, no streaks, no guilt. Just clean, useful information.