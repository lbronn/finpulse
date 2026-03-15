import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { JournalEntry, JournalEntryFormData } from '@/types';

export function useJournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (tagFilter?: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });

      if (tagFilter) {
        query = query.contains('tags', [tagFilter]);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setEntries(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, []);

  const createEntry = async (formData: JournalEntryFormData): Promise<JournalEntry> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({ ...formData, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    setEntries((prev) => [data, ...prev]);
    return data;
  };

  const updateEntry = async (id: string, formData: Partial<JournalEntryFormData>): Promise<JournalEntry> => {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  };

  const deleteEntry = async (id: string): Promise<void> => {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id);
    if (error) throw error;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return { entries, loading, error, fetchEntries, createEntry, updateEntry, deleteEntry };
}
