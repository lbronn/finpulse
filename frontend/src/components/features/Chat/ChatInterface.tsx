import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSuggestions } from './ChatSuggestions';
import type { ChatMessage } from '@/types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onNewSession: () => void;
}

export function ChatInterface({ messages, loading, onSend, onNewSession }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <p className="text-sm font-medium text-muted-foreground">FinPulse AI</p>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onNewSession} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <ChatSuggestions onSelect={onSend} />
        ) : (
          messages.map((msg, i) => <ChatBubble key={i} message={msg} />)
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm max-w-[80%]">
              <span className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t pt-3 mt-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-32"
            placeholder="Ask about your spending…"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 h-[44px] w-[44px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 pl-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-line leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : message.isError
            ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
