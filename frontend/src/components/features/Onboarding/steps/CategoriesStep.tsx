import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CategoriesStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const DEFAULT_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Entertainment', 'Shopping',
  'Utilities', 'Healthcare', 'Education', 'Personal Care', 'Travel', 'Others',
];

export default function CategoriesStep({ onNext, onSkip, onBack }: CategoriesStepProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['Food & Dining', 'Transportation', 'Utilities'])
  );

  function toggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Top Spending Categories</h2>
        <p className="text-muted-foreground text-sm">
          Pick the categories that apply to you.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              selected.has(cat)
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={onNext}>Continue</Button>
        <div className="flex justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
            Back
          </button>
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
