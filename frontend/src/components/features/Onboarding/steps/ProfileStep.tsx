import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface ProfileStepProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD'];

export default function ProfileStep({ onNext, onSkip, onBack }: ProfileStepProps) {
  const { user, profile, setProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'PHP');
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    if (!user) return;
    setSaving(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, display_name: displayName, currency })
        .select()
        .single();
      if (data) setProfile(data);
    } finally {
      setSaving(false);
      onNext();
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Your Profile</h2>
        <p className="text-muted-foreground text-sm">Tell us a little about yourself.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleNext} disabled={saving}>
          {saving ? 'Saving...' : 'Continue'}
        </Button>
        <div className="flex justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
            Back
          </button>
          <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
