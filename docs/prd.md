# Product Requirements Document (prd) — FinPulse MVP

> **Version:** 1.0
> **Owner:** Bronn
> **Last Updated:** March 14, 2026
> **Status:** MVP — Active Development

---

## 1. Overview

Refer to `product-brief.md` for high-level context, value proposition, and stakeholder information. This document covers the detailed functional requirements, data models, API contracts, and acceptance criteria for the MVP build.

---

## 2. User Roles

**MVP has one role: Authenticated User.** All features require authentication via Supabase Auth.

| Role | Description | Auth Method |
|---|---|---|
| User | Single authenticated user (Bronn) | Supabase Auth (email/password) |

Post-MVP will introduce roles like Admin, Free User, Premium User if SaaS conversion happens.

---

## 3. Data Models

### 3.1 — `user_profiles`

Extends Supabase's built-in `auth.users`. Stores app-specific user preferences.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, FK → auth.users.id | Supabase user ID |
| display_name | VARCHAR(100) | NOT NULL | User's display name |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'PHP' | Preferred currency code (ISO 4217) |
| monthly_budget_goal | DECIMAL(12,2) | NULLABLE | Overall monthly budget target |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Account creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last profile update |

### 3.2 — `categories`

Predefined + user-custom expense categories.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Category ID |
| user_id | UUID | FK → auth.users.id | Owner (NULL for system defaults) |
| name | VARCHAR(50) | NOT NULL | Category name |
| icon | VARCHAR(30) | NULLABLE | Icon identifier (emoji or icon name) |
| color | VARCHAR(7) | NULLABLE | Hex color code for UI display |
| is_default | BOOLEAN | NOT NULL, DEFAULT false | True for system-provided categories |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |

**Seed categories (is_default = true):** Food & Dining, Transportation, Housing, Utilities, Entertainment, Shopping, Healthcare, Education, Personal Care, Savings, Other.

### 3.3 — `expenses`

Core expense records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Expense ID |
| user_id | UUID | FK → auth.users.id, NOT NULL | Owner |
| category_id | UUID | FK → categories.id, NOT NULL | Expense category |
| amount | DECIMAL(12,2) | NOT NULL, CHECK > 0 | Expense amount |
| description | VARCHAR(255) | NOT NULL | What the expense was for |
| notes | TEXT | NULLABLE | Additional context |
| expense_date | DATE | NOT NULL | Date the expense occurred |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Indexes:**
- `idx_expenses_user_date` on (user_id, expense_date DESC)
- `idx_expenses_user_category` on (user_id, category_id)

### 3.4 — `journal_entries`

Financial journal / decision log.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Entry ID |
| user_id | UUID | FK → auth.users.id, NOT NULL | Owner |
| title | VARCHAR(200) | NOT NULL | Entry title |
| content | TEXT | NOT NULL | Entry body (plain text) |
| tags | TEXT[] | NULLABLE, DEFAULT '{}' | Array of string tags |
| entry_date | DATE | NOT NULL | Date of the entry |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Indexes:**
- `idx_journal_user_date` on (user_id, entry_date DESC)

### 3.5 — `budget_goals`

Per-category monthly budget targets.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Goal ID |
| user_id | UUID | FK → auth.users.id, NOT NULL | Owner |
| category_id | UUID | FK → categories.id, NOT NULL | Target category |
| amount | DECIMAL(12,2) | NOT NULL, CHECK > 0 | Monthly budget limit |
| month | DATE | NOT NULL | First day of the target month (e.g., 2026-03-01) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Constraints:**
- UNIQUE on (user_id, category_id, month) — one goal per category per month.

### 3.6 — `analysis_history`

Stores AI-generated analysis results for reference.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Analysis ID |
| user_id | UUID | FK → auth.users.id, NOT NULL | Owner |
| analysis_type | VARCHAR(30) | NOT NULL, CHECK IN ('expense_analysis', 'budget_recommendation') | Type of analysis |
| input_summary | JSONB | NOT NULL | Summary of data sent to LLM |
| result | JSONB | NOT NULL | LLM response (structured) |
| model_used | VARCHAR(50) | NOT NULL | Model identifier |
| tokens_used | INTEGER | NULLABLE | Total tokens consumed |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When analysis was generated |

---

## 4. Row-Level Security (RLS) Policies

Every table must have RLS enabled. Policies follow this pattern:

