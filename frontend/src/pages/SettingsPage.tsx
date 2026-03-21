import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { TokenUsageSummary } from '@/types';

function AiUsageSection() {
  const [usage, setUsage] = useState<TokenUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<TokenUsageSummary>('/analysis/token-usage')
      .then(setUsage)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">AI Usage (This Month)</h3>
      {loading ? (
        <div className="animate-pulse h-16 rounded-lg bg-muted" />
      ) : error ? (
        <p className="text-sm text-red-600">Failed to load AI usage data.</p>
      ) : usage ? (
        <div className="grid grid-cols-3 gap-3">
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
        <p className="text-sm text-muted-foreground">No AI usage data yet this month.</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AiUsageSection />
      <p className="text-muted-foreground text-sm">More settings coming in Phase 4.</p>
    </div>
  );
}
