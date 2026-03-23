import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { BudgetGoalFormData, BudgetGoalWithCategory, Category } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BudgetGoalFormData) => Promise<void>;
  /** All categories available to the user */
  categories: Category[];
  /** Category IDs that already have a goal for this month (excluded from the new-goal selector) */
  existingGoalCategoryIds: string[];
  /** Month as 'YYYY-MM-DD' (first day of month) — locked, not editable */
  monthString: string;
  /** Provide when editing an existing goal */
  initialGoal?: BudgetGoalWithCategory;
}

export default function BudgetGoalDialog({
  open,
  onOpenChange,
  onSubmit,
  categories,
  existingGoalCategoryIds,
  monthString,
  initialGoal,
}: Props) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available categories: exclude those that already have a goal (except the one being edited)
  const availableCategories = initialGoal
    ? categories.filter((c) => c.id === initialGoal.category_id)
    : categories.filter((c) => !existingGoalCategoryIds.includes(c.id));

  useEffect(() => {
    if (initialGoal) {
      setCategoryId(initialGoal.category_id);
      setAmount(String(initialGoal.amount));
    } else {
      setCategoryId('');
      setAmount('');
    }
    setError(null);
  }, [initialGoal, open]);

  const handleSubmit = async () => {
    setError(null);

    if (!categoryId) {
      setError('Please select a category.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ category_id: categoryId, amount: amountNum, month: monthString });
      toast.success('Budget goal saved!');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget goal.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialGoal ? 'Edit Budget Goal' : 'Set Budget Goal'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={categoryId}
              onValueChange={(val) => setCategoryId(val ?? '')}
              disabled={!!initialGoal}
            >
              <SelectTrigger id="category">
                {selectedCategory ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: selectedCategory.color ?? '#888' }}
                    />
                    {selectedCategory.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select a category</span>
                )}
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? '#888' }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
                {availableCategories.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    All categories already have goals for this month.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Monthly Limit *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : initialGoal ? 'Save changes' : 'Set goal'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
