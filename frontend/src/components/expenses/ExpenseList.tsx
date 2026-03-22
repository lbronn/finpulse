import { useState } from 'react';
import { Pencil, Receipt, Trash2 } from 'lucide-react';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Expense } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  expenses: Expense[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => Promise<void>;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function ExpenseList({ expenses, loading, onEdit, onDelete }: Props) {
  const { profile } = useAuthStore();
  const currency = profile?.currency ?? 'PHP';
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <Receipt className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No expenses yet</p>
          <p className="text-sm text-muted-foreground">Add your first expense to start tracking</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {expenses.map((expense) => (
          <SwipeableRow key={expense.id} onDelete={() => setDeleteTarget(expense.id)}>
            <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{expense.description}</span>
                  {expense.categories && (
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: expense.categories.color ?? undefined, color: '#fff' }}
                    >
                      {expense.categories.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                  <span>{formatDate(expense.expense_date)}</span>
                  {expense.notes && <span className="truncate">· {expense.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold">{formatCurrency(expense.amount, currency)}</span>
                <Button variant="ghost" size="icon" onClick={() => onEdit(expense)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(expense.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
            </Card>
          </SwipeableRow>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
