import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BudgetGoalWithCategory, BudgetGoalFormData } from '@/types';

/**
 * CRUD hook for budget_goals via Supabase direct client.
 * Follows the same pattern as useExpenses.
 *
 * monthString: 'YYYY-MM-DD' — always the first day of the target month.
 */
export function useBudgetGoals() {
  const [goals, setGoals] = useState<BudgetGoalWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async (monthString: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('budget_goals')
        .select('*, categories(name, icon, color)')
        .eq('month', monthString);
      if (fetchError) throw fetchError;
      setGoals(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget goals');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates or updates a budget goal (upsert on user_id + category_id + month).
   * Returns the saved goal with joined category data.
   * Sets hook error state on failure AND re-throws so dialogs can display inline errors.
   */
  const upsertGoal = async (formData: BudgetGoalFormData): Promise<BudgetGoalWithCategory> => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: upsertError } = await supabase
        .from('budget_goals')
        .upsert(
          { ...formData, user_id: user.id },
          { onConflict: 'user_id,category_id,month' },
        )
        .select('*, categories(name, icon, color)')
        .single();

      if (upsertError) throw upsertError;

      setGoals((prev) => {
        const idx = prev.findIndex((g) => g.id === data.id);
        return idx >= 0
          ? prev.map((g) => (g.id === data.id ? data : g))
          : [data, ...prev];
      });

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget goal');
      throw err;
    }
  };

  const deleteGoal = async (id: string): Promise<void> => {
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('budget_goals').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete budget goal');
      throw err;
    }
  };

  return { goals, loading, error, fetchGoals, upsertGoal, deleteGoal };
}
