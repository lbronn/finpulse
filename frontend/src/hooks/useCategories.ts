import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (fetchError) throw fetchError;
      setCategories(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  return { categories, loading, error, refetch: fetchCategories };
}
