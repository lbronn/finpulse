import { useState } from 'react';
import { api } from '@/lib/api';
import type { ChatMessage, ChatResponse } from '@/types';

export function useFinanceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage(text: string) {
    // Optimistically add user message to the UI
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, created_at: new Date().toISOString() },
    ]);
    setLoading(true);

    try {
      const result = await api.post<ChatResponse>('/analysis/chat', {
        message: text,
        session_id: sessionId,
      });

      setSessionId(result.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.response,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't process that. Please try again.",
          created_at: new Date().toISOString(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSession(id: string) {
    setLoading(true);
    try {
      const history = await api.get<ChatMessage[]>(
        `/analysis/chat/sessions/${id}/messages`,
      );
      setSessionId(id);
      setMessages(history);
    } catch {
      // Non-critical — show empty chat rather than crashing
      setSessionId(id);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  function startNewSession() {
    setMessages([]);
    setSessionId(null);
  }

  return { messages, loading, sendMessage, sessionId, loadSession, startNewSession };
}
