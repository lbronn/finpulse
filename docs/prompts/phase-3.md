# Phase 3 Prompt — LLM Integration (Week 3)

> **Goal:** AI-powered expense analysis and budget recommendations fully functional.
> **Prerequisites:** Phase 2 complete — budget tracking works, Django aggregation endpoints operational, dashboard charts rendering.

---

## Context Files to Read First

1. `prd.md` — sections 5.5 (Expense Analysis) and 5.6 (Budget Recommendations)
2. `architecture.md` — ADR-003 (Claude Sonnet decision and fallback strategy)
3. Previous phase prompts — understand what data is available

---

## Environment Variables (Add to .env)

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

---

## Step-by-Step Implementation

### Step 1: Create the LLM Service Layer

This is the abstraction layer that isolates all LLM interaction logic. If we ever swap providers, only this layer changes.

**Install the Anthropic SDK:**
```bash
cd backend
pip install anthropic
pip freeze > requirements.txt
```

**Create `backend/services/llm_client.py`:**

```python
"""
LLM client abstraction layer.

Summary: Wraps the Anthropic SDK to provide a clean interface for sending
prompts and receiving structured responses. Handles retries, error logging,
and token usage tracking.

Dependencies: anthropic (pip install anthropic)
"""
import anthropic
from django.conf import settings
import json
import logging

logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.3
    ) -> dict:
        """
        Send a prompt to Claude and return the response.

        Parameters:
            system_prompt (str): System-level instructions for the model.
            user_prompt (str): The user-facing prompt with data.
            max_tokens (int): Max response tokens. Default 2000.
            temperature (float): Sampling temperature. Default 0.3 (low for analytical tasks).

        Output:
            dict with keys:
                - content (str): The model's text response
                - tokens_used (int): Total tokens (input + output)
                - model (str): Model identifier used
        """
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            return {
                "content": response.content[0].text,
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
                "model": self.model,
            }
        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            raise
        except Exception as e:
            logger.error(f"LLM client error: {e}")
            raise


# Singleton instance
llm_client = LLMClient()
```

### Step 2: Build the Expense Analyzer Service

**Create `backend/services/expense_analyzer.py`:**

This service is responsible for:
1. Fetching and formatting expense data into a structured prompt
2. Sending the prompt to the LLM
3. Parsing the LLM response into structured insight objects
4. Storing the result in `analysis_history`

**System Prompt for Expense Analysis:**

```python
EXPENSE_ANALYSIS_SYSTEM_PROMPT = """You are a personal finance analyst. You analyze expense data and provide actionable insights.

RULES:
- Base ALL insights on the actual data provided. Never fabricate numbers or trends.
- Be specific — reference actual categories, amounts, and dates from the data.
- Use the user's currency ({currency}) in all monetary references.
- Keep insights concise — 2-3 sentences each.
- Focus on what's actionable, not just observational.
- If the data is insufficient for meaningful analysis (e.g., less than 2 weeks of data), say so.

RESPONSE FORMAT:
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
{{
    "insights": [
        {{
            "type": "trend|anomaly|pattern|comparison|saving_opportunity",
            "title": "Short title (max 10 words)",
            "description": "2-3 sentence insight with specific numbers",
            "severity": "info|success|warning|critical"
        }}
    ],
    "summary": "1-2 paragraph overall assessment"
}}

Provide 3-7 insights depending on data richness. Prioritize:
1. Anomalies (unusual spikes or drops)
2. Trends (consistent increases/decreases over time)
3. Saving opportunities (categories with potential to cut)
4. Patterns (recurring behaviors)
5. Comparisons (month-over-month changes)
"""
```

**User Prompt Template:**

```python
EXPENSE_ANALYSIS_USER_PROMPT = """Analyze my spending data from {start_date} to {end_date}.

EXPENSE DATA:
{expense_data}

MONTHLY TOTALS:
{monthly_totals}

CATEGORY BREAKDOWN:
{category_breakdown}

Provide your analysis as JSON.
"""
```

**Data formatting:** Before sending to the LLM, format the expense data as a readable table:

```
Date       | Category        | Amount    | Description
2026-03-14 | Food & Dining   | ₱450.00   | Lunch at Jollibee
2026-03-13 | Transportation  | ₱200.00   | Grab ride to office
...
```

Include monthly totals and category breakdowns as supplementary context so the LLM doesn't have to compute them.

**Parse the LLM response:**
- Attempt `json.loads()` on the response content
- If parsing fails (LLM returned markdown-wrapped JSON), strip markdown code fences and retry
- If still failing, return a fallback error insight
- Validate that each insight has the required fields

### Step 3: Build the Budget Advisor Service

**Create `backend/services/budget_advisor.py`:**

This service is similar to the expense analyzer but additionally uses budget goals and journal entries as context.

**System Prompt for Budget Recommendations:**

```python
BUDGET_RECOMMENDATION_SYSTEM_PROMPT = """You are a personal budget advisor. You analyze spending patterns, current budget goals, and personal journal context to provide realistic budget adjustment recommendations.

RULES:
- Recommendations must be grounded in the actual data provided.
- Reference specific categories and amounts.
- Consider the user's journal entries for context about WHY they spend in certain ways.
- Be realistic — don't suggest cutting categories to zero unless the user has indicated they want to.
- Explain the reasoning behind each recommendation.
- Use the user's currency ({currency}) in all monetary references.
- If the user is generally on track, say so — don't force recommendations.

RESPONSE FORMAT:
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
{{
    "recommendations": [
        {{
            "category": "Category name",
            "current_goal": 15000.00,
            "suggested_goal": 12000.00,
            "reasoning": "Specific reasoning referencing data and journal context",
            "confidence": "high|medium|low",
            "impact": "Human-readable impact statement"
        }}
    ],
    "overall_advice": "1-2 paragraph overall budget advice"
}}

Provide 2-5 recommendations. Only include categories where you have a meaningful suggestion.
"""
```

