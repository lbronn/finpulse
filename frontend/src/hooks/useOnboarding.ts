// Summary: Checks onboarding status for the current user. Creates an
// onboarding_progress record for new users (none exists). Returns
// isComplete state and markComplete / markSkipped functions.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function useOnboarding() {
  const { user } = useAuthStore();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function checkOnboarding() {
      try {
        const { data } = await supabase
          .from('onboarding_progress')
          .select('completed_at, skipped')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!data) {
          // New user — create record and show onboarding
          await supabase.from('onboarding_progress').insert({
            user_id: user!.id,
            step: 'welcome',
          });
          setIsComplete(false);
        } else if (data.completed_at || data.skipped) {
          setIsComplete(true);
        } else {
          setIsComplete(false);
        }
      } catch (err) {
        console.error('[useOnboarding] Failed to check onboarding status:', err);
        setIsComplete(true); // Fail open — don't block the user
      } finally {
        setLoading(false);
      }
    }

    checkOnboarding();
  }, [user]);

  async function markComplete() {
    if (!user) return;
    try {
      await supabase
        .from('onboarding_progress')
        .update({ completed_at: new Date().toISOString(), step: 'done' })
        .eq('user_id', user.id);
    } catch (err) {
      console.error('[useOnboarding] Failed to mark onboarding complete:', err);
    }
    setIsComplete(true); // Always unblock the user, even if save failed
  }

  async function markSkipped() {
    if (!user) return;
    try {
      await supabase
        .from('onboarding_progress')
        .update({ skipped: true, step: 'skipped' })
        .eq('user_id', user.id);
    } catch (err) {
      console.error('[useOnboarding] Failed to mark onboarding skipped:', err);
    }
    setIsComplete(true); // Always unblock the user, even if save failed
  }

  return { isComplete, loading, markComplete, markSkipped };
}
