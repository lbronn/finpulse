import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBudgetProgressColor } from '@/lib/formatters';
import type { BudgetSummaryResponse } from '@/types';

interface Props {
  summary: BudgetSummaryResponse | null;
  loading: boolean;
}

export default function BudgetStatusStrip({ summary, loading }: Props) {
  const navigate = useNavigate();

  // Only show categories that have a goal set
  const categoriesWithGoals = summary?.categories.filter((c) => c.goal !== null) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Budget Status</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/budget')}>
          View all
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : categoriesWithGoals.length === 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No budget goals set yet.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/budget')}>
              Set goals
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categoriesWithGoals.map((cat) => {
              const color = getBudgetProgressColor(cat.percentage);
              return (
                <button
                  key={cat.category_id}
                  onClick={() => navigate('/budget')}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{cat.category_name}</span>
                  {cat.percentage !== null && (
                    <span style={{ color }} className="tabular-nums">
                      {cat.percentage}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
