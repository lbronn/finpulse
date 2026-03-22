const SUGGESTIONS = [
  'How much did I spend this month?',
  'Am I on track for my budget?',
  "What's my biggest expense category?",
  'Where can I cut spending?',
  'Compare this month to last month',
  'What should I budget for next month?',
];

interface ChatSuggestionsProps {
  onSelect: (text: string) => void;
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div>
        <p className="text-base font-semibold">Ask me anything about your finances</p>
        <p className="text-sm text-muted-foreground mt-1">
          I have access to your spending data, budget goals, and patterns.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
