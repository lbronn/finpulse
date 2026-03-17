import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Plus, Eye } from 'lucide-react';
import { formatCurrency, getBudgetProgressColor } from '@/lib/formatters';
import type { BudgetCategorySummary, BudgetGoalWithCategory } from '@/types';

interface Props {
  categories: BudgetCategorySummary[];
  currency: string;
  goalsMap: Record<string, BudgetGoalWithCategory>; // keyed by category_id
  onSetGoal: (categoryId: string) => void;
  onEditGoal: (goal: BudgetGoalWithCategory) => void;
}

export default function CategoryBudgetGrid({
  categories,
  currency,
  goalsMap,
  onSetGoal,
  onEditGoal,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  // Hide categories with no goal AND no spending unless showAll is true
  const visibleCategories = showAll
    ? categories
    : categories.filter((c) => c.goal !== null || c.spent > 0);

  const hiddenCount = categories.length - visibleCategories.length;

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No expense data for this month.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleCategories.map((cat) => {
          const progressColor = getBudgetProgressColor(cat.percentage);
          const progressWidth = cat.percentage !== null ? Math.min(cat.percentage, 100) : 0;
          const goal = goalsMap[cat.category_id];

          return (
            <Card key={cat.category_id}>
              <CardContent className="p-4 flex flex-col gap-3">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {cat.color && (
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="font-medium text-sm truncate">{cat.category_name}</span>
                  </div>

                  {cat.percentage !== null && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs"
                      style={{ backgroundColor: progressColor + '22', color: progressColor }}
                    >
                      {cat.percentage}%
                    </Badge>
                  )}
                </div>

                {/* Spent / Goal display */}
                <div className="text-sm">
                  <span className="font-semibold">{formatCurrency(cat.spent, currency)}</span>
                  {cat.goal !== null && (
                    <span className="text-muted-foreground">
                      {' '}/ {formatCurrency(cat.goal, currency)}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: cat.goal !== null ? `${progressWidth}%` : '0%',
                      backgroundColor: cat.goal !== null ? progressColor : '#94a3b8',
                    }}
                  />
                </div>

                {/* Remaining / Action */}
                <div className="flex items-center justify-between gap-1">
                  {cat.goal !== null && cat.remaining !== null ? (
                    <span className="text-xs text-muted-foreground">
                      {cat.remaining >= 0
                        ? `${formatCurrency(cat.remaining, currency)} left`
                        : `${formatCurrency(Math.abs(cat.remaining), currency)} over`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No goal set</span>
                  )}

                  {goal ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onEditGoal(goal)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onSetGoal(cat.category_id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Set goal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!showAll && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          <Eye className="h-4 w-4 mr-1.5" />
          Show {hiddenCount} more {hiddenCount === 1 ? 'category' : 'categories'} with no activity
        </Button>
      )}
      {showAll && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={() => setShowAll(false)}
        >
          Hide inactive categories
        </Button>
      )}
    </div>
  );
}
