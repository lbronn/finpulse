import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseFormData, ExpenseFilters } from '@/types';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async (filters?: ExpenseFilters) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('expenses')
        .select('*, categories(name, icon, color)')
        .order('expense_date', { ascending: false });

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.startDate) {
        query = query.gte('expense_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('expense_date', filters.endDate);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setExpenses(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const createExpense = async (formData: ExpenseFormData): Promise<Expense> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...formData, user_id: user.id })
      .select('*, categories(name, icon, color)')
      .single();

    if (error) throw error;
    setExpenses((prev) => [data, ...prev]);
    return data;
  };

  const updateExpense = async (id: string, formData: Partial<ExpenseFormData>): Promise<Expense> => {
    const { data, error } = await supabase
      .from('expenses')
      .update(formData)
      .eq('id', id)
      .select('*, categories(name, icon, color)')
      .single();

    if (error) throw error;
    setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  };

  const deleteExpense = async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}
