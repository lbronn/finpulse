import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ user: session?.user ?? null, loading: false });

    if (session?.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      set({ profile: profile ?? null });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      set({ user: currentUser });

      if (currentUser) {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (existingProfile) {
          set({ profile: existingProfile });
        } else if (_event === 'SIGNED_IN') {
          // User just confirmed email — create profile with stored display name
          const pendingName = localStorage.getItem('finpulse_pending_display_name');
          if (pendingName) {
            const { data: newProfile } = await supabase
              .from('user_profiles')
              .insert({ id: currentUser.id, display_name: pendingName })
              .select()
              .single();
            localStorage.removeItem('finpulse_pending_display_name');
            set({ profile: newProfile ?? null });
          } else {
            set({ profile: null });
          }
        } else {
          set({ profile: null });
        }
      } else {
        set({ profile: null });
      }
    });
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, profile: null });
  },

  setProfile: (profile: UserProfile) => set({ profile }),
}));
