# FinPulse

> A personal finance tracker that doesn't just show you what you spent — it tells you why your patterns look the way they do, and what to do about it.

---

## What Is FinPulse?

FinPulse is a personal finance Progressive Web App (PWA) built for people who want more than just a spreadsheet. It combines three things most finance apps keep separate:

- **Expense tracking** — log and categorize your spending
- **Journaling** — capture the *context* behind your financial decisions
- **AI-powered insights** — get personalized analysis and budget recommendations based on your actual data

The idea is simple: data without understanding is just noise. FinPulse gives you the full picture — not just charts, but real, actionable advice grounded in your own spending history and journal entries.

---

## Who Is It For?

FinPulse is built first and foremost as a **personal tool** — for someone who wants a smarter, more intentional way to manage their finances without the bloat of enterprise-level apps.

Down the road, it's designed to grow into a SaaS product for individuals who want an AI-powered personal finance assistant — people who are tired of generic budgeting advice and want something that actually understands their situation.

---

## Why Was It Built?

Most expense trackers are passive. They show you a pie chart of where your money went, and that's it. They don't ask *why* you overspent on dining out last month, or connect the dots between your stress journaling and your impulse purchases.

FinPulse was built to close that gap — a tool that respects your intelligence, gives you the context you logged yourself, and uses AI to surface insights you might not have noticed on your own.

---

## Core Features

| Feature | What It Does |
|---|---|
| Expense Tracker | Add, edit, delete, and categorize expenses. Filter by date, category, or amount. |
| Journal | Write entries tied to financial decisions. Add optional tags for context. |
| Budget Goals | Set monthly budgets overall or per category. Track actual vs. target with visual progress. |
| Expense Analysis | On-demand AI analysis of your spending patterns, trends, and anomalies. |
| Budget Recommendations | AI-generated suggestions for budget adjustments, grounded in your real data and journals. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Auth & Database | Supabase (Postgres + Auth) |
| Backend API | Django + Django REST Framework |
| AI | Anthropic Claude Sonnet |
| State Management | Zustand |
| Deployment | Vercel (frontend), Railway (backend), Supabase Cloud (DB/Auth) |

---

## Project Structure Overview

```
finpulse/
├── docs/                   # Product brief, PRD, architecture docs, and phase prompts
│   ├── product-brief.md    # What we're building and why
│   ├── prd.md              # Detailed feature specs and acceptance criteria
│   ├── architecture.md     # Key technical decisions
│   ├── database-schema.md  # Database schema and policies
│   └── prompts/            # Step-by-step build phases (1–4)
├── frontend/               # React + TypeScript PWA
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level views
│   │   ├── stores/         # Zustand state management
│   │   ├── lib/            # Supabase client, utilities
│   │   └── types/          # Shared TypeScript types
│   └── public/             # PWA manifest and icons
└── backend/                # Django REST API
    ├── expenses/           # Aggregation and analytics endpoints
    ├── ai/                 # LLM orchestration (analysis + recommendations)
    └── core/               # Auth middleware, shared utilities
```

---

## Status

**MVP — Active Development.** Built in 4 phases:

1. Scaffolding, auth, expense + journal CRUD
2. Budget tracking and charts
3. LLM integration for analysis and recommendations
4. PWA setup, responsive polish, and deployment

---

## Made By
Le Bronn — a software and AI engineer passionate about building tools that empower people to take control of their finances with clarity and confidence. This project is a personal endeavor to create the kind of finance app I wish existed when I started managing my own money.