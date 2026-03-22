import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Receipt, BookOpen } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SummaryCard from '@/components/dashboard/SummaryCard';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import MonthlySpendingChart from '@/components/dashboard/MonthlySpendingChart';
import CategoryBreakdownChart from '@/components/dashboard/CategoryBreakdownChart';
import BudgetStatusStrip from '@/components/dashboard/BudgetStatusStrip';
import QuickAddExpense from '@/components/dashboard/QuickAddExpense';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import type { BudgetSummaryResponse, ExpenseTrendsResponse, ExpenseBreakdownResponse, ExpenseFormData } from '@/types';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { expenses, fetchExpenses, createExpense } = useExpenses();
  const { categories } = useCategories();
  const { entries: journalEntries, fetchEntries } = useJournalEntries();

  const currency = profile?.currency ?? 'PHP';

  // Current month date range
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const monthParam = today.slice(0, 7); // 'YYYY-MM'

  // Chart + budget data from Django
  const [trendsData, setTrendsData] = useState<ExpenseTrendsResponse | null>(null);
  const [breakdownData, setBreakdownData] = useState<ExpenseBreakdownResponse | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState<string | null>(null);

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
    fetchEntries();
    fetchDashboardData();
  }, [fetchExpenses, fetchEntries, fetchDashboardData, startDate, today]);

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleQuickAdd = async (data: ExpenseFormData): Promise<void> => {
    await createExpense(data);
    // Refresh dashboard data after adding an expense
    await Promise.all([
      fetchExpenses({ startDate, endDate: today }),
      fetchDashboardData(),
    ]);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome, {profile?.display_name ?? '...'}</h1>
        <p className="text-muted-foreground text-sm">Here's your financial snapshot</p>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {chartsLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <SummaryCard
              title="Spent This Month"
              value={formatCurrency(totalSpent, currency)}
              description={`${expenses.length} transactions`}
              icon={TrendingUp}
            />
            <SummaryCard
              title="Expenses"
              value={expenses.length}
              description="This month"
              icon={Receipt}
            />
            <SummaryCard
              title="Journal Entries"
              value={journalEntries.length}
              description="All time"
              icon={BookOpen}
            />
          </>
        )}
      </div>

      {chartsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{chartsError}</AlertDescription>
        </Alert>
      )}

      {/* Quick add expense */}
      <div className="mb-6">
        <QuickAddExpense categories={categories} onSubmit={handleQuickAdd} />
      </div>

      {/* Budget status strip */}
      <div className="mb-6">
        <BudgetStatusStrip summary={budgetSummary} loading={chartsLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <MonthlySpendingChart data={trendsData} currency={currency} loading={chartsLoading} />
        <CategoryBreakdownChart data={breakdownData} currency={currency} loading={chartsLoading} />
      </div>

      {/* Recent activity feed */}
      <RecentActivityFeed
        expenses={expenses}
        journalEntries={journalEntries}
        currency={currency}
      />
    </div>
  );
}
