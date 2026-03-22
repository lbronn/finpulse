import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import type { WeeklyDigestResponse, WeeklyDigest, DigestMood } from '@/types';

const MOOD_BORDER: Record<DigestMood, string> = {
  on_track: 'border-t-green-500',
  great_week: 'border-t-teal-500',
  needs_attention: 'border-t-amber-500',
  over_budget: 'border-t-red-500',
};

const MOOD_BADGE: Record<DigestMood, string> = {
  on_track: 'bg-green-100 text-green-800',
  great_week: 'bg-teal-100 text-teal-800',
  needs_attention: 'bg-amber-100 text-amber-800',
  over_budget: 'bg-red-100 text-red-800',
};

const MOOD_LABEL: Record<DigestMood, string> = {
  on_track: 'On track',
  great_week: 'Great week',
  needs_attention: 'Needs attention',
  over_budget: 'Over budget',
};

function getDismissKey(generatedAt: string): string {
  return `digest_dismissed:${generatedAt.slice(0, 10)}`;
}

export function WeeklyDigestCard() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<WeeklyDigestResponse>('/analysis/digest/latest')
      .then((data) => {
        if (data.digest && data.generated_at) {
          const key = getDismissKey(data.generated_at);
          if (localStorage.getItem(key)) {
            setDismissed(true);
          } else {
            setDigest(data.digest);
            setGeneratedAt(data.generated_at);
          }
        }
      })
      .catch(() => {/* non-critical, silently fail */});
  }, []);

  function handleDismiss() {
    if (generatedAt) {
      localStorage.setItem(getDismissKey(generatedAt), '1');
    }
    setDismissed(true);
  }

  if (!digest || dismissed) return null;

  const borderColor = MOOD_BORDER[digest.mood] ?? MOOD_BORDER.on_track;
  const badgeColor = MOOD_BADGE[digest.mood] ?? MOOD_BADGE.on_track;
  const moodLabel = MOOD_LABEL[digest.mood] ?? digest.mood;

  return (
    <div
      className={`relative rounded-xl border border-border border-t-4 ${borderColor} bg-card p-4 shadow-sm`}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss digest"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="space-y-3 pr-6">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Weekly digest
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
            {moodLabel}
          </span>
        </div>

        {/* Headline */}
        <p className="font-semibold text-sm leading-snug">{digest.headline}</p>

        {/* Key stat badge */}
        <div className="inline-flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
          <span className="text-xs text-muted-foreground">{digest.key_stat.label}</span>
          <span className="text-sm font-semibold">{digest.key_stat.value}</span>
          <span className="text-xs text-muted-foreground">{digest.key_stat.detail}</span>
        </div>

        {/* Body */}
        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {digest.body}
        </p>
      </div>
    </div>
  );
}
