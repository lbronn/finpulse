import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { exportExpensesToCSV } from '@/lib/export';
import { api } from '@/lib/api';
import type { TokenUsageSummary } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, LogOut, User, Wallet, Bot } from 'lucide-react';

// ── Currency options ──────────────────────────────────────────────────────────
const CURRENCY_OPTIONS = [
  { value: 'PHP', label: 'PHP — Philippine Peso' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
];

// ── Profile Section ───────────────────────────────────────────────────────────
function ProfileSection() {
  const { profile, setProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'PHP');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName.trim(), currency })
        .eq('id', user.id)
        .select()
        .single();

      if (dbError) throw dbError;
      setProfile(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>Profile updated successfully.</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Budget Goal Section ───────────────────────────────────────────────────────
function BudgetGoalSection() {
  const { profile, setProfile } = useAuthStore();
  const [amount, setAmount] = useState(
    profile?.monthly_budget_goal ? String(profile.monthly_budget_goal) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    let num: number | null = null;
    if (amount) {
      num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        setError('Amount must be a positive number.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .update({ monthly_budget_goal: num })
        .eq('id', user.id)
        .select()
        .single();

      if (dbError) throw dbError;
      setProfile(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Monthly Budget Goal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>Budget goal updated.</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="budget-goal">Overall Monthly Budget</Label>
          <Input
            id="budget-goal"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50000.00"
          />
          <p className="text-xs text-muted-foreground">Leave empty to remove the goal.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
          {saving ? 'Saving...' : 'Save Goal'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── AI Usage Section ──────────────────────────────────────────────────────────
function AiUsageSection() {
  const [usage, setUsage] = useState<TokenUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<TokenUsageSummary>('/analysis/token-usage')
      .then((data) => { if (!cancelled) setUsage(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          AI Usage (This Month)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load AI usage data.</p>
        ) : usage ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{usage.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Tokens Used</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">{usage.analysis_count}</p>
              <p className="text-xs text-muted-foreground">Analyses Run</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold">${usage.estimated_cost_usd.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground">Est. Cost (USD)</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No AI usage this month.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Data Section ──────────────────────────────────────────────────────────────
// Fetches directly from Supabase to avoid stale closure issues with the hook pattern.
function DataSection() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Your session has expired. Please sign in again.');

      const { data, error } = await supabase
        .from('expenses')
        .select('*, categories(name, icon, color)')
        .eq('user_id', userId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      exportExpensesToCSV(data ?? []);
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4" />
          Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Export all your expense data as a CSV file.
        </p>
        {exportError && (
          <Alert variant="destructive">
            <AlertDescription>{exportError}</AlertDescription>
          </Alert>
        )}
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="min-h-[44px]">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export Expenses to CSV'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Account Section ───────────────────────────────────────────────────────────
function AccountSection() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out failed', err);
      setError('Sign out failed. Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LogOut className="h-4 w-4" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          variant="destructive"
          onClick={handleSignOut}
          disabled={signingOut}
          className="min-h-[44px]"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Page Root ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
      </div>
      <ProfileSection />
      <BudgetGoalSection />
      <AiUsageSection />
      <DataSection />
      <AccountSection />
    </div>
  );
}
