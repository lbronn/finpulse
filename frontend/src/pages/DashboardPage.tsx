import { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import MonthlySpendingChart from '@/components/dashboard/MonthlySpendingChart';
import CategoryBreakdownChart from '@/components/dashboard/CategoryBreakdownChart';
import BudgetStatusStrip from '@/components/dashboard/BudgetStatusStrip';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { QuickCapture } from '@/components/features/QuickCapture/QuickCapture';
import { WeeklyDigestCard } from '@/components/features/WeeklyDigestCard';
import { useAuthStore } from '@/stores/authStore';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import type {
  BudgetSummaryResponse,
  ExpenseTrendsResponse,
  ExpenseBreakdownResponse,
  ExpenseFormData,
} from '@/types';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { expenses, fetchExpenses, createExpense } = useExpenses();
  const { categories } = useCategories();

  const currency = profile?.currency ?? 'PHP';

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const monthParam = today.slice(0, 7);

  // Days left in month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();

  const [trendsData, setTrendsData] = useState<ExpenseTrendsResponse | null>(null);
  const [breakdownData, setBreakdownData] = useState<ExpenseBreakdownResponse | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState<string | null>(null);

  // ExpenseForm state for "Edit" flow from QuickCapture
  const [formOpen, setFormOpen] = useState(false);
  const [formPrefill, setFormPrefill] = useState<ExpenseFormData | undefined>(undefined);

  const fetchDashboardData = useCallback(async () => {
    setChartsLoading(true);
    setChartsError(null);
    try {
      const [trends, breakdown, budget] = await Promise.all([
        api.get<ExpenseTrendsResponse>('/expenses/trends?months=6'),
        api.get<ExpenseBreakdownResponse>(`/expenses/breakdown?start_date=${startDate}&end_date=${today}`),
        api.get<BudgetSummaryResponse>(`/budgets/summary?month=${monthParam}`),
      ]);
      setTrendsData(trends);
      setBreakdownData(breakdown);
      setBudgetSummary(budget);
    } catch (err) {
      setChartsError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setChartsLoading(false);
    }
  }, [startDate, today, monthParam]);

  useEffect(() => {
    fetchExpenses({ startDate, endDate: today });
    fetchDashboardData();
  }, [fetchExpenses, fetchDashboardData, startDate, today]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchExpenses({ startDate, endDate: today }),
      fetchDashboardData(),
    ]);
  }, [fetchExpenses, fetchDashboardData, startDate, today]);

  const handleEditFull = (prefill: ExpenseFormData) => {
    setFormPrefill(prefill);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: ExpenseFormData) => {
    await createExpense(data);
    await refreshAll();
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetGoal = budgetSummary?.overall.goal ?? profile?.monthly_budget_goal ?? null;
  const budgetRemaining = budgetGoal != null ? budgetGoal - totalSpent : null;

  // Last 5 expenses for recent list
  const recentExpenses = expenses.slice(0, 5);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {profile?.display_name ?? '...'}
        </h1>
        <p className="text-muted-foreground text-sm">{formatDate(now)}</p>
      </div>

      {/* Weekly Digest Card — above monthly summary */}
      <div className="mb-5">
        <WeeklyDigestCard />
      </div>

      {/* Monthly summary strip */}
      <div className="flex items-center gap-4 mb-5 flex-wrap text-sm">
        {chartsLoading ? (
          <>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
          </>
        ) : (
          <>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Spent</span>
              <span className="font-semibold">{formatCurrency(totalSpent, currency)}</span>
            </div>
            {budgetRemaining !== null && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Remaining</span>
                <span className={`font-semibold ${budgetRemaining < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(Math.abs(budgetRemaining), currency)}
                  {budgetRemaining < 0 && ' over'}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Days left</span>
              <span className="font-semibold">{daysLeft}d</span>
            </div>
          </>
        )}
      </div>

      {chartsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{chartsError}</AlertDescription>
        </Alert>
      )}

      {/* Quick Capture */}
      <div className="mb-6">
        <QuickCapture
          categories={categories}
          onSaved={refreshAll}
          onEditFull={handleEditFull}
        />
      </div>

      {/* Recent expenses */}
      {recentExpenses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recent
          </h2>
          <div className="flex flex-col gap-1">
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {expense.categories && (
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: expense.categories.color ?? undefined, color: '#fff' }}
                      className="text-xs shrink-0"
                    >
                      {expense.categories.name}
                    </Badge>
                  )}
                  <span className="text-sm truncate">{expense.description}</span>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-2">
                  {formatCurrency(expense.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget status strip */}
      <div className="mb-6">
        <BudgetStatusStrip summary={budgetSummary} loading={chartsLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <MonthlySpendingChart data={trendsData} currency={currency} loading={chartsLoading} />
        <CategoryBreakdownChart data={breakdownData} currency={currency} loading={chartsLoading} />
      </div>

      {/* Full expense form (for "Edit" from QuickCapture) */}
      <ExpenseForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormPrefill(undefined);
        }}
        onSubmit={handleFormSubmit}
        categories={categories}
        initialData={formPrefill}
        recentExpenses={expenses}
      />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
}
