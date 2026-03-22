import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import type { ChatSession } from '@/types';

interface ChatSessionSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function ChatSessionSidebar({ currentSessionId, onSelectSession }: ChatSessionSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    api.get<ChatSession[]>('/analysis/chat/sessions?limit=20')
      .then(setSessions)
      .catch(() => {/* silently fail — sidebar is non-critical */});
  }, [currentSessionId]);

  if (sessions.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
        Past conversations
      </p>
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelectSession(s.id)}
          className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${
            s.id === currentSessionId ? 'bg-muted font-medium' : ''
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{s.title ?? 'Untitled conversation'}</span>
        </button>
      ))}
    </div>
  );
}
