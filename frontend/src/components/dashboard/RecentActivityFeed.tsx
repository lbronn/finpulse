import { useNavigate } from 'react-router-dom';
import { Receipt, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Expense, JournalEntry } from '@/types';

type ActivityItem =
  | { type: 'expense'; date: string; data: Expense }
  | { type: 'journal'; date: string; data: JournalEntry };

interface Props {
  expenses: Expense[];
  journalEntries: JournalEntry[];
  currency: string;
}

export default function RecentActivityFeed({ expenses, journalEntries, currency }: Props) {
  const navigate = useNavigate();

  // Interleave last 5 expenses + last 3 journal entries, sorted by date desc
  const items: ActivityItem[] = [
    ...expenses.slice(0, 5).map((e): ActivityItem => ({
      type: 'expense',
      date: e.expense_date,
      data: e,
    })),
    ...journalEntries.slice(0, 3).map((j): ActivityItem => ({
      type: 'journal',
      date: j.entry_date,
      data: j,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No activity yet.</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={`${item.type}-${item.data.id}`} className="flex items-start gap-3 px-6 py-3">
                {item.type === 'expense' ? (
                  <>
                    <div className="mt-0.5 rounded-full bg-blue-100 p-1.5 shrink-0">
                      <Receipt className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.data.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.date, { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.data.categories && (
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: item.data.categories.color ?? undefined,
                            color: '#fff',
                          }}
                        >
                          {item.data.categories.name}
                        </Badge>
                      )}
                      <span className="text-sm font-medium">
                        {formatCurrency(item.data.amount, currency)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-0.5 rounded-full bg-green-100 p-1.5 shrink-0">
                      <BookOpen className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.data.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.date, { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => navigate('/journal')}
                    >
                      View
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
