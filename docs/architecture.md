# Architecture Decision Record (ADR) — FinPulse

> **Version:** 1.0
> **Last Updated:** March 14, 2026

---

## ADR-001: Hybrid Backend (Supabase Direct + Django API)

### Context
The app needs both simple CRUD operations (expenses, journal, budget goals) and complex server-side logic (aggregation, LLM orchestration). Using Django for everything adds unnecessary latency and boilerplate for simple operations. Using Supabase for everything limits us on complex business logic (Edge Functions are Deno-based, limiting Python ecosystem access).

### Decision
**Use a hybrid approach:**
- Frontend → Supabase JS Client for simple CRUD (with RLS for security)
- Frontend → Django REST API for complex operations (aggregations, LLM, business logic)
- Django → Supabase Postgres directly (via psycopg2/Django ORM with service role credentials)

### Consequences
- **Positive:** Faster CRUD (no round-trip through Django), Django only handles what needs server logic, cleaner separation of concerns.
- **Negative:** Two "backends" to manage, need to keep Supabase schema and Django models in sync, auth validation happens in two places (Supabase RLS + Django middleware).
- **Mitigation:** Django models are read-only mirrors of the Supabase schema (Supabase is the source of truth for schema). A shared `types/` directory on the frontend defines interfaces for both backends.

---

## ADR-002: Supabase Auth with Django JWT Validation

### Context
We need authentication across both Supabase (direct CRUD) and Django (API calls). Running two separate auth systems would be confusing and insecure.

### Decision
**Supabase Auth is the single source of truth for authentication.**
- Frontend authenticates with Supabase → gets JWT
- For Supabase calls: JWT is handled automatically by the Supabase JS client
- For Django calls: Frontend sends the same JWT in the `Authorization: Bearer <token>` header
- Django validates the JWT using Supabase's JWT secret (HMAC verification) in custom middleware

### Django Middleware Pattern
```python
# apps/users/middleware.py
import jwt
from django.conf import settings
from django.http import JsonResponse

class SupabaseAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not token:
                return JsonResponse({'error': 'No token provided'}, status=401)
            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=['HS256'],
                    audience='authenticated'
                )
                request.user_id = payload['sub']  # Supabase user UUID
            except jwt.InvalidTokenError:
                return JsonResponse({'error': 'Invalid token'}, status=401)
        return self.get_response(request)
```

### Consequences
- Single sign-on across both backends
- No Django user model needed — `request.user_id` is the Supabase UUID
- Token refresh is handled by the Supabase JS client on the frontend

---

## ADR-003: Claude Sonnet for LLM Features

### Context
Need an LLM for expense analysis and budget recommendations. Key requirements: good structured reasoning over financial data, large context window for multi-month history, cost-effective for personal use.

### Decision
**Use Anthropic Claude Sonnet (claude-sonnet-4-20250514).**

### Rationale
- Strong structured reasoning on tabular/financial data
- 200k context window — fits months of expense data without chunking
- Cost-effective for personal use (~$3/1M input tokens, ~$15/1M output tokens)
- Bronn already works with Anthropic tools professionally

### Fallback
If Claude API is unavailable or costs become a concern, switch to OpenAI GPT-4o-mini for basic analysis. The `services/llm_client.py` abstraction layer makes this a config change, not a code rewrite.

---

## ADR-004: Zustand for State Management

### Context
Need client-side state management for auth state, expense list cache, UI state (modals, filters), and budget data.

### Decision
**Use Zustand over Redux, Jotai, or React Context.**

### Rationale
- Minimal boilerplate compared to Redux
- TypeScript-first with excellent inference
- Scales fine for the app's complexity level
- No provider wrappers needed
- Easy to split into multiple stores by domain (authStore, expenseStore, budgetStore)

---

## ADR-005: Supabase Postgres as Source of Truth for Schema

### Context
Both Supabase (via RLS + JS client) and Django (via ORM) access the same Postgres database. Schema changes could cause drift.

### Decision
**Supabase owns the schema. Django models are read-only mirrors.**

### How It Works
- All schema changes happen via Supabase migrations (SQL files in `supabase/migrations/`)
- Django models use `managed = False` in their Meta class — Django reads from the tables but never creates/alters them
- If a migration changes a table, the corresponding Django model must be updated to match

```python
# Example: Django model mirroring Supabase table
class Expense(models.Model):
    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    category_id = models.UUIDField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    notes = models.TextField(null=True, blank=True)
    expense_date = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False  # Supabase owns this table
        db_table = 'expenses'
```

---

## ADR-006: Monorepo Structure

### Context
Frontend and backend are separate services with different runtimes (Node vs Python). Need to decide between monorepo and separate repos.

### Decision
**Monorepo.** Single repository with `frontend/` and `backend/` directories.

### Rationale
- Easier to maintain shared context (types, docs, env config)
- Single PR for features that touch both frontend and backend
- Simpler CI/CD setup at MVP scale
- Shared `Makefile` and `docker-compose.yml` for local dev

### When to Split
If the project grows to have separate teams or significantly different deployment cadences, split into separate repos. For a single developer building an MVP, monorepo is the right call.