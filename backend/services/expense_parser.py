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
