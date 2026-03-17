import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { formatCurrency, getBudgetProgressColor } from '@/lib/formatters';
import type { BudgetSummaryResponse } from '@/types';

interface Props {
  summary: BudgetSummaryResponse | null;
  currency: string;
  onEditOverallGoal: () => void;
}

export default function OverallBudgetCard({ summary, currency, onEditOverallGoal }: Props) {
  const overall = summary?.overall;
  const spent = overall?.spent ?? 0;
  const goal = overall?.goal ?? null;
  const percentage = overall?.percentage ?? null;
  const remaining = overall?.remaining ?? null;
  const progressColor = getBudgetProgressColor(percentage);
  const progressWidth = percentage !== null ? Math.min(percentage, 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Monthly Budget Overview</CardTitle>
        <Button variant="ghost" size="sm" onClick={onEditOverallGoal}>
          <Pencil className="h-3.5 w-3.5 mr-1" />
          {goal ? 'Edit goal' : 'Set goal'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-3xl font-bold">{formatCurrency(spent, currency)}</p>
            <p className="text-sm text-muted-foreground">
              {goal
                ? `of ${formatCurrency(goal, currency)} budget`
                : 'No overall budget set'}
            </p>
          </div>
          {percentage !== null && (
            <p className="text-2xl font-semibold" style={{ color: progressColor }}>
              {percentage}%
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressWidth}%`, backgroundColor: progressColor }}
          />
        </div>

        {goal && remaining !== null && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {remaining >= 0
                ? `${formatCurrency(remaining, currency)} remaining`
                : `${formatCurrency(Math.abs(remaining), currency)} over budget`}
            </span>
            {percentage !== null && percentage > 90 && (
              <span className="text-destructive font-medium">
                {percentage > 100 ? 'Over budget!' : 'Near limit'}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
