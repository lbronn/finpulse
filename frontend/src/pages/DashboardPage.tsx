import { useState, useEffect } from 'react';
import { Plus, Receipt, BookOpen, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SummaryCard from '@/components/dashboard/SummaryCard';
import RecentExpenses from '@/components/dashboard/RecentExpenses';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { useAuthStore } from '@/stores/authStore';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/lib/supabase';
import type { ExpenseFormData } from '@/types';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { expenses, fetchExpenses, createExpense } = useExpenses();
  const { categories } = useCategories();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [journalCount, setJournalCount] = useState(0);

  const currency = profile?.currency ?? 'PHP';

  // Compute this month's date range
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  useEffect(() => {
    fetchExpenses({ startDate, endDate: today });

    supabase
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setJournalCount(count ?? 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const formattedTotal = new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(totalSpent);
  const recentExpenses = expenses.slice(0, 5);

  const handleAddExpense = async (data: ExpenseFormData): Promise<void> => {
    await createExpense(data);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile?.display_name ?? '...'}</h1>
          <p className="text-muted-foreground text-sm">Here's your financial snapshot</p>
        </div>
        <Button onClick={() => setAddExpenseOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add expense
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Spent This Month"
          value={formattedTotal}
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
          value={journalCount}
          description="Total entries"
          icon={BookOpen}
        />
      </div>

      <RecentExpenses expenses={recentExpenses} />

      <ExpenseForm
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onSubmit={handleAddExpense}
        categories={categories}
      />
    </div>
  );
}
