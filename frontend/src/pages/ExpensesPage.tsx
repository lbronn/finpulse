import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import ExpenseFilters from '@/components/expenses/ExpenseFilters';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import type { Expense, ExpenseFilters as Filters } from '@/types';

export default function ExpensesPage() {
  const { expenses, loading, error, fetchExpenses, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { categories } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | undefined>(undefined);
  const [activeFilters, setActiveFilters] = useState<Filters>({});

  useEffect(() => {
    fetchExpenses(activeFilters);
  }, [fetchExpenses, activeFilters]);

  const handleEdit = (expense: Expense) => {
    setEditTarget(expense);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditTarget(undefined);
  };

  const handleSubmit = async (data: Parameters<typeof createExpense>[0]) => {
    if (editTarget) {
      await updateExpense(editTarget.id, data);
    } else {
      await createExpense(data);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add expense
        </Button>
      </div>

      <div className="mb-4">
        <ExpenseFilters
          categories={categories}
          onFiltersChange={(filters) => setActiveFilters(filters)}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ExpenseList
        expenses={expenses}
        loading={loading}
        onEdit={handleEdit}
        onDelete={deleteExpense}
      />

      <ExpenseForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSubmit={handleSubmit}
        categories={categories}
        initialData={editTarget}
        recentExpenses={expenses}
      />
    </div>
  );
}
