import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Expense, ExpenseFormData, Category } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  categories: Category[];
  initialData?: Expense;
}

const today = new Date().toISOString().split('T')[0];

export default function ExpenseForm({ open, onOpenChange, onSubmit, categories, initialData }: Props) {
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
          <DialogTitle>{initialData ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
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
              type="number"
              step="0.01"
              min="0.01"
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
                <SelectValue placeholder="Select a category">
                  {categories.find((c) => c.id === categoryId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : initialData ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
