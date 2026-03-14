# Database Schema — FinPulse

> **Database:** Supabase Postgres
> **Last Updated:** March 14, 2026

---

## Initial Migration SQL

This SQL is intended to be run in the Supabase SQL Editor (or saved as a migration file in `supabase/migrations/`). It creates all MVP tables, indexes, RLS policies, and seed data.

```sql
-- ============================================================
-- FinPulse MVP Schema
-- Run in Supabase SQL Editor or save as migration
-- ============================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
    monthly_budget_goal DECIMAL(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own" ON user_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "user_profiles_insert_own" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "user_profiles_update_own" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 2. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(30),
    color VARCHAR(7),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Users can see default categories AND their own custom ones
CREATE POLICY "categories_select" ON categories
    FOR SELECT USING (is_default = true OR auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_default = false);
CREATE POLICY "categories_update_own" ON categories
    FOR UPDATE USING (auth.uid() = user_id AND is_default = false);
CREATE POLICY "categories_delete_own" ON categories
    FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- ============================================================
-- 3. EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    description VARCHAR(255) NOT NULL,
    notes TEXT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX idx_expenses_user_category ON expenses(user_id, category_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_own" ON expenses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert_own" ON expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_update_own" ON expenses
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "expenses_delete_own" ON expenses
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. JOURNAL ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    entry_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_user_date ON journal_entries(user_id, entry_date DESC);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_select_own" ON journal_entries
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "journal_entries_insert_own" ON journal_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_entries_update_own" ON journal_entries
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "journal_entries_delete_own" ON journal_entries
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. BUDGET GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    month DATE NOT NULL,  -- Always first day of month (e.g., '2026-03-01')
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, category_id, month)
);

ALTER TABLE budget_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_goals_select_own" ON budget_goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budget_goals_insert_own" ON budget_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budget_goals_update_own" ON budget_goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budget_goals_delete_own" ON budget_goals
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 6. ANALYSIS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_type VARCHAR(20) NOT NULL CHECK (analysis_type IN ('expense_analysis', 'budget_recommendation')),
    input_summary JSONB NOT NULL,
    result JSONB NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_history_select_own" ON analysis_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "analysis_history_insert_own" ON analysis_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. SEED DATA — Default Categories
-- ============================================================
INSERT INTO categories (name, icon, color, is_default, user_id) VALUES
    ('Food & Dining',   'utensils',       '#EF9F27', true, NULL),
    ('Transportation',  'car',            '#378ADD', true, NULL),
    ('Housing',         'home',           '#1D9E75', true, NULL),
    ('Utilities',       'zap',            '#D85A30', true, NULL),
    ('Entertainment',   'film',           '#7F77DD', true, NULL),
    ('Shopping',        'shopping-bag',   '#D4537E', true, NULL),
    ('Healthcare',      'heart-pulse',    '#E24B4A', true, NULL),
    ('Education',       'book-open',      '#5DCAA5', true, NULL),
    ('Personal Care',   'sparkles',       '#BA7517', true, NULL),
    ('Savings',         'piggy-bank',     '#639922', true, NULL),
    ('Other',           'more-horizontal','#888780', true, NULL);

-- ============================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_goals_updated_at
    BEFORE UPDATE ON budget_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Notes for Django Model Sync

When creating Django models that mirror these tables, always set `managed = False` in the model's Meta class. Django should never run `makemigrations` or `migrate` against these tables — Supabase owns the schema.

The Django `DATABASE_URL` should point to the Supabase Postgres connection string (found in Supabase Dashboard → Settings → Database → Connection string → URI). Use the **service role** connection for Django (bypasses RLS), not the anon key.