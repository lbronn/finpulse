/**
 * Summary: A swipeable row wrapper that reveals a delete button on left swipe.
 * Uses @use-gesture/react for gesture detection. Only allows left swipe (negative x).
 * Vertical scrolling is preserved via touchAction: 'pan-y'.
 *
 * Props:
 *   children — The row content to render
 *   onDelete — Callback fired when the revealed Delete button is tapped
 */
import { useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { hapticMedium } from '@/utils/haptics';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const deleteThreshold = -80; // pixels to reveal delete button

  const bind = useDrag(
    ({ movement: [mx], last, cancel }) => {
      // Only allow left swipe
      if (mx > 0) {
        cancel();
        return;
      }

      if (last) {
        if (mx < deleteThreshold) {
          setShowDelete(true);
          setOffset(deleteThreshold);
        } else {
          setOffset(0);
          setShowDelete(false);
        }
      } else {
        setOffset(Math.max(mx, deleteThreshold - 20));
      }
    },
    { axis: 'x', filterTaps: true }
  );

  const handleDelete = () => {
    hapticMedium();
    onDelete();
    setOffset(0);
    setShowDelete(false);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete button revealed on left swipe */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={handleDelete}
          className="bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
        >
          Delete
        </button>
      </div>

      {/* Swipeable content */}
      <div
        {...bind()}
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 || showDelete ? 'transform 0.2s ease' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
