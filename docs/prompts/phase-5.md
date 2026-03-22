# Phase 5 Prompt — Kill the Friction (Week 5–6)

> **Goal:** Reduce expense entry to under 5 seconds, add AI auto-categorization, and make the mobile experience feel native.
> **Prerequisites:** Phases 1–4 complete — all MVP features working, app deployed and usable.

---

## Context Files to Read First

1. `product-brief.md` — design principle: "Data entry must be fast"
2. `prd.md` — existing expense data model and CRUD patterns
3. `architecture.md` — hybrid backend pattern (which calls go to Supabase vs Django)
5. `database-schema.md` — current `expenses` and `categories` tables

---

## Environment Variables (Add to .env)

```
# Haiku is used for fast, cheap extraction tasks (quick capture + auto-categorize)
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5-20251001
```

Update `core/settings.py`:
```python
ANTHROPIC_HAIKU_MODEL = os.getenv('ANTHROPIC_HAIKU_MODEL', 'claude-haiku-4-5-20251001')
```

---

## New Dependencies

**Frontend:**
```bash
cd frontend && npm install @use-gesture/react
```

**Backend:**
```bash
cd backend && pip install anthropic --upgrade && pip freeze > requirements.txt
```

---

## Database Changes

### New table: `categorization_history`

Stores per-user categorization patterns for improving auto-categorization accuracy over time.

```sql
-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS categorization_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description_pattern VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    frequency INTEGER NOT NULL DEFAULT 1,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cathistory_user ON categorization_history(user_id);
CREATE UNIQUE INDEX idx_cathistory_user_pattern ON categorization_history(user_id, description_pattern);

ALTER TABLE categorization_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cathistory_select_own" ON categorization_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cathistory_insert_own" ON categorization_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cathistory_update_own" ON categorization_history
    FOR UPDATE USING (auth.uid() = user_id);
```

### Django model mirror

```python
# apps/expenses/models.py — add this model
class CategorizationHistory(models.Model):
    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    description_pattern = models.CharField(max_length=255)
    category_id = models.UUIDField()
    frequency = models.IntegerField(default=1)
    last_used_at = models.DateTimeField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'categorization_history'
```

---

## Step-by-Step Implementation

### Step 1: Build the NLP Expense Parser (Django)

This is the core of quick capture — a single text input that the LLM parses into structured expense data.

**Create `backend/services/expense_parser.py`:**

```python
"""
Summary: Parses natural language expense descriptions into structured data.
Uses Claude Haiku for fast, cheap extraction (<1s response time).

Parameters:
    raw_text (str): User's natural language input, e.g. "Jollibee lunch 250"
    user_id (str): For fetching categorization history and user categories
    currency (str): User's currency code for context

Output:
    dict with keys:
        - amount (float): Extracted amount
        - description (str): Cleaned description
        - category_id (str | None): Best-match category UUID
        - category_name (str | None): Category name for display
        - expense_date (str): ISO date, defaults to today
        - confidence (str): "high" | "medium" | "low"
        - raw_text (str): Original input for reference

Dependencies: anthropic SDK, Django ORM (for category and history lookups)
"""
import anthropic
import json
from datetime import date, timedelta
from django.conf import settings
from django.db import connection

PARSE_SYSTEM_PROMPT = """You are an expense parser. Extract structured data from natural language expense descriptions.

RULES:
- Extract the amount (number). If no currency symbol, assume {currency}.
- Extract a clean description (what the expense was for).
- Suggest the best-matching category from the provided list.
- Extract the date if mentioned ("yesterday", "last friday", "march 10"). Default to today ({today}) if not specified.
- If the input is ambiguous or you cannot extract an amount, set confidence to "low".
- Respond ONLY with valid JSON. No markdown, no explanation.

RESPONSE FORMAT:
{{
    "amount": 250.00,
    "description": "Lunch at Jollibee",
    "category_name": "Food & Dining",
    "expense_date": "2026-03-14",
    "confidence": "high"
}}

USER'S CATEGORIES:
{categories}

USER'S COMMON PATTERNS:
{patterns}
"""

PARSE_USER_PROMPT = """Parse this expense: "{raw_text}"

Today's date is {today}. Yesterday was {yesterday}."""


class ExpenseParser:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_HAIKU_MODEL

    def parse(self, raw_text: str, user_id: str, currency: str = 'PHP') -> dict:
        categories = self._get_user_categories(user_id)
        patterns = self._get_categorization_patterns(user_id)
        today = date.today()
        yesterday = today - timedelta(days=1)

        category_list = "\n".join(
            [f"- {c['name']} (id: {c['id']})" for c in categories]
        )
        pattern_list = "\n".join(
            [f"- \"{p['description_pattern']}\" → {p['category_name']} (used {p['frequency']}x)"
             for p in patterns[:20]]  # Top 20 most frequent
        ) or "No patterns yet."

        system = PARSE_SYSTEM_PROMPT.format(
            currency=currency,
            today=today.isoformat(),
            categories=category_list,
            patterns=pattern_list
        )
        user = PARSE_USER_PROMPT.format(
            raw_text=raw_text,
            today=today.isoformat(),
            yesterday=yesterday.isoformat()
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=300,
                temperature=0.1,
                system=system,
                messages=[{"role": "user", "content": user}]
            )

            content = response.content[0].text
            # Strip markdown fences if present
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            parsed = json.loads(content)

            # Resolve category_name to category_id
            category_id = None
            category_name = parsed.get("category_name")
            if category_name:
                for c in categories:
                    if c["name"].lower() == category_name.lower():
                        category_id = c["id"]
                        break

            return {
                "amount": float(parsed.get("amount", 0)),
                "description": parsed.get("description", raw_text),
                "category_id": category_id,
                "category_name": category_name,
                "expense_date": parsed.get("expense_date", today.isoformat()),
                "confidence": parsed.get("confidence", "low"),
                "raw_text": raw_text,
            }

        except (json.JSONDecodeError, anthropic.APIError, KeyError) as e:
            # Fallback: return raw text with no parsing
            return {
                "amount": None,
                "description": raw_text,
                "category_id": None,
                "category_name": None,
                "expense_date": today.isoformat(),
                "confidence": "low",
                "raw_text": raw_text,
            }

    def _get_user_categories(self, user_id: str) -> list:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id::text, name FROM categories
                WHERE is_default = true OR user_id = %s
                ORDER BY name
            """, [user_id])
            return [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]

    def _get_categorization_patterns(self, user_id: str) -> list:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT ch.description_pattern, c.name AS category_name, ch.frequency
                FROM categorization_history ch
                JOIN categories c ON c.id = ch.category_id
                WHERE ch.user_id = %s
                ORDER BY ch.frequency DESC
                LIMIT 20
            """, [user_id])
            return [
                {"description_pattern": row[0], "category_name": row[1], "frequency": row[2]}
                for row in cursor.fetchall()
            ]


# Singleton
expense_parser = ExpenseParser()
```

**Create the Django endpoint:**

```python
# apps/expenses/views.py — add this view

from services.expense_parser import expense_parser

@api_view(['POST'])
def parse_expense(request):
    """
    POST /api/expenses/parse
    Body: { "text": "Jollibee lunch 250" }

    Parses natural language into structured expense data.
    Does NOT create the expense — returns parsed data for user confirmation.

    Output:
        200: { amount, description, category_id, category_name, expense_date, confidence, raw_text }
        400: { error: "text is required" }
    """
    user_id = request.user_id
    raw_text = request.data.get('text', '').strip()

    if not raw_text:
        return Response({'error': 'text is required'}, status=400)

    if len(raw_text) > 500:
        return Response({'error': 'text must be under 500 characters'}, status=400)

    # Get user currency from profile
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT currency FROM user_profiles WHERE id = %s", [user_id]
        )
        row = cursor.fetchone()
        currency = row[0] if row else 'PHP'

    result = expense_parser.parse(raw_text, user_id, currency)
    return Response(result, status=200)
```

**Register the URL:**
```python
# apps/expenses/urls.py — add:
path('parse', views.parse_expense),
```

### Step 2: Build the Auto-Categorization Service (Django)

This runs when an expense is created WITHOUT an explicit category choice — either from quick capture or from the normal form when the user skips the category dropdown.

**Create `backend/services/auto_categorizer.py`:**

```python
"""
Summary: Auto-categorizes expenses using a two-tier approach:
1. Pattern matching: Check categorization_history for known description patterns.
2. LLM fallback: If no pattern match, use Claude Haiku to suggest a category.

Parameters:
    description (str): Expense description
    amount (float): Expense amount (provides context)
    user_id (str): For user-specific patterns and categories

Output:
    dict with keys:
        - category_id (str): Suggested category UUID
        - category_name (str): Category name
        - method (str): "pattern" | "llm" — how the category was determined
        - confidence (str): "high" | "medium" | "low"

Dependencies: anthropic SDK, Django ORM
"""
import anthropic
import json
from django.conf import settings
from django.db import connection

CATEGORIZE_SYSTEM_PROMPT = """You categorize expenses. Given a description and amount, pick the best category.

RULES:
- Pick exactly ONE category from the list.
- Consider the description AND the amount for context.
- If genuinely uncertain between two categories, pick the more specific one.
- Respond ONLY with valid JSON: {{"category_name": "...", "confidence": "high|medium|low"}}

CATEGORIES:
{categories}
"""


class AutoCategorizer:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_HAIKU_MODEL

    def categorize(self, description: str, amount: float, user_id: str) -> dict:
        # Tier 1: Pattern match from history
        pattern_result = self._match_pattern(description, user_id)
        if pattern_result:
            return pattern_result

        # Tier 2: LLM categorization
        return self._llm_categorize(description, amount, user_id)

    def _match_pattern(self, description: str, user_id: str) -> dict | None:
        """Check if description matches a known pattern (case-insensitive substring)."""
        normalized = description.lower().strip()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT ch.category_id::text, c.name, ch.frequency
                FROM categorization_history ch
                JOIN categories c ON c.id = ch.category_id
                WHERE ch.user_id = %s
                AND LOWER(%s) LIKE '%%' || LOWER(ch.description_pattern) || '%%'
                ORDER BY ch.frequency DESC
                LIMIT 1
            """, [user_id, normalized])
            row = cursor.fetchone()
            if row:
                return {
                    "category_id": row[0],
                    "category_name": row[1],
                    "method": "pattern",
                    "confidence": "high" if row[2] >= 3 else "medium",
                }
        return None

    def _llm_categorize(self, description: str, amount: float, user_id: str) -> dict:
        """Use Claude Haiku to categorize when no pattern exists."""
        categories = self._get_categories(user_id)
        category_list = "\n".join([f"- {c['name']}" for c in categories])

        system = CATEGORIZE_SYSTEM_PROMPT.format(categories=category_list)
        user_msg = f'Expense: "{description}" for {amount}'

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=100,
                temperature=0.1,
                system=system,
                messages=[{"role": "user", "content": user_msg}]
            )
            content = response.content[0].text.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            parsed = json.loads(content)
            category_name = parsed.get("category_name")

            # Resolve to ID
            category_id = None
            for c in categories:
                if c["name"].lower() == category_name.lower():
                    category_id = c["id"]
                    break

            if not category_id:
                # Fallback to "Other"
                for c in categories:
                    if c["name"].lower() == "other":
                        category_id = c["id"]
                        category_name = "Other"
                        break

            return {
                "category_id": category_id,
                "category_name": category_name,
                "method": "llm",
                "confidence": parsed.get("confidence", "medium"),
            }

        except Exception:
            # Final fallback: "Other" category
            for c in categories:
                if c["name"].lower() == "other":
                    return {
                        "category_id": c["id"],
                        "category_name": "Other",
                        "method": "fallback",
                        "confidence": "low",
                    }
            return {
                "category_id": None,
                "category_name": None,
                "method": "fallback",
                "confidence": "low",
            }

    def _get_categories(self, user_id: str) -> list:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id::text, name FROM categories
                WHERE is_default = true OR user_id = %s
                ORDER BY name
            """, [user_id])
            return [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]

    @staticmethod
    def record_categorization(user_id: str, description: str, category_id: str):
        """Record or update a categorization pattern after user confirms."""
        # Normalize: take first 3 significant words as pattern
        words = description.lower().strip().split()
        pattern = " ".join(words[:3]) if len(words) >= 3 else description.lower().strip()

        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO categorization_history (id, user_id, description_pattern, category_id, frequency, last_used_at, created_at)
                VALUES (gen_random_uuid(), %s, %s, %s, 1, now(), now())
                ON CONFLICT (user_id, description_pattern)
                DO UPDATE SET
                    frequency = categorization_history.frequency + 1,
                    category_id = EXCLUDED.category_id,
                    last_used_at = now()
            """, [user_id, pattern, category_id])


# Singleton
auto_categorizer = AutoCategorizer()
```

**Create the Django endpoint:**

```python
# apps/expenses/views.py — add this view

from services.auto_categorizer import auto_categorizer, AutoCategorizer

@api_view(['POST'])
def categorize_expense(request):
    """
    POST /api/expenses/categorize
    Body: { "description": "Grab ride to office", "amount": 180.00 }

    Returns a suggested category for the given expense.

    Output:
        200: { category_id, category_name, method, confidence }
        400: { error: "description is required" }
    """
    user_id = request.user_id
    description = request.data.get('description', '').strip()
    amount = request.data.get('amount', 0)

    if not description:
        return Response({'error': 'description is required'}, status=400)

    result = auto_categorizer.categorize(description, float(amount), user_id)
    return Response(result, status=200)


@api_view(['POST'])
def confirm_categorization(request):
    """
    POST /api/expenses/confirm-category
    Body: { "description": "Grab ride to office", "category_id": "uuid" }

    Records a confirmed categorization to improve future suggestions.
    Call this AFTER the user saves an expense (whether they accepted or changed the suggestion).

    Output:
        200: { "status": "recorded" }
    """
    user_id = request.user_id
    description = request.data.get('description', '').strip()
    category_id = request.data.get('category_id', '').strip()

    if not description or not category_id:
        return Response({'error': 'description and category_id are required'}, status=400)

    AutoCategorizer.record_categorization(user_id, description, category_id)
    return Response({'status': 'recorded'}, status=200)
```

**Register URLs:**
```python
# apps/expenses/urls.py — add:
path('categorize', views.categorize_expense),
path('confirm-category', views.confirm_categorization),
```

### Step 3: Build the Quick Capture UI (Frontend)

This is the most important UI change in the entire post-MVP roadmap.

**Create `src/components/features/QuickCapture.tsx`:**

This component is a persistent input bar fixed at the bottom of the screen. It's visible on the Dashboard and Expenses pages.

**Behavior:**
1. User types natural language (e.g., "jollibee 250" or "grab to work 180")
2. On submit (Enter key or tap send button), call `POST /api/expenses/parse`
3. Show a confirmation card that slides up above the input bar:
   - Pre-filled: amount, description, category (with colored badge), date
   - Each field is editable inline (tap to change)
   - Category shows as a tappable badge — tap to open category selector
   - Two buttons: "Save" (confirm) and "Edit" (opens full expense form with pre-filled data)
4. On "Save": create the expense via Supabase client, then call `POST /api/expenses/confirm-category`
5. Card slides away, input clears, ready for next entry

**Component structure:**
```
QuickCapture/
├── QuickCapture.tsx          — Main wrapper (input bar + confirmation card)
├── QuickCaptureInput.tsx     — The text input with send button
├── QuickCapturePreview.tsx   — The confirmation card with parsed data
└── QuickCaptureCategory.tsx  — Tappable category badge with dropdown
```

**Key UX details:**
- Input bar height: 56px with 12px padding (comfortable thumb target)
- Input placeholder: "250 jollibee lunch" (show the pattern users should follow)
- Send button: right-aligned arrow icon (lucide `SendHorizontal`)
- Loading state: pulsing skeleton card while waiting for parse response
- Error state: if parse returns `confidence: "low"` and no amount, show a toast: "Couldn't parse that. Try: amount + description" and open the full form
- Keyboard: `inputMode="text"` (not numeric — the input accepts full text)
- Auto-focus: when the user taps the input, auto-scroll the page so the input is visible above the keyboard

**Data flow on save:**
```typescript
async function handleConfirmSave(parsedData: ParsedExpense) {
    // 1. Create expense via Supabase
    const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount: parsedData.amount,
        description: parsedData.description,
        category_id: parsedData.category_id,
        expense_date: parsedData.expense_date,
    });

    if (error) throw error;

    // 2. Record categorization pattern for learning
    await api.post('/expenses/confirm-category', {
        description: parsedData.description,
        category_id: parsedData.category_id,
    });

    // 3. Clear input, dismiss preview, show success toast
}
```

### Step 4: Update the Dashboard Layout

Restructure the dashboard to prioritize quick capture:

**New layout (top to bottom):**
1. **Header** — greeting + date
2. **Monthly summary strip** — compact: total spent | budget remaining | days left in month
3. **Quick Capture input** — the NLP text input (always visible, not fixed-position — scroll with the page on dashboard, but fixed-position on other pages)
4. **Recent expenses** — last 5, each with swipe-to-delete (see Step 5)
5. **Budget status cards** — compact category progress bars
6. **Charts section** — monthly trend + category breakdown (existing from Phase 2)

### Step 5: Implement Mobile Gesture Support

**Swipe-to-delete on expense and journal list items:**

Create a reusable `SwipeableRow` component using `@use-gesture/react`:

```typescript
// src/components/ui/SwipeableRow.tsx
import { useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';

interface SwipeableRowProps {
    children: React.ReactNode;
    onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
    const [offset, setOffset] = useState(0);
    const [showDelete, setShowDelete] = useState(false);
    const deleteThreshold = -80; // pixels

    const bind = useDrag(({ movement: [mx], last, cancel }) => {
        // Only allow left swipe
        if (mx > 0) {
            cancel();
            return;
        }

        if (last) {
            if (mx < deleteThreshold) {
                setShowDelete(true);
                setOffset(deleteThreshold);
            } else {
                setOffset(0);
                setShowDelete(false);
            }
        } else {
            setOffset(Math.max(mx, deleteThreshold - 20));
        }
    }, { axis: 'x', filterTaps: true });

    return (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Delete button revealed on swipe */}
            <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <button
                    onClick={() => { onDelete(); setOffset(0); setShowDelete(false); }}
                    className="bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-sm"
                >
                    Delete
                </button>
            </div>

            {/* Swipeable content */}
            <div
                {...bind()}
                style={{
                    transform: `translateX(${offset}px)`,
                    transition: offset === 0 || showDelete ? 'transform 0.2s ease' : 'none',
                    touchAction: 'pan-y',
                }}
            >
                {children}
            </div>
        </div>
    );
}
```

**Apply to expense list items and journal entries:**
Wrap each list item in `<SwipeableRow onDelete={() => handleDelete(item.id)}>`.

**Pull-to-refresh:**

Create a `PullToRefresh` wrapper component:
```typescript
// src/components/ui/PullToRefresh.tsx
// Uses touch events to detect pull-down gesture at top of scroll container.
// Shows a spinner while refreshing.
// Calls onRefresh() prop which should return a Promise.
```

Apply to the Expenses page, Journal page, and Dashboard.

### Step 6: Mobile UX Polish

**Haptic feedback on actions:**
```typescript
// src/utils/haptics.ts
export function hapticLight() {
    if ('vibrate' in navigator) {
        navigator.vibrate(10);
    }
}

export function hapticMedium() {
    if ('vibrate' in navigator) {
        navigator.vibrate(25);
    }
}

export function hapticSuccess() {
    if ('vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]);
    }
}
```

Call `hapticSuccess()` on expense save, `hapticMedium()` on delete, `hapticLight()` on button taps.

**Numeric keyboard for amount fields:**
Audit ALL amount input fields and ensure they have:
```html
<input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" />
```
Do NOT use `type="number"` — it has inconsistent behavior across mobile browsers. Use `type="text"` with `inputMode="decimal"` for the best numeric keyboard experience.

**Touch target audit:**
Every interactive element (buttons, links, dropdown triggers, list items, badges) must be at least 44x44px. Add padding if the visual element is smaller:
```css
/* Example: small badge that needs a larger touch target */
.touch-target {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

**Bottom navigation improvements:**
- Active tab has a filled icon + label, inactive tabs show outline icon only
- Tab bar height: 64px (comfortable for thumb reach)
- Add subtle scale animation on tab tap (0.95 → 1.0 over 100ms)

---

## Validation Tests

After completing all steps, run these validation checks. Each must pass.

### Test 1: Quick Capture — Happy Path
```
Action: Type "jollibee lunch 250" into quick capture input and submit
Expected:
  - Parse endpoint returns within 2 seconds
  - Preview card shows: amount=250, description="Lunch at Jollibee" (or similar cleaned text),
    category="Food & Dining", date=today
  - Tap Save
  - Expense appears in expense list with correct data
  - Categorization history has a new entry for this pattern
```

### Test 2: Quick Capture — Ambiguous Input
```
Action: Type "stuff 500" into quick capture input and submit
Expected:
  - Parse endpoint returns with confidence="low" or confidence="medium"
  - Preview card still shows with amount=500 and description="stuff"
  - Category may be "Other" or a guess — the badge is tappable to change
  - User can edit category before saving
```

### Test 3: Quick Capture — No Amount
```
Action: Type "went to the mall" into quick capture input and submit
Expected:
  - Parse returns with amount=null or amount=0
  - UI shows an error toast: "Couldn't parse the amount. Try: amount + description"
  - Full expense form opens with description pre-filled
```

### Test 4: Quick Capture — Date Extraction
```
Action: Type "grab yesterday 180" into quick capture input
Expected:
  - expense_date = yesterday's date (not today)
  - Preview card shows the correct date
```

### Test 5: Auto-Categorization — Pattern Learning
```
Action:
  1. Create 3 expenses with description containing "Jollibee" and category "Food & Dining"
  2. Create a new expense with description "Jollibee breakfast"
Expected:
  - The 4th expense auto-suggests "Food & Dining" with confidence="high" and method="pattern"
  - The pattern match should be near-instant (no LLM call needed)
```

### Test 6: Auto-Categorization — LLM Fallback
```
Action: Create an expense with description "Annual Netflix subscription" (no prior pattern)
Expected:
  - Auto-categorizer falls back to LLM
  - Returns category "Entertainment" with method="llm"
  - Response within 2 seconds
```

### Test 7: Swipe-to-Delete
```
Action: On mobile viewport (375px), swipe left on an expense list item
Expected:
  - Red "Delete" button revealed on the right
  - Tapping Delete removes the expense (with confirmation if implemented)
  - Swiping back right dismisses the delete button
  - Vertical scrolling still works normally (swipe gesture doesn't hijack scroll)
```

### Test 8: Pull-to-Refresh
```
Action: On the Expenses page, pull down from the top
Expected:
  - Spinner appears at the top
  - Expense list refetches
  - Spinner dismisses after data loads
```

### Test 9: Mobile Touch Targets
```
Action: Use Chrome DevTools mobile inspector at 375px width
Expected:
  - All buttons are at least 44x44px tap area
  - Amount inputs trigger numeric keyboard on mobile
  - Quick capture input is easily tappable
  - Bottom navigation tabs have comfortable spacing
```

### Test 10: Quick Capture → Full Flow
```
Action: Complete this full flow in under 10 seconds:
  1. Tap quick capture input
  2. Type "coffee 150"
  3. Tap send
  4. Verify parsed data
  5. Tap Save
Expected:
  - Total time from first tap to saved expense < 10 seconds
  - Ideally < 5 seconds with practiced usage
```

### Test 11: Error Recovery
```
Action: Disconnect from internet, type "lunch 200" into quick capture
Expected:
  - Show an error state (not a crash): "Can't reach the server. Try again or add manually."
  - "Add manually" button opens the full expense form (which will also fail on save,
    but the form should be pre-filled from the typed text)
```

---

## Code Quality Reminders

- Haiku calls should respond in under 1.5 seconds. If they're slower, check your prompt length — keep it minimal for extraction tasks.
- The parse endpoint is called on every quick capture submit. Rate limit it: max 30 requests per minute per user.
- Auto-categorization history grows over time. Add a cleanup job eventually (not now) to prune patterns with frequency=1 older than 90 days.
- SwipeableRow must not interfere with vertical scrolling. Test on an actual phone, not just DevTools.
- The quick capture bar must NOT use `position: fixed` on iOS Safari — it causes viewport bugs with the keyboard. Use `position: sticky` with `bottom: 0` on a scroll container instead.