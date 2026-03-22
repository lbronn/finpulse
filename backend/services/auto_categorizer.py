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