**User Prompt Template:**

```python
BUDGET_RECOMMENDATION_USER_PROMPT = """Review my budget and spending for {month}.

CURRENT BUDGET GOALS:
{budget_goals}

ACTUAL SPENDING THIS MONTH:
{spending_summary}

SPENDING TRENDS (last 3 months):
{spending_trends}

RECENT JOURNAL ENTRIES (for context):
{journal_entries}

Provide your budget recommendations as JSON.
"""
```

**Journal entry formatting:** Include the last 10 journal entries (or entries from the last 3 months, whichever is fewer). Format as:

```
[2026-03-10] "Decided to meal prep" — Tags: food, savings
Started meal prepping on Sundays to reduce weekday food spending...

[2026-03-05] "New commute situation" — Tags: transportation
Started biking to work 3x per week...
```

### Step 4: Build Django API Endpoints

#### Expense Analysis Endpoint

```python
# apps/analysis/views.py

@api_view(['POST'])
def analyze_expenses(request):
    """
    POST /api/analysis/expenses
    Body: { "start_date": "2026-01-01", "end_date": "2026-03-14" }

    Triggers AI analysis of expenses in the given date range.
    Returns structured insights.
    """
    user_id = request.user_id
    start_date = request.data.get('start_date')
    end_date = request.data.get('end_date')

    # Validate inputs
    # Fetch expense data from DB
    # Format into prompt
    # Call LLM via expense_analyzer service
    # Parse response
    # Store in analysis_history
    # Return response

    # See prd.md section 5.5 for exact response shape
```

#### Budget Recommendations Endpoint

```python
@api_view(['POST'])
def budget_recommendations(request):
    """
    POST /api/analysis/recommendations
    Body: { "month": "2026-03" }

    Triggers AI-powered budget recommendations for the given month.
    Returns structured recommendations.
    """
    # Same pattern as analyze_expenses
    # Additionally fetch budget_goals and journal_entries
    # See prd.md section 5.6 for exact response shape
```

#### Analysis History Endpoint

```python
@api_view(['GET'])
def analysis_history_list(request):
    """
    GET /api/analysis/history?type=expense_analysis&limit=10

    Returns past analysis results for the authenticated user.
    """
    # Query analysis_history table
    # Filter by type if provided
    # Return paginated list
```

**URL configuration:**
```python
# apps/analysis/urls.py
urlpatterns = [
    path('expenses', views.analyze_expenses),
    path('recommendations', views.budget_recommendations),
    path('history', views.analysis_history_list),
]

# core/urls.py — add:
path('api/analysis/', include('apps.analysis.urls')),
```

### Step 5: Build the Analysis Page (Frontend)

Create the `/analysis` page with two sections (use shadcn Tabs):

**Tab 1: Expense Analysis**
- Date range picker (start date, end date)
- "Analyze My Spending" button
- Loading state: skeleton cards with animated pulse
- Results: insight cards arranged in a grid
  - Each card has: icon (based on type), title, description, severity badge (color-coded)
  - Types map to icons: trend → TrendingUp, anomaly → AlertTriangle, pattern → Repeat, comparison → BarChart2, saving_opportunity → PiggyBank (from lucide-react)
  - Severity maps to colors: info → blue, success → green, warning → amber, critical → red
- Summary section below the cards (full-width text block)

**Tab 2: Budget Recommendations**
- Month selector
- "Get Recommendations" button
- Loading state
- Results: recommendation cards
  - Each card shows: category name, current goal → suggested goal (with arrow), reasoning text, confidence badge, impact statement
  - If suggested_goal < current_goal, show a green "save" indicator
  - If suggested_goal > current_goal, show an amber "increase" indicator
- Overall advice section below

**Tab 3: History**
- List of past analyses/recommendations
- Click to expand and view past results
- Sorted by created_at DESC

### Step 6: Add Token Usage Tracking

Track LLM costs for personal awareness:

- Store `tokens_used` and `model_used` in every `analysis_history` record
- On the Settings page, add a "AI Usage" section showing:
  - Total tokens used this month
  - Estimated cost (based on Claude Sonnet pricing)
  - Number of analyses run

---

## Phase 3 Acceptance Criteria

- [ ] `POST /api/analysis/expenses` returns structured insights within 15 seconds
- [ ] `POST /api/analysis/recommendations` returns structured recommendations
- [ ] `GET /api/analysis/history` returns past results
- [ ] Insights reference actual user data (not generic advice)
- [ ] Journal entries are used as context in budget recommendations
- [ ] LLM response parsing handles malformed JSON gracefully
- [ ] All results are stored in `analysis_history` table
- [ ] Token usage is tracked per analysis
- [ ] Frontend displays insight cards with correct type icons and severity colors
- [ ] Frontend displays recommendation cards with current/suggested goal comparison
- [ ] Loading states shown during AI processing
- [ ] Error states shown if LLM call fails (with retry option)
- [ ] Analysis history is viewable and expandable
- [ ] Settings page shows token usage summary

---

## Code Quality Reminders

- LLM prompts must be stored as constants, not inline strings — they'll be iterated on
- Always validate and sanitize the LLM response before storing or returning it
- Never expose the Anthropic API key to the frontend — all LLM calls go through Django
- Log LLM errors with enough context to debug (input summary, error message) but never log full prompts with user data in production
- Test with real expense data — the quality of insights depends on prompt engineering, which requires real examples
- Temperature should be low (0.3) for analytical tasks — we want consistency, not creativity