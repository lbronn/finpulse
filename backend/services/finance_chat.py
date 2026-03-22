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
import json
import logging
import uuid

import anthropic
from django.conf import settings
from django.db import connection

from services.financial_context import financial_context_engine

logger = logging.getLogger(__name__)

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
        """
        Send a message and get an AI response grounded in the user's financial context.

        Parameters:
            user_id (str): Authenticated user UUID.
            session_id (str | None): Chat session to continue, or None to start a new one.
            message (str): User's message text.

        Output:
            dict with keys: session_id, response, tokens_used
        """
        context = financial_context_engine.build_context(user_id)
        formatted_context = financial_context_engine.format_for_prompt(context)
        currency = context['profile'].get('currency', 'PHP')

        if not session_id:
            session_id = self._create_session(user_id, message[:100])
        history = self._get_history(session_id, limit=20)

        # Persist user message before calling the LLM so retries with the
        # same session_id replay a complete history.
        self._store_message(session_id, user_id, 'user', message)

        messages = []
        for msg in history:
            messages.append({'role': msg['role'], 'content': msg['content']})
        messages.append({'role': 'user', 'content': message})

        # Use replace() instead of .format() to avoid KeyError if user-controlled
        # journal content contains literal curly braces.
        system = (
            CHAT_SYSTEM_PROMPT
            .replace('{currency}', currency)
            .replace('{formatted_context}', formatted_context)
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

        self._store_message(session_id, user_id, 'assistant', assistant_reply, {'tokens_used': tokens})
        self._touch_session(session_id)

        return {
            'session_id': session_id,
            'response': assistant_reply,
            'tokens_used': tokens,
        }

    def _create_session(self, user_id: str, title: str) -> str:
        sid = str(uuid.uuid4())
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
                VALUES (%s, %s, %s, now(), now())
                """,
                [sid, user_id, title],
            )
        return sid

    def _touch_session(self, session_id: str) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE chat_sessions SET updated_at = now() WHERE id = %s',
                [session_id],
            )

    def _get_history(self, session_id: str, limit: int = 20) -> list:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT role, content FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC
                LIMIT %s
                """,
                [session_id, limit],
            )
            return [{'role': row[0], 'content': row[1]} for row in cursor.fetchall()]

    def _store_message(
        self,
        session_id: str,
        user_id: str,
        role: str,
        content: str,
        metadata: dict | None = None,
    ) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO chat_messages (id, session_id, user_id, role, content, metadata, created_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, now())
                """,
                [session_id, user_id, role, content, json.dumps(metadata or {})],
            )


# Singleton
finance_chat = FinanceChat()