```sql
-- Template for all user-owned tables
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table_name}_select_own" ON {table_name}
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "{table_name}_insert_own" ON {table_name}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "{table_name}_update_own" ON {table_name}
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "{table_name}_delete_own" ON {table_name}
  FOR DELETE USING (auth.uid() = user_id);
```

**Special case — `categories`:** Default categories (is_default = true, user_id IS NULL) must be readable by all authenticated users:

```sql
CREATE POLICY "categories_select_defaults" ON categories
  FOR SELECT USING (is_default = true OR auth.uid() = user_id);
```

---

## 5. Feature Specifications

### 5.1 — Authentication

**Provider:** Supabase Auth (email/password for MVP)

**Flows:**
- Sign up: email + password → Supabase creates user → app creates `user_profiles` row → redirect to dashboard
- Sign in: email + password → Supabase returns JWT → stored in client → redirect to dashboard
- Sign out: clear session → redirect to login
- Protected routes: all routes except `/login` and `/signup` require valid session

**Acceptance Criteria:**
- [ ] User can sign up with email and password
- [ ] User can sign in and is redirected to dashboard
- [ ] Unauthenticated users are redirected to login page
- [ ] JWT token is sent in Authorization header for Django API calls
- [ ] Sign out clears session completely

### 5.2 — Expense Tracker

**Pages:** `/expenses`

**UI Components:**
- Expense list (sortable by date, filterable by category and date range)
- Add expense form (modal or inline)
- Edit expense form (same as add, pre-filled)
- Delete confirmation dialog

**CRUD Operations (via Supabase client):**
- CREATE: Insert into `expenses` table
- READ: Select from `expenses` with filters, ordered by expense_date DESC
- UPDATE: Update existing expense row
- DELETE: Delete expense row

**Form Fields:**
- Amount (number input, required, > 0)
- Description (text input, required, max 255 chars)
- Category (select dropdown from `categories`, required)
- Date (date picker, required, defaults to today)
- Notes (textarea, optional)

**Acceptance Criteria:**
- [ ] User can add an expense with all required fields
- [ ] User can view a list of all their expenses
- [ ] User can filter expenses by category
- [ ] User can filter expenses by date range
- [ ] User can edit an existing expense
- [ ] User can delete an expense (with confirmation)
- [ ] Form validates required fields and shows errors
- [ ] Amounts display in user's preferred currency format

### 5.3 — Journal

**Pages:** `/journal`

**UI Components:**
- Journal entry list (chronological, newest first)
- Add entry form (full page or modal)
- Edit entry form
- Tag filter/search

**CRUD Operations (via Supabase client):**
- Same pattern as expenses

**Form Fields:**
- Title (text input, required, max 200 chars)
- Content (textarea, required, plain text)
- Tags (tag input — type and press enter to add, optional)
- Date (date picker, required, defaults to today)

**Acceptance Criteria:**
- [ ] User can create a journal entry
- [ ] User can view all journal entries chronologically
- [ ] User can edit and delete entries
- [ ] User can add/remove tags on entries
- [ ] User can filter entries by tag
- [ ] Entries display date and tags clearly

### 5.4 — Budget Tracker

**Pages:** `/budget`

**UI Components:**
- Overall monthly budget summary (total spent vs. overall goal)
- Per-category budget cards (spent vs. goal, progress bar)
- Budget goal setting form (set/edit amount per category per month)
- Month selector (navigate between months)

**Data Flow:**
- Budget goals: CRUD via Supabase client (simple writes to `budget_goals`)
- Aggregation: Django API endpoint `GET /api/budgets/summary?month=2026-03` returns aggregated spending per category for the requested month

**Django API — Budget Summary Endpoint:**

```
GET /api/budgets/summary?month=YYYY-MM

Response:
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
      "goal": 15000.00,
      "spent": 12300.00,
      "remaining": 2700.00,
      "percentage": 82.0
    }
  ]
}
```

**Acceptance Criteria:**
- [ ] User can set a monthly budget goal per category
- [ ] User can set an overall monthly budget goal
- [ ] Dashboard shows actual vs. target for each category
- [ ] Progress bars reflect spending percentage
- [ ] Categories exceeding budget are visually highlighted (red/warning)
- [ ] User can navigate between months
- [ ] Categories with no goal set show spending without a target

### 5.5 — Expense Analysis (AI-Powered)

**Pages:** `/analysis`

**Trigger:** User clicks "Analyze My Spending" button. This is on-demand, not automatic.

**Data Flow:**
1. Frontend calls `POST /api/analysis/expenses` with date range parameters
2. Django fetches expense data from Supabase Postgres (using service role key)
3. Django formats data into a structured prompt
4. Django calls Claude Sonnet API
5. Django parses response, stores in `analysis_history`, returns to frontend
6. Frontend displays results as insight cards

**Django API — Expense Analysis Endpoint:**

```
POST /api/analysis/expenses
Body: { "start_date": "2026-01-01", "end_date": "2026-03-14" }

Response:
{
  "analysis_id": "uuid",
  "generated_at": "2026-03-14T10:30:00Z",
  "insights": [
    {
      "type": "trend",
      "title": "Rising food expenses",
      "description": "Your food spending increased 23% from January to March...",
      "severity": "warning"
    },
    {
      "type": "anomaly",
      "title": "Unusual transportation spike",
      "description": "February transportation costs were 2.5x your average...",
      "severity": "info"
    }
  ],
  "summary": "Overall, your spending has been...",
  "tokens_used": 1250
}
```

**Insight Types:** trend, anomaly, pattern, comparison, saving_opportunity

**Severity Levels:** info, success, warning, critical

**Acceptance Criteria:**
- [ ] User can trigger expense analysis for a selected date range
- [ ] Analysis returns within 15 seconds
- [ ] Results display as styled insight cards with type-appropriate icons/colors
- [ ] Analysis history is stored and viewable
- [ ] Error state shown if LLM call fails
- [ ] Loading state shown during analysis

### 5.6 — Budget Recommendations (AI-Powered)

**Pages:** `/analysis` (same page, separate section or tab)

**Trigger:** User clicks "Get Budget Recommendations" button.

**Data Flow:**
1. Frontend calls `POST /api/analysis/recommendations` with month parameter
2. Django fetches: expense data, budget goals, journal entries (for context)
3. Django formats combined data into prompt
4. Django calls Claude Sonnet API
5. Django parses, stores, returns

**Django API — Budget Recommendations Endpoint:**

```
POST /api/analysis/recommendations
Body: { "month": "2026-03" }

Response:
{
  "recommendation_id": "uuid",
  "generated_at": "2026-03-14T10:35:00Z",
  "recommendations": [
    {
      "category": "Food & Dining",
      "current_goal": 15000.00,
      "suggested_goal": 12000.00,
      "reasoning": "Based on your journal entry about meal prepping...",
      "confidence": "high",
      "impact": "Saves ~₱3,000/month"
    }
  ],
  "overall_advice": "Based on your spending patterns and goals...",
  "tokens_used": 1800
}
```

**Acceptance Criteria:**
- [ ] User can trigger budget recommendations for a selected month
- [ ] Recommendations reference actual user data (not generic advice)
- [ ] Each recommendation includes reasoning and projected impact
- [ ] Journal context is used when relevant
- [ ] User can view past recommendations
- [ ] Clear distinction between AI suggestions and actual budget changes

---

## 6. Page Structure

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Supabase Auth sign-in form |
| `/signup` | Sign Up | Supabase Auth registration form |
| `/` | Dashboard | Overview — monthly summary, quick-add expense, recent activity |
| `/expenses` | Expenses | Full expense list, CRUD, filters |
| `/journal` | Journal | Journal entry list, CRUD, tag filters |
| `/budget` | Budget | Budget goals, progress tracking, month navigation |
| `/analysis` | Analysis | AI expense analysis + budget recommendations |
| `/settings` | Settings | Profile, currency, data export (CSV) |

---

## 7. Non-Functional Requirements

### Performance
- Page load under 2 seconds on 4G connection
- Expense list pagination: 50 items per page
- AI analysis response under 15 seconds

### Security
- All tables have RLS enabled
- Django validates Supabase JWT on every request
- API keys (Anthropic, Supabase service role) are server-side only — never exposed to frontend
- HTTPS enforced in production

### Accessibility
- All interactive elements keyboard-navigable
- Form inputs have associated labels
- Color is not the only indicator of state (icons/text accompany color coding)

### Data
- All timestamps in UTC, displayed in user's local timezone
- Monetary amounts stored as DECIMAL(12,2), never floating point
- Currency formatting follows user's `currency` preference