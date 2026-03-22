# Phase 6 Prompt — Smart AI, Not Generic AI (Week 6–7)

> **Goal:** Make AI features genuinely useful by pre-computing behavioral patterns, adding a conversational finance chat, and generating proactive weekly digests.
> **Prerequisites:** Phase 5 complete — quick capture working, auto-categorization functional, mobile UX polished.

---

## Context Files to Read First

1. `prd.md` — sections 5.5 and 5.6 (existing analysis and recommendation specs)
2. `architecture.md` — ADR-003 (Claude Sonnet for analysis tasks)
3. Phase 3 prompt — understand the current LLM integration (you're replacing the prompts, not the plumbing)

---

## Database Changes

### New table: `chat_sessions`

```sql
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
```

### New table: `chat_messages`

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chatmsg_session ON chat_messages(session_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own" ON chat_messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_insert_own" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Modify `analysis_history` — add `weekly_digest` type

```sql
ALTER TABLE analysis_history DROP CONSTRAINT IF EXISTS analysis_history_analysis_type_check;
ALTER TABLE analysis_history ADD CONSTRAINT analysis_history_analysis_type_check
    CHECK (analysis_type IN ('expense_analysis', 'budget_recommendation', 'weekly_digest'));
```

### Django model mirrors

```python
# apps/analysis/models.py — add these models
class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    title = models.CharField(max_length=200, null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'chat_sessions'


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True)
    session_id = models.UUIDField()
    user_id = models.UUIDField()
    role = models.CharField(max_length=10)
    content = models.TextField()
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'chat_messages'
```

---

## Step-by-Step Implementation

### Step 1: Build the Financial Context Engine (Django)

This is the most important change in Phase 6. Instead of sending raw expense data to the LLM, we pre-compute behavioral patterns and anomalies so the LLM can focus on interpretation, not computation.

**Create `backend/services/financial_context.py`:**

```python
"""
Summary: Builds a rich context package about a user's financial behavior.
This context is injected into every LLM prompt — analysis, recommendations, and chat.
Pre-computing patterns means the LLM reasons about meaning, not math.

Parameters:
    user_id (str): Authenticated user UUID

Output:
    dict with structured context:
        - profile: user preferences and goals
        - summary: current month totals
        - patterns: behavioral patterns (day-of-week, category distribution, velocity)
        - trends: month-over-month category trends
        - anomalies: detected spending anomalies
        - journal_context: recent journal entries (summarized)
        - budget_status: current budget goal progress

Dependencies: Django ORM / raw SQL, no external APIs
"""
from datetime import date, timedelta
from django.db import connection
import json


class FinancialContextEngine:

    def build_context(self, user_id: str) -> dict:
        """Build the full financial context for a user."""
        return {
            "profile": self._get_profile(user_id),
            "summary": self._get_current_month_summary(user_id),
            "patterns": self._get_behavioral_patterns(user_id),
            "trends": self._get_category_trends(user_id),
            "anomalies": self._detect_anomalies(user_id),
            "journal_context": self._get_journal_context(user_id),
            "budget_status": self._get_budget_status(user_id),
        }

    def format_for_prompt(self, context: dict) -> str:
        """Convert the context dict into a formatted string for LLM prompts."""
        profile = context["profile"]
        summary = context["summary"]
        patterns = context["patterns"]
        trends = context["trends"]
        anomalies = context["anomalies"]
        journal = context["journal_context"]
        budget = context["budget_status"]

        sections = []

        # Section 1: User profile
        sections.append(f"""USER PROFILE:
- Currency: {profile.get('currency', 'PHP')}
- Monthly budget goal: {profile.get('monthly_budget_goal', 'Not set')}
- Account age: {profile.get('account_age_days', 0)} days
- Total expenses tracked: {profile.get('total_expenses', 0)}""")

        # Section 2: Current month summary
        sections.append(f"""CURRENT MONTH ({summary.get('month', 'N/A')}):
- Total spent: {summary.get('total_spent', 0):,.2f}
- Transaction count: {summary.get('transaction_count', 0)}
- Daily average: {summary.get('daily_average', 0):,.2f}
- Days remaining: {summary.get('days_remaining', 0)}
- Projected month total: {summary.get('projected_total', 0):,.2f}""")

        # Section 3: Behavioral patterns
        if patterns:
            dow_spending = patterns.get("day_of_week", [])
            dow_str = ", ".join([f"{d['day']}: {d['avg']:,.0f}" for d in dow_spending]) if dow_spending else "Insufficient data"
            sections.append(f"""BEHAVIORAL PATTERNS:
- Average spending by day of week: {dow_str}
- Highest spending day: {patterns.get('peak_day', 'N/A')} (avg {patterns.get('peak_day_avg', 0):,.0f})
- Most frequent category: {patterns.get('top_category', 'N/A')} ({patterns.get('top_category_pct', 0):.0f}% of transactions)
- Spending velocity: {patterns.get('current_velocity', 0):,.0f}/day (vs {patterns.get('prev_velocity', 0):,.0f}/day last month)""")

        # Section 4: Category trends
        if trends:
            trend_lines = []
            for t in trends:
                direction = "up" if t["change_pct"] > 0 else "down"
                trend_lines.append(
                    f"- {t['category']}: {t['change_pct']:+.0f}% MoM ({t['prev_amount']:,.0f} → {t['curr_amount']:,.0f})"
                )
            sections.append("CATEGORY TRENDS (month-over-month):\n" + "\n".join(trend_lines))

        # Section 5: Anomalies
        if anomalies:
            anomaly_lines = []
            for a in anomalies:
                anomaly_lines.append(
                    f"- [{a['date']}] {a['description']}: {a['amount']:,.0f} "
                    f"({a['multiplier']:.1f}x your average for {a['category']})"
                )
            sections.append("ANOMALIES DETECTED:\n" + "\n".join(anomaly_lines))
        else:
            sections.append("ANOMALIES DETECTED:\nNone — spending patterns are consistent.")

        # Section 6: Journal context
        if journal:
            journal_lines = []
            for j in journal:
                tags_str = f" — Tags: {', '.join(j['tags'])}" if j.get("tags") else ""
                preview = j["content"][:150] + "..." if len(j.get("content", "")) > 150 else j.get("content", "")
                journal_lines.append(f"- [{j['date']}] \"{j['title']}\"{tags_str}\n  {preview}")
            sections.append("RECENT JOURNAL ENTRIES:\n" + "\n".join(journal_lines))
        else:
            sections.append("RECENT JOURNAL ENTRIES:\nNo recent journal entries.")

        # Section 7: Budget status
        if budget:
            budget_lines = []
            for b in budget:
                pct = (b["spent"] / b["goal"] * 100) if b["goal"] > 0 else 0
                status = "ON TRACK" if pct < 80 else ("WARNING" if pct < 100 else "OVER BUDGET")
                budget_lines.append(
                    f"- {b['category']}: {b['spent']:,.0f} / {b['goal']:,.0f} ({pct:.0f}%) [{status}]"
                )
            sections.append("BUDGET STATUS:\n" + "\n".join(budget_lines))

        return "\n\n".join(sections)

    def _get_profile(self, user_id: str) -> dict:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    up.currency,
                    up.monthly_budget_goal,
                    up.created_at,
                    (SELECT COUNT(*) FROM expenses WHERE user_id = %s) AS total_expenses
                FROM user_profiles up
                WHERE up.id = %s
            """, [user_id, user_id])
            row = cursor.fetchone()
            if not row:
                return {}
            return {
                "currency": row[0],
                "monthly_budget_goal": float(row[1]) if row[1] else None,
                "account_age_days": (date.today() - row[2].date()).days if row[2] else 0,
                "total_expenses": row[3],
            }

    def _get_current_month_summary(self, user_id: str) -> dict:
        today = date.today()
        month_start = today.replace(day=1)
        import calendar
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        days_elapsed = today.day

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0), COUNT(*)
                FROM expenses
                WHERE user_id = %s AND expense_date >= %s AND expense_date <= %s
            """, [user_id, month_start, today])
            row = cursor.fetchone()
            total_spent = float(row[0])
            count = row[1]
            daily_avg = total_spent / max(days_elapsed, 1)

            return {
                "month": today.strftime("%Y-%m"),
                "total_spent": total_spent,
                "transaction_count": count,
                "daily_average": daily_avg,
                "days_remaining": days_in_month - days_elapsed,
                "projected_total": daily_avg * days_in_month,
            }

    def _get_behavioral_patterns(self, user_id: str) -> dict:
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)
        sixty_days_ago = today - timedelta(days=60)

        with connection.cursor() as cursor:
            # Day of week spending
            cursor.execute("""
                SELECT TO_CHAR(expense_date, 'Dy') AS dow,
                       AVG(daily_total) AS avg_daily
                FROM (
                    SELECT expense_date, SUM(amount) AS daily_total
                    FROM expenses
                    WHERE user_id = %s AND expense_date >= %s
                    GROUP BY expense_date
                ) sub
                GROUP BY TO_CHAR(expense_date, 'Dy'), EXTRACT(DOW FROM expense_date)
                ORDER BY EXTRACT(DOW FROM expense_date)
            """, [user_id, thirty_days_ago])
            dow = [{"day": row[0], "avg": float(row[1])} for row in cursor.fetchall()]

            peak = max(dow, key=lambda d: d["avg"]) if dow else {"day": "N/A", "avg": 0}

            # Most frequent category
            cursor.execute("""
                SELECT c.name, COUNT(*) AS cnt,
                       COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM expenses WHERE user_id = %s AND expense_date >= %s), 0) AS pct
                FROM expenses e JOIN categories c ON c.id = e.category_id
                WHERE e.user_id = %s AND e.expense_date >= %s
                GROUP BY c.name ORDER BY cnt DESC LIMIT 1
            """, [user_id, thirty_days_ago, user_id, thirty_days_ago])
            top_cat = cursor.fetchone()

            # Spending velocity (current vs previous 30 days)
            cursor.execute("""
                SELECT
                    COALESCE(SUM(CASE WHEN expense_date >= %s THEN amount END), 0) / GREATEST((%s - %s + 1), 1) AS curr_velocity,
                    COALESCE(SUM(CASE WHEN expense_date >= %s AND expense_date < %s THEN amount END), 0) / 30.0 AS prev_velocity
                FROM expenses
                WHERE user_id = %s AND expense_date >= %s
            """, [thirty_days_ago, today, thirty_days_ago, sixty_days_ago, thirty_days_ago,
                  user_id, sixty_days_ago])
            vel = cursor.fetchone()

            return {
                "day_of_week": dow,
                "peak_day": peak["day"],
                "peak_day_avg": peak["avg"],
                "top_category": top_cat[0] if top_cat else "N/A",
                "top_category_pct": float(top_cat[2]) if top_cat else 0,
                "current_velocity": float(vel[0]) if vel else 0,
                "prev_velocity": float(vel[1]) if vel else 0,
            }

    def _get_category_trends(self, user_id: str) -> list:
        today = date.today()
        curr_start = today.replace(day=1)
        prev_start = (curr_start - timedelta(days=1)).replace(day=1)

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    c.name,
                    COALESCE(SUM(CASE WHEN e.expense_date >= %s THEN e.amount END), 0) AS curr,
                    COALESCE(SUM(CASE WHEN e.expense_date >= %s AND e.expense_date < %s THEN e.amount END), 0) AS prev
                FROM categories c
                LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = %s AND e.expense_date >= %s
                WHERE c.is_default = true OR c.user_id = %s
                GROUP BY c.name
                HAVING COALESCE(SUM(CASE WHEN e.expense_date >= %s THEN e.amount END), 0) > 0
                    OR COALESCE(SUM(CASE WHEN e.expense_date >= %s AND e.expense_date < %s THEN e.amount END), 0) > 0
                ORDER BY curr DESC
            """, [curr_start, prev_start, curr_start, user_id, prev_start, user_id,
                  curr_start, prev_start, curr_start])

            trends = []
            for row in cursor.fetchall():
                curr, prev = float(row[1]), float(row[2])
                change = ((curr - prev) / prev * 100) if prev > 0 else (100 if curr > 0 else 0)
                trends.append({
                    "category": row[0],
                    "curr_amount": curr,
                    "prev_amount": prev,
                    "change_pct": change,
                })
            return trends

    def _detect_anomalies(self, user_id: str) -> list:
        """Find expenses that are 2x+ the user's average for that category."""
        with connection.cursor() as cursor:
            cursor.execute("""
                WITH category_avgs AS (
                    SELECT category_id, AVG(amount) AS avg_amount, STDDEV(amount) AS stddev_amount
                    FROM expenses WHERE user_id = %s
                    GROUP BY category_id HAVING COUNT(*) >= 3
                )
                SELECT e.expense_date, e.description, e.amount, c.name,
                       e.amount / ca.avg_amount AS multiplier
                FROM expenses e
                JOIN categories c ON c.id = e.category_id
                JOIN category_avgs ca ON ca.category_id = e.category_id
                WHERE e.user_id = %s
                AND e.expense_date >= (CURRENT_DATE - INTERVAL '30 days')
                AND e.amount > ca.avg_amount * 2
                ORDER BY multiplier DESC
                LIMIT 5
            """, [user_id, user_id])

            return [
                {
                    "date": row[0].isoformat(),
                    "description": row[1],
                    "amount": float(row[2]),
                    "category": row[3],
                    "multiplier": float(row[4]),
                }
                for row in cursor.fetchall()
            ]

    def _get_journal_context(self, user_id: str) -> list:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT title, content, tags, entry_date
                FROM journal_entries
                WHERE user_id = %s
                ORDER BY entry_date DESC
                LIMIT 10
            """, [user_id])
            return [
                {"title": row[0], "content": row[1], "tags": row[2] or [], "date": row[3].isoformat()}
                for row in cursor.fetchall()
            ]

    def _get_budget_status(self, user_id: str) -> list:
        today = date.today()
        month_start = today.replace(day=1)

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT c.name, bg.amount AS goal,
                       COALESCE(SUM(e.amount), 0) AS spent
                FROM budget_goals bg
                JOIN categories c ON c.id = bg.category_id
                LEFT JOIN expenses e ON e.category_id = bg.category_id
                    AND e.user_id = %s
                    AND e.expense_date >= %s
                    AND e.expense_date <= %s
                WHERE bg.user_id = %s AND bg.month = %s
                GROUP BY c.name, bg.amount
                ORDER BY c.name
            """, [user_id, month_start, today, user_id, month_start])

            return [
                {"category": row[0], "goal": float(row[1]), "spent": float(row[2])}
                for row in cursor.fetchall()
            ]


# Singleton
financial_context_engine = FinancialContextEngine()
```

### Step 2: Rewrite the Analysis Prompts

Replace the existing prompts in `services/expense_analyzer.py` and `services/budget_advisor.py` to use the financial context engine.

**Updated `services/expense_analyzer.py`:**

Replace the system and user prompts. The new system prompt should be:

```python
EXPENSE_ANALYSIS_SYSTEM_PROMPT = """You are a personal finance analyst. You interpret pre-computed spending patterns and anomalies to provide actionable insights.

CRITICAL: The behavioral patterns, trends, and anomalies below have already been computed from the user's actual data. Your job is to INTERPRET them — explain what they mean, why they matter, and what the user should do about them. Do NOT re-derive the numbers; they are already correct.

RULES:
- Every insight must reference specific data from the context (a category, an amount, a trend).
- Do NOT give generic finance advice ("save more", "track spending"). The user already tracks spending — that's why you have this data.
- Be specific and actionable: "Your food spending jumped 34% this month to ₱18,200, mostly driven by dining out on weekends" is good. "Consider reducing food expenses" is bad.
- If journal entries explain a spending change, reference them: "Your transportation dropped because you mentioned starting to bike to work on March 5."
- Use the user's currency ({currency}) in all amounts.
- If data is insufficient (<2 weeks or <10 expenses), say so honestly and provide what limited insights you can.

RESPONSE FORMAT:
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.
{{
    "insights": [
        {{
            "type": "trend|anomaly|pattern|comparison|saving_opportunity",
            "title": "Short title (max 10 words)",
            "description": "2-3 sentence insight with specific numbers from the context",
            "severity": "info|success|warning|critical"
        }}
    ],
    "summary": "1-2 paragraph overall assessment connecting the key patterns together"
}}

Provide 3-7 insights. Prioritize: anomalies first, then trends, then saving opportunities.
"""
```

The user prompt now simply injects the pre-formatted context:

```python
EXPENSE_ANALYSIS_USER_PROMPT = """Analyze my financial situation based on this data:

{formatted_context}

Provide your analysis as JSON."""
```

**In the `analyze_expenses` view**, replace the data-fetching logic with:

```python
from services.financial_context import financial_context_engine

context = financial_context_engine.build_context(user_id)
formatted = financial_context_engine.format_for_prompt(context)
# Then pass formatted into the prompt
```

Apply the same pattern to `services/budget_advisor.py`.

### Step 3: Build the Conversational Finance Chat (Django)

**Create `backend/services/finance_chat.py`:**

```python
"""
Summary: Handles conversational finance queries. Users can ask questions
about their spending data and get contextual, data-grounded answers.

Parameters:
    user_id (str): Authenticated user UUID
    session_id (str | None): Existing chat session to continue, or None for new
    message (str): User's message

Output:
    dict with keys:
        - session_id (str): Chat session UUID
        - response (str): Assistant's reply
        - tokens_used (int): Tokens consumed

Dependencies: anthropic SDK, financial_context engine
"""
import anthropic
from django.conf import settings
from django.db import connection
import uuid

from services.financial_context import financial_context_engine

CHAT_SYSTEM_PROMPT = """You are FinPulse AI, a personal finance assistant. You answer questions about the user's spending, budget, and financial behavior based on their actual data.

RULES:
- Answer questions using ONLY the financial context provided below. Never make up numbers.
- Be conversational but concise. 2-4 sentences for simple questions, longer for complex analysis.
- If asked about data you don't have (e.g., "how much did I spend on gas?" but no gas category exists), say so clearly.
- Reference specific amounts, dates, and categories from the context.
- Use the user's currency ({currency}) for all amounts.
- You can do simple math on the provided numbers (e.g., calculate remaining budget, project end-of-month totals).
- If the user asks for advice, ground it in their actual patterns — don't give generic tips.
- Keep a warm, helpful tone. You're a knowledgeable friend, not a lecturing financial advisor.
- Do NOT use markdown formatting (no bold, no headers, no bullet points). Respond in plain text paragraphs.

FINANCIAL CONTEXT:
{formatted_context}
"""


class FinanceChat:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = getattr(settings, 'ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')

    def send_message(self, user_id: str, session_id: str | None, message: str) -> dict:
        # Build financial context
        context = financial_context_engine.build_context(user_id)
        formatted_context = financial_context_engine.format_for_prompt(context)
        currency = context["profile"].get("currency", "PHP")

        # Get or create session
        if not session_id:
            session_id = self._create_session(user_id, message[:100])
        history = self._get_history(session_id, limit=20)

        # Build messages array
        messages = []
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": message})

        # Call Claude
        system = CHAT_SYSTEM_PROMPT.format(
            currency=currency,
            formatted_context=formatted_context
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            temperature=0.4,
            system=system,
            messages=messages,
        )

        assistant_reply = response.content[0].text
        tokens = response.usage.input_tokens + response.usage.output_tokens

        # Store messages
        self._store_message(session_id, user_id, "user", message)
        self._store_message(session_id, user_id, "assistant", assistant_reply, {"tokens_used": tokens})

        return {
            "session_id": session_id,
            "response": assistant_reply,
            "tokens_used": tokens,
        }

    def _create_session(self, user_id: str, title: str) -> str:
        sid = str(uuid.uuid4())
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
                VALUES (%s, %s, %s, now(), now())
            """, [sid, user_id, title])
        return sid

    def _get_history(self, session_id: str, limit: int = 20) -> list:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT role, content FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
                LIMIT %s
            """, [session_id, limit])
            return [{"role": row[0], "content": row[1]} for row in cursor.fetchall()]

    def _store_message(self, session_id: str, user_id: str, role: str, content: str, metadata: dict = None):
        import json
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO chat_messages (id, session_id, user_id, role, content, metadata, created_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, now())
            """, [session_id, user_id, role, content, json.dumps(metadata or {})])


# Singleton
finance_chat = FinanceChat()
```

**Create the Django endpoints:**

```python
# apps/analysis/views.py — add these views

from services.finance_chat import finance_chat

@api_view(['POST'])
def chat_message(request):
    """
    POST /api/analysis/chat
    Body: { "message": "How much did I spend on food this month?", "session_id": "uuid" | null }

    Output:
        200: { session_id, response, tokens_used }
    """
    user_id = request.user_id
    message = request.data.get('message', '').strip()
    session_id = request.data.get('session_id')

    if not message:
        return Response({'error': 'message is required'}, status=400)
    if len(message) > 2000:
        return Response({'error': 'message must be under 2000 characters'}, status=400)

    try:
        result = finance_chat.send_message(user_id, session_id, message)
        return Response(result, status=200)
    except Exception as e:
        logger.exception(f"Chat error for user {user_id}: {e}")
        return Response({'error': 'Chat service temporarily unavailable.'}, status=503)


@api_view(['GET'])
def chat_sessions_list(request):
    """
    GET /api/analysis/chat/sessions?limit=20

    Returns the user's chat sessions (most recent first).
    """
    user_id = request.user_id
    limit = min(int(request.query_params.get('limit', 20)), 50)

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT id::text, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = %s
            ORDER BY updated_at DESC
            LIMIT %s
        """, [user_id, limit])
        sessions = [
            {"id": row[0], "title": row[1], "created_at": row[2].isoformat(), "updated_at": row[3].isoformat()}
            for row in cursor.fetchall()
        ]
    return Response(sessions, status=200)


@api_view(['GET'])
def chat_session_messages(request, session_id):
    """
    GET /api/analysis/chat/sessions/<session_id>/messages

    Returns all messages in a chat session.
    """
    user_id = request.user_id

    with connection.cursor() as cursor:
        # Verify session belongs to user
        cursor.execute("SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s", [session_id, user_id])
        if not cursor.fetchone():
            return Response({'error': 'Session not found'}, status=404)

        cursor.execute("""
            SELECT role, content, created_at FROM chat_messages
            WHERE session_id = %s AND user_id = %s
            ORDER BY created_at ASC
        """, [session_id, user_id])
        messages = [
            {"role": row[0], "content": row[1], "created_at": row[2].isoformat()}
            for row in cursor.fetchall()
        ]
    return Response(messages, status=200)
```

**Register URLs:**
```python
# apps/analysis/urls.py — add:
path('chat', views.chat_message),
path('chat/sessions', views.chat_sessions_list),
path('chat/sessions/<uuid:session_id>/messages', views.chat_session_messages),
```

### Step 4: Build the Chat UI (Frontend)

Restructure the `/analysis` page to have three tabs:

**Tab 1: Chat (new, default tab)**
**Tab 2: Insights (existing expense analysis, now using improved prompts)**
**Tab 3: History (existing, now includes chat sessions)**

**Chat tab components:**

1. **ChatInterface.tsx** — full chat view:
   - Message list (scrollable, auto-scroll to bottom on new messages)
   - User messages: right-aligned, colored background
   - Assistant messages: left-aligned, neutral background
   - Typing indicator: three pulsing dots while waiting for response
   - Input bar at the bottom: text input + send button

2. **ChatSuggestions.tsx** — shown when chat is empty (no messages yet):
   - 4-6 suggestion chips the user can tap:
     - "How much did I spend this month?"
     - "Am I on track for my budget?"
     - "What's my biggest expense category?"
     - "Where can I cut spending?"
     - "Compare this month to last month"
     - "What should I budget for next month?"
   - Tapping a chip sends it as the first message

3. **ChatSessionSidebar.tsx** — on desktop, shows past sessions in a sidebar. On mobile, accessible via a "History" icon button in the chat header.

**Data flow:**
```typescript
// src/hooks/useFinanceChat.ts
export function useFinanceChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function sendMessage(text: string) {
        // Optimistically add user message to UI
        setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }]);
        setLoading(true);

        try {
            const result = await api.post<ChatResponse>('/analysis/chat', {
                message: text,
                session_id: sessionId,
            });

            setSessionId(result.session_id);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: result.response,
                created_at: new Date().toISOString()
            }]);
        } catch (err) {
            // Show error message in chat
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I couldn\'t process that. Please try again.',
                created_at: new Date().toISOString(),
                isError: true
            }]);
        } finally {
            setLoading(false);
        }
    }

    return { messages, loading, sendMessage, sessionId, setSessionId };
}
```

### Step 5: Build the Weekly Digest (Django)

**Create `backend/services/weekly_digest.py`:**

```python
"""
Summary: Generates a weekly spending digest using the financial context engine.
Intended to run as a scheduled job every Sunday evening.

Parameters:
    user_id (str): User to generate digest for (or "all" for batch)

Output:
    Stores digest in analysis_history with analysis_type='weekly_digest'

Dependencies: financial_context engine, LLM client
"""
from services.financial_context import financial_context_engine
from services.llm_client import llm_client
from django.db import connection
import json
import uuid
import logging

logger = logging.getLogger(__name__)

DIGEST_SYSTEM_PROMPT = """You write concise weekly spending digests. The user opens their finance app and sees this as a summary card — keep it short, scannable, and useful.

FORMAT (respond with valid JSON only):
{{
    "headline": "One-line summary (max 15 words)",
    "body": "2-3 short paragraphs. Highlight: total spent, biggest change from last week, one actionable tip.",
    "key_stat": {{ "label": "Top category", "value": "Food & Dining", "detail": "₱8,200 (42%)" }},
    "mood": "on_track|needs_attention|over_budget|great_week"
}}

RULES:
- Be specific with numbers. Reference actual categories and amounts.
- Keep total length under 150 words.
- Use currency {currency}.
- Mood should reflect actual budget status, not be artificially positive.
"""

DIGEST_USER_PROMPT = """Generate my weekly spending digest.

{formatted_context}"""


def generate_digest_for_user(user_id: str) -> dict | None:
    """Generate and store a weekly digest for a single user."""
    try:
        context = financial_context_engine.build_context(user_id)
        currency = context["profile"].get("currency", "PHP")

        # Skip if user has fewer than 3 expenses this week
        if context["summary"]["transaction_count"] < 3:
            return None

        formatted = financial_context_engine.format_for_prompt(context)
        system = DIGEST_SYSTEM_PROMPT.format(currency=currency)
        user = DIGEST_USER_PROMPT.format(formatted_context=formatted)

        result = llm_client.complete(system, user, max_tokens=500, temperature=0.3)

        # Parse response
        content = result["content"].strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        digest = json.loads(content)

        # Store in analysis_history
        digest_id = str(uuid.uuid4())
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO analysis_history (id, user_id, analysis_type, input_summary, result, model_used, tokens_used, created_at)
                VALUES (%s, %s, 'weekly_digest', %s, %s, %s, %s, now())
            """, [
                digest_id, user_id,
                json.dumps({"week_of": context["summary"]["month"]}),
                json.dumps(digest),
                result["model"],
                result["tokens_used"],
            ])

        return digest

    except Exception as e:
        logger.exception(f"Failed to generate digest for user {user_id}: {e}")
        return None


def generate_all_digests():
    """Generate digests for all active users. Call from management command or scheduler."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT DISTINCT user_id::text FROM expenses
            WHERE expense_date >= CURRENT_DATE - INTERVAL '7 days'
        """)
        user_ids = [row[0] for row in cursor.fetchall()]

    generated = 0
    for uid in user_ids:
        result = generate_digest_for_user(uid)
        if result:
            generated += 1

    logger.info(f"Generated {generated} weekly digests out of {len(user_ids)} active users")
    return generated
```

**Create a Django management command:**
```python
# apps/analysis/management/commands/generate_digests.py
from django.core.management.base import BaseCommand
from services.weekly_digest import generate_all_digests

class Command(BaseCommand):
    help = 'Generate weekly spending digests for all active users'

    def handle(self, *args, **options):
        count = generate_all_digests()
        self.stdout.write(self.style.SUCCESS(f'Generated {count} digests'))
```

Run manually: `python manage.py generate_digests`
Schedule on Railway: add a cron job running `python manage.py generate_digests` every Sunday at 8 PM user's timezone (or UTC equivalent).

**Create the endpoint to fetch the latest digest:**
```python
# apps/analysis/views.py — add:
@api_view(['GET'])
def latest_digest(request):
    """
    GET /api/analysis/digest/latest

    Returns the most recent weekly digest, if one exists from the past 7 days.
    """
    user_id = request.user_id
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT result, created_at FROM analysis_history
            WHERE user_id = %s AND analysis_type = 'weekly_digest'
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY created_at DESC LIMIT 1
        """, [user_id])
        row = cursor.fetchone()
        if not row:
            return Response({'digest': None}, status=200)
        return Response({'digest': row[0], 'generated_at': row[1].isoformat()}, status=200)
```

**Register URL:**
```python
path('digest/latest', views.latest_digest),
```

### Step 6: Add Digest Card to Dashboard (Frontend)

**Create `src/components/features/WeeklyDigestCard.tsx`:**

- Fetch from `GET /api/analysis/digest/latest` on dashboard load
- If no digest exists, don't show anything (not an empty state — just absent)
- Card design:
  - Colored top border based on `mood` (green=on_track, amber=needs_attention, red=over_budget, teal=great_week)
  - Headline in bold
  - Body text (2-3 short paragraphs)
  - Key stat displayed as a highlighted badge
  - Dismissible (tap X to hide until next digest)
- Place at the top of the dashboard, above the monthly summary strip

---

## Validation Tests

### Test 1: Context Engine — Data Richness
```
Action: With 30+ expenses across 5+ categories and 3+ journal entries,
        call financial_context_engine.build_context(user_id) and inspect output
Expected:
  - profile section has correct currency and budget goal
  - summary shows accurate current month totals
  - patterns.day_of_week has entries for days with spending data
  - trends has MoM comparison for active categories
  - anomalies lists expenses >2x category average (if any)
  - journal_context includes recent entries with tags
  - budget_status shows correct goal vs spent for each budgeted category
```

### Test 2: Improved Analysis — Specificity
```
Action: Trigger expense analysis via POST /api/analysis/expenses
Expected:
  - Every insight references specific amounts, categories, or dates from the data
  - No insight is generic (e.g., "Try to save more" should NOT appear)
  - If journal entries explain a trend, the insight references them
  - Anomalies are highlighted with multiplier context
```

### Test 3: Chat — Basic Query
```
Action: POST /api/analysis/chat with message "How much did I spend on food this month?"
Expected:
  - Response references the actual food spending amount from the current month
  - Response mentions specific restaurants or patterns if data exists
  - session_id is returned (new session created)
  - Both user and assistant messages stored in chat_messages
```

### Test 4: Chat — Multi-Turn Conversation
```
Action:
  1. Send "How much did I spend this month?"
  2. Send "How does that compare to last month?" (same session_id)
Expected:
  - Second response correctly references the first question's context
  - Provides actual MoM comparison with numbers
  - Conversation history is maintained
```

### Test 5: Chat — Grounded Response (No Hallucination)
```
Action: Send "How much did I spend on cryptocurrency?" (assuming no crypto category exists)
Expected:
  - Response says something like "I don't see a cryptocurrency category in your expenses"
  - Does NOT make up a number
```

### Test 6: Chat Suggestion Chips
```
Action: Open the Chat tab with no existing sessions
Expected:
  - Suggestion chips are displayed
  - Tapping a chip sends it as a message
  - Chat loads and first response appears
```

### Test 7: Weekly Digest — Generation
```
Action: Run `python manage.py generate_digests` with 10+ expenses in the past week
Expected:
  - Digest stored in analysis_history with type='weekly_digest'
  - Digest JSON has headline, body, key_stat, mood
  - Headline is specific (references actual amounts)
  - Body is under 150 words
```

### Test 8: Weekly Digest — Dashboard Display
```
Action: After generating a digest, load the dashboard
Expected:
  - Digest card appears at the top of the dashboard
  - Mood color matches the card's top border
  - Headline and body text render correctly
  - Dismiss button hides the card
  - Card stays hidden on subsequent visits until a new digest is generated
```

### Test 9: Chat — Rate Limiting
```
Action: Send 20 chat messages in rapid succession
Expected:
  - First 15 succeed
  - Messages 16+ return 429 with "Rate limit exceeded. Please wait a moment."
  - Rate limit is per-user, not global
```

### Test 10: Context Engine — Empty Data Handling
```
Action: Create a new user with 0 expenses and call build_context
Expected:
  - Returns valid context with zero/empty values (no crashes)
  - Analysis prompt generates an honest "insufficient data" response
  - Chat responds helpfully: "You don't have any expenses tracked yet..."
```

---

## Code Quality Reminders

- The financial context engine is called on EVERY chat message and analysis request. Cache it per-user with a 5-minute TTL to avoid hammering the database on rapid chat messages. Use Django's cache framework.
- Chat sessions can grow long. The 20-message history limit in `_get_history` keeps context window manageable. The LLM sees the last 20 messages + the full financial context — that's roughly 3-5k tokens total.
- Weekly digest generation should be idempotent — running it twice in the same week should not create duplicate digests. Add a check: skip if a digest already exists for this user within the past 6 days.
- The chat system prompt includes the FULL financial context on every message. This is intentional — the LLM needs the numbers to answer questions. But watch token costs: with 20 messages of history + full context, each chat turn is ~2-4k input tokens on Sonnet.