/**
 * Summary: The text input bar for quick expense capture.
 * Shows a placeholder hint and a send button. Fires onSubmit with the trimmed text.
 *
 * Props:
 *   onSubmit  — Called with the input text when user submits
 *   loading   — Disables the input while parsing
 *   disabled  — Additional disabled state
 */
import { useState, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';

interface QuickCaptureInputProps {
  onSubmit: (text: string) => void;
  loading: boolean;
  disabled?: boolean;
}

export function QuickCaptureInput({ onSubmit, loading, disabled }: QuickCaptureInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !loading) {
      onSubmit(trimmed);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 bg-background border rounded-xl px-3 py-2 shadow-sm"
      style={{ minHeight: 56 }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="250 jollibee lunch"
        disabled={loading || disabled}
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
        aria-label="Quick capture expense"
      />
      <button
        type="submit"
        disabled={!value.trim() || loading || disabled}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity shrink-0"
        aria-label="Submit expense"
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </form>
  );
}

// Expose a reset function via a separate exported hook pattern
export function useQuickCaptureReset(setValue: (v: string) => void) {
  return () => setValue('');
}
