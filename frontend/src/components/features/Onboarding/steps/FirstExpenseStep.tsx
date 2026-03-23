import { useState } from 'react';
import { QuickCapture } from '@/components/features/QuickCapture/QuickCapture';
import { useCategories } from '@/hooks/useCategories';
import type { ExpenseFormData } from '@/types';

interface FirstExpenseStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function FirstExpenseStep({ onNext, onSkip, onBack }: FirstExpenseStepProps) {
  const [saved, setSaved] = useState(false);
  const { categories } = useCategories();

  function handleSaved() {
    setSaved(true);
    setTimeout(onNext, 1000);
  }

  // onEditFull is a no-op in onboarding context — user can edit later in the full app
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEditFull = (_prefill: ExpenseFormData) => {};

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Add Your First Expense</h2>
        <p className="text-muted-foreground text-sm">
          Try typing something like "Jollibee lunch 250" — our AI will parse it for you.
        </p>
      </div>
      {saved ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center text-sm text-green-600 dark:text-green-400">
          Expense saved! Moving on...
        </div>
      ) : (
        <QuickCapture
          categories={categories}
          onSaved={handleSaved}
          onEditFull={handleEditFull}
        />
      )}
      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          Back
        </button>
        <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">
          Skip
        </button>
      </div>
    </div>
  );
}
