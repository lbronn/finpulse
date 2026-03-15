import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Expense } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  expenses: Expense[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function RecentExpenses({ expenses }: Props) {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const currency = profile?.currency ?? 'PHP';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recent Expenses</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')}>View all</Button>
      </CardHeader>
      <CardContent className="p-0">
        {expenses.length === 0 ? (
          <p className="text-muted-foreground text-sm p-4">No expenses yet.</p>
        ) : (
          <ul className="divide-y">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{expense.description}</span>
                  {expense.categories && (
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: expense.categories.color ?? undefined, color: '#fff' }}
                      className="text-xs shrink-0"
                    >
                      {expense.categories.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(expense.expense_date)}</span>
                  <span className="text-sm font-medium">{formatCurrency(expense.amount, currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
