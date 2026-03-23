import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface BudgetStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function BudgetStep({ onNext, onSkip, onBack }: BudgetStepProps) {
  const { user, profile } = useAuthStore();
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = profile?.currency ?? 'PHP';

  async function handleNext() {
    if (!user || !budget) {
      onNext();
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from('user_profiles')
        .update({ monthly_budget_goal: parseFloat(budget) })
        .eq('id', user.id);
    } finally {
      setSaving(false);
      onNext();
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Monthly Budget Goal</h2>
        <p className="text-muted-foreground text-sm">
          How much do you want to spend per month?
        </p>
      </div>
      <div>
        <Label htmlFor="budget">Budget ({currency})</Label>
        <Input
          id="budget"
          type="number"
          min="0"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="e.g. 30000"
          className="mt-1 text-lg"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleNext} disabled={saving}>
          {saving ? 'Saving...' : 'Continue'}
        </Button>
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
