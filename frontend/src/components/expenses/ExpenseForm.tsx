import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Expense, ExpenseFormData, Category } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  categories: Category[];
  /** Accept either a full Expense (edit mode) or a partial ExpenseFormData (prefill from QuickCapture) */
  initialData?: Expense | ExpenseFormData;
  /** Recent expenses used to sort "most used" categories to the top */
  recentExpenses?: Expense[];
}

const today = new Date().toISOString().split('T')[0];

/** Renders a category option with its color swatch and name. */
function CategoryOption({ category }: { category: Category }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: category.color ?? '#888' }}
      />
      {category.name}
    </span>
  );
}

export default function ExpenseForm({
  open,
  onOpenChange,
  onSubmit,
  categories,
  initialData,
  recentExpenses = [],
}: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setAmount(String(initialData.amount));
      setDescription(initialData.description);
      setCategoryId(initialData.category_id);
      setExpenseDate(initialData.expense_date);
      setNotes(initialData.notes ?? '');
    } else {
      setAmount('');
      setDescription('');
      setCategoryId('');
      setExpenseDate(today);
      setNotes('');
    }
    setError(null);
  }, [initialData, open]);

  // Build ordered categories: most-used first, then remaining alphabetically
  const { topCategories, otherCategories } = useMemo(() => {
    const countMap: Record<string, number> = {};
    for (const e of recentExpenses) {
      countMap[e.category_id] = (countMap[e.category_id] ?? 0) + 1;
    }

    const sorted = [...categories].sort(
      (a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0),
    );

    const TOP_N = 3;
    const top = sorted.slice(0, TOP_N).filter((c) => (countMap[c.id] ?? 0) > 0);
    const topIds = new Set(top.map((c) => c.id));
    const rest = categories.filter((c) => !topIds.has(c.id));

    return { topCategories: top, otherCategories: rest };
  }, [categories, recentExpenses]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleSubmit = async () => {
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }
    if (!expenseDate) {
      setError('Date is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        amount: amountNum,
        description: description.trim(),
        category_id: categoryId,
        expense_date: expenseDate,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData && 'id' in initialData ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              type="text"
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this expense for?"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category *</Label>
            <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? '')}>
              <SelectTrigger id="category">
                {selectedCategory
                  ? <CategoryOption category={selectedCategory} />
                  : <span className="text-muted-foreground">Select a category</span>}
              </SelectTrigger>
              <SelectContent>
                {topCategories.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                      Most used
                    </div>
                    {topCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <CategoryOption category={c} />
                      </SelectItem>
                    ))}
                    <Separator className="my-1" />
                  </>
                )}
                {otherCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryOption category={c} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expenseDate">Date *</Label>
            <Input
              id="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" className="min-h-[44px]" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : (initialData && 'id' in initialData) ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
