-- Phase 6: Chat sessions, chat messages, and weekly digest support
-- Run this in Supabase SQL Editor or via Supabase CLI

-- =========================================================
-- Table: chat_sessions
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_select_own" ON chat_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_sessions_insert_own" ON chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_sessions_delete_own" ON chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- Table: chat_messages
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatmsg_session ON chat_messages(session_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own" ON chat_messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_insert_own" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- Modify: analysis_history — add weekly_digest type
-- =========================================================

ALTER TABLE analysis_history DROP CONSTRAINT IF EXISTS analysis_history_analysis_type_check;
ALTER TABLE analysis_history ADD CONSTRAINT analysis_history_analysis_type_check
    CHECK (analysis_type IN ('expense_analysis', 'budget_recommendation', 'weekly_digest'));
