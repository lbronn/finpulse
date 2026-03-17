import { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MonthSelector from '@/components/budget/MonthSelector';
import OverallBudgetCard from '@/components/budget/OverallBudgetCard';
import CategoryBudgetGrid from '@/components/budget/CategoryBudgetGrid';
import BudgetGoalDialog from '@/components/budget/BudgetGoalDialog';
import { useAuthStore } from '@/stores/authStore';
import { useCategories } from '@/hooks/useCategories';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { monthToDateString, dateStringToMonth } from '@/lib/formatters';
import type { BudgetGoalFormData, BudgetGoalWithCategory, BudgetSummaryResponse } from '@/types';

export default function BudgetPage() {
  const { profile, setProfile } = useAuthStore();
  const { categories } = useCategories();
  const { goals, fetchGoals, upsertGoal } = useBudgetGoals();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const [summary, setSummary] = useState<BudgetSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BudgetGoalWithCategory | undefined>(undefined);
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | undefined>(undefined);

  // Overall budget goal edit dialog
  const [overallDialogOpen, setOverallDialogOpen] = useState(false);
  const [overallAmount, setOverallAmount] = useState('');
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallError, setOverallError] = useState<string | null>(null);

  const currency = profile?.currency ?? 'PHP';
  const monthString = monthToDateString(year, month); // 'YYYY-MM-DD'
  const monthParam = dateStringToMonth(monthString);   // 'YYYY-MM'

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await api.get<BudgetSummaryResponse>(`/budgets/summary?month=${monthParam}`);
      setSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to load budget summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [monthParam]);

  useEffect(() => {
    fetchGoals(monthString);
    fetchSummary();
  }, [fetchGoals, fetchSummary, monthString]);

  // Build a map from category_id → goal for quick lookup in CategoryBudgetGrid
  const goalsMap: Record<string, BudgetGoalWithCategory> = {};
  for (const g of goals) {
    goalsMap[g.category_id] = g;
  }

  const existingGoalCategoryIds = goals.map((g) => g.category_id);

  // ── Category goal handlers ──────────────────────────────────────────────

  const handleSetGoal = (categoryId: string) => {
    setEditingGoal(undefined);
    setPreselectedCategoryId(categoryId);
    setGoalDialogOpen(true);
  };

  const handleEditGoal = (goal: BudgetGoalWithCategory) => {
    setEditingGoal(goal);
    setPreselectedCategoryId(undefined);
    setGoalDialogOpen(true);
  };

  const handleGoalSubmit = async (formData: BudgetGoalFormData) => {
    await upsertGoal(formData);
    await fetchSummary();
  };

  // ── Overall budget goal handler ─────────────────────────────────────────

  const handleOpenOverallDialog = () => {
    setOverallAmount(profile?.monthly_budget_goal ? String(profile.monthly_budget_goal) : '');
    setOverallError(null);
    setOverallDialogOpen(true);
  };

  const handleSaveOverallGoal = async () => {
    setOverallError(null);
    const num = parseFloat(overallAmount);
    if (overallAmount && (isNaN(num) || num <= 0)) {
      setOverallError('Amount must be a positive number.');
      return;
    }

    setOverallLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newGoal = overallAmount ? num : null;
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ monthly_budget_goal: newGoal })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      setOverallDialogOpen(false);
      await fetchSummary();
    } catch (err) {
      setOverallError(err instanceof Error ? err.message : 'Failed to update budget goal.');
    } finally {
      setOverallLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Budget</h1>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {summaryError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{summaryError}</AlertDescription>
        </Alert>
      )}

      {/* Overall budget card */}
      <div className="mb-6">
        <OverallBudgetCard
          summary={summary}
          currency={currency}
          onEditOverallGoal={handleOpenOverallDialog}
        />
      </div>

      {/* Category grid */}
      <h2 className="text-lg font-semibold mb-3">Category Budgets</h2>
      {summaryLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : (
        <CategoryBudgetGrid
          categories={summary?.categories ?? []}
          currency={currency}
          goalsMap={goalsMap}
          onSetGoal={handleSetGoal}
          onEditGoal={handleEditGoal}
        />
      )}

      {/* Category budget goal dialog */}
      <BudgetGoalDialog
        open={goalDialogOpen}
        onOpenChange={(open) => {
          setGoalDialogOpen(open);
          if (!open) { setEditingGoal(undefined); setPreselectedCategoryId(undefined); }
        }}
        onSubmit={handleGoalSubmit}
        categories={preselectedCategoryId
          ? categories.filter((c) => c.id === preselectedCategoryId || !existingGoalCategoryIds.includes(c.id))
          : categories}
        existingGoalCategoryIds={existingGoalCategoryIds}
        monthString={monthString}
        initialGoal={editingGoal}
      />

      {/* Overall budget goal dialog */}
      <Dialog open={overallDialogOpen} onOpenChange={setOverallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {profile?.monthly_budget_goal ? 'Edit Overall Monthly Budget' : 'Set Overall Monthly Budget'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            {overallError && (
              <Alert variant="destructive">
                <AlertDescription>{overallError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="overallAmount">Monthly Budget Goal</Label>
              <Input
                id="overallAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={overallAmount}
                onChange={(e) => setOverallAmount(e.target.value)}
                placeholder="e.g. 50000.00"
              />
              <p className="text-xs text-muted-foreground">Leave empty to remove the overall goal.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOverallDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveOverallGoal} disabled={overallLoading}>
                {overallLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
