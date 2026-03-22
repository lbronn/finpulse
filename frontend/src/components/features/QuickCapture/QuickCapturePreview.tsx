/**
 * Summary: The confirmation card that slides up after NLP parsing.
 * Shows parsed expense data (amount, description, category, date) with inline editing.
 * User can Save (direct create) or Edit (open full form). Dismissable.
 *
 * Props:
 *   parsed       — The parsed expense data from the API
 *   categories   — For the category dropdown
 *   onSave       — Called with the (possibly edited) parsed data on Save
 *   onEdit       — Called when user clicks Edit — opens full form with pre-filled data
 *   onDismiss    — Called to close/reset the preview
 *   saving       — True while save is in progress
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickCaptureCategory } from './QuickCaptureCategory';
import type { Category, ParsedExpense } from '@/types';

interface QuickCapturePreviewProps {
  parsed: ParsedExpense;
  categories: Category[];
  onSave: (data: ParsedExpense) => Promise<void>;
  onEdit: (data: ParsedExpense) => void;
  onDismiss: () => void;
  saving: boolean;
}

export function QuickCapturePreview({
  parsed,
  categories,
  onSave,
  onEdit,
  onDismiss,
  saving,
}: QuickCapturePreviewProps) {
  const [amount, setAmount] = useState(parsed.amount?.toString() ?? '');
  const [description, setDescription] = useState(parsed.description);
  const [categoryId, setCategoryId] = useState(parsed.category_id);
  const [categoryName, setCategoryName] = useState(parsed.category_name);
  const [expenseDate, setExpenseDate] = useState(parsed.expense_date);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  const handleCategoryChange = (id: string, name: string) => {
    setCategoryId(id);
    setCategoryName(name);
  };

  const buildData = (): ParsedExpense => ({
    ...parsed,
    amount: amount ? parseFloat(amount) : null,
    description,
    category_id: categoryId,
    category_name: categoryName,
    expense_date: expenseDate,
  });

  const handleSave = async () => {
    await onSave(buildData());
  };

  const handleEdit = () => {
    onEdit(buildData());
  };

  return (
    <div className="rounded-xl border bg-card shadow-md p-4 animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Confirm expense
        </span>
        <button
          onClick={onDismiss}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Amount */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1">Amount</label>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-bold w-full bg-transparent outline-none border-b border-transparent focus:border-primary transition-colors"
          aria-label="Amount"
        />
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm w-full bg-transparent outline-none border-b border-transparent focus:border-primary transition-colors"
          aria-label="Description"
        />
      </div>

      {/* Category + Date row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <QuickCaptureCategory
          categories={categories}
          selectedId={categoryId}
          selectedName={categoryName}
          selectedColor={selectedCategory?.color ?? null}
          onChange={handleCategoryChange}
        />
        <input
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          className="text-xs text-muted-foreground bg-transparent outline-none border-b border-transparent focus:border-primary transition-colors min-h-[32px]"
          aria-label="Expense date"
        />
      </div>

      {/* Confidence badge */}
      {parsed.confidence === 'low' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
          Low confidence parse — please review the details above.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          className="flex-1 min-h-[44px]"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={handleEdit}
          disabled={saving}
          className="min-h-[44px]"
        >
          Edit
        </Button>
      </div>
    </div>
  );
}
