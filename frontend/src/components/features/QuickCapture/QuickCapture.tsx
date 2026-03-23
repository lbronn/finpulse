/**
 * Summary: The main Quick Capture component — an NLP text input that parses expenses
 * and shows a confirmation card. Handles the full flow: parse → preview → save/edit.
 *
 * Props:
 *   categories    — For the category selector in the preview
 *   onSaved       — Called after a successful save (to refresh parent data)
 *   onEditFull    — Called with pre-filled data when user clicks "Edit" (opens full form)
 *   sticky        — If true, uses position:sticky bottom:0. Default false (inline).
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { hapticSuccess } from '@/utils/haptics';
import { QuickCaptureInput } from './QuickCaptureInput';
import { QuickCapturePreview } from './QuickCapturePreview';
import { Skeleton } from '@/components/ui/skeleton';
import type { Category, ParsedExpense, ExpenseFormData } from '@/types';

interface QuickCaptureProps {
  categories: Category[];
  onSaved: () => void;
  onEditFull: (prefill: ExpenseFormData) => void;
  sticky?: boolean;
}

type CaptureState = 'idle' | 'parsing' | 'preview' | 'saving';

export function QuickCapture({ categories, onSaved, onEditFull, sticky = false }: QuickCaptureProps) {
  const { profile } = useAuthStore();
  const [state, setState] = useState<CaptureState>('idle');
  const [parsed, setParsed] = useState<ParsedExpense | null>(null);
  const [inputKey, setInputKey] = useState(0); // force re-mount input to clear it

  const handleSubmit = useCallback(async (text: string) => {
    setState('parsing');
    try {
      const result = await api.post<ParsedExpense>('/expenses/parse', { text });

      // If no amount was extracted, show error and open full form
      if (!result.amount || result.amount <= 0) {
        toast.error("Couldn't parse the amount. Try: amount + description", {
          action: {
            label: 'Add manually',
            onClick: () => {
              onEditFull({
                amount: 0,
                description: result.description || text,
                category_id: result.category_id ?? '',
                expense_date: result.expense_date,
                notes: null,
              });
            },
          },
        });
        setState('idle');
        return;
      }

      setParsed(result);
      setState('preview');
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      toast.error(
        isNetworkError
          ? "Can't reach the server. Try again or add manually."
          : "Failed to parse expense. Try again.",
        isNetworkError
          ? {
              action: {
                label: 'Add manually',
                onClick: () => onEditFull({
                  amount: 0,
                  description: text,
                  category_id: '',
                  expense_date: new Date().toISOString().split('T')[0],
                  notes: null,
                }),
              },
            }
          : undefined
      );
      setState('idle');
    }
  }, [onEditFull]);

  const handleSave = useCallback(async (data: ParsedExpense) => {
    if (!profile?.id) return;
    setState('saving');

    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: profile.id,
        amount: data.amount,
        description: data.description,
        category_id: data.category_id,
        expense_date: data.expense_date,
        notes: null,
      });

      if (error) throw error;

      // Record categorization pattern for future learning (fire-and-forget)
      if (data.description && data.category_id) {
        api.post('/expenses/confirm-category', {
          description: data.description,
          category_id: data.category_id,
        }).catch(() => {
          // Non-critical — don't surface this error to the user
        });
      }

      hapticSuccess();
      toast.success('Expense saved');
      setParsed(null);
      setInputKey((k) => k + 1); // reset input
      setState('idle');
      onSaved();
    } catch (err) {
      toast.error('Failed to save expense. Please try again.');
      setState('preview');
    }
  }, [profile, onSaved]);

  const handleEdit = useCallback((data: ParsedExpense) => {
    onEditFull({
      amount: data.amount ?? 0,
      description: data.description,
      category_id: data.category_id ?? '',
      expense_date: data.expense_date,
      notes: null,
    });
    setParsed(null);
    setInputKey((k) => k + 1);
    setState('idle');
  }, [onEditFull]);

  const handleDismiss = () => {
    setParsed(null);
    setState('idle');
  };

  return (
    <div
      className={`flex flex-col gap-2 bg-background ${sticky ? 'sticky bottom-0 z-40 pt-2 pb-safe border-t' : ''}`}
    >
      {/* Skeleton while parsing */}
      {state === 'parsing' && (
        <div className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}

      {/* Preview card */}
      {(state === 'preview' || state === 'saving') && parsed && (
        <QuickCapturePreview
          parsed={parsed}
          categories={categories}
          onSave={handleSave}
          onEdit={handleEdit}
          onDismiss={handleDismiss}
          saving={state === 'saving'}
        />
      )}

      {/* Input bar */}
      <QuickCaptureInput
        key={inputKey}
        onSubmit={handleSubmit}
        loading={state === 'parsing' || state === 'saving'}
      />
    </div>
  );
}
