/**
 * Summary: A pull-to-refresh wrapper that detects downward touch drag at the
 * top of a scroll container and triggers onRefresh(). Shows a spinner during refresh.
 *
 * Props:
 *   children  — Scrollable content
 *   onRefresh — Async callback; spinner shows until it resolves
 *   className — Optional additional CSS classes
 */
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

const PULL_THRESHOLD = 60; // px to trigger refresh

export function PullToRefresh({ children, onRefresh, className }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only activate pull-to-refresh when scrolled to the top
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      // Dampen the pull distance for a natural feel
      setPullDistance(Math.min(delta * 0.4, PULL_THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
    touchStartY.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className ?? ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-150"
          style={{ height: refreshing ? 48 : pullDistance }}
        >
          <Loader2
            className={`h-5 w-5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: refreshing ? 1 : pullDistance / PULL_THRESHOLD }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
