"""
LLM client abstraction layer.

Summary: Wraps the Anthropic SDK to provide a clean interface for sending
prompts and receiving structured responses. Handles error logging and
token usage tracking.

Dependencies: anthropic (pip install anthropic)
"""
import logging
import threading
from typing import TypedDict

import anthropic
from django.conf import settings

logger = logging.getLogger(__name__)


class LLMResponse(TypedDict):
    content: str
    tokens_used: int
    model: str


class LLMClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.3,
    ) -> LLMResponse:
        """
        Send a prompt to Claude and return the response.

        Parameters:
            system_prompt (str): System-level instructions for the model.
            user_prompt (str): The user-facing prompt with data.
            max_tokens (int): Max response tokens. Default 2000.
            temperature (float): Sampling temperature. Default 0.3 (analytical tasks).

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
                messages=[{'role': 'user', 'content': user_prompt}],
            )
            if not response.content:
                raise ValueError(
                    f'LLM returned empty content. stop_reason={response.stop_reason}'
                )
            return {
                'content': response.content[0].text,
                'tokens_used': response.usage.input_tokens + response.usage.output_tokens,
                'model': self.model,
            }
        except anthropic.APIError as e:
            logger.error(f'Anthropic API error: {e}')
            raise
        except Exception as e:
            logger.error(f'LLM client error: {e}')
            raise


# Singleton — instantiated lazily to avoid import-time API key requirement
_llm_client: LLMClient | None = None
_llm_client_lock = threading.Lock()


def get_llm_client() -> LLMClient:
    """Return the singleton LLMClient, creating it if needed.

    Uses double-checked locking to avoid the race condition where two threads
    both see _llm_client is None and each create a separate instance.
    """
    global _llm_client
    if _llm_client is None:
        with _llm_client_lock:
            if _llm_client is None:
                _llm_client = LLMClient()
    return _llm_client
