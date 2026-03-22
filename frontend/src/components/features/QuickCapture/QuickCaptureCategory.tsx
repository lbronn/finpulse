/**
 * Summary: A tappable category badge that opens a dropdown to change the category.
 * Used inside the QuickCapturePreview card to let users correct the AI-suggested category.
 *
 * Props:
 *   categories     — Full list of available categories
 *   selectedId     — Currently selected category ID (or null)
 *   selectedName   — Currently selected category name (or null)
 *   selectedColor  — Currently selected category color hex (or null)
 *   onChange       — Called with (id, name) when user picks a new category
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Category } from '@/types';

interface QuickCaptureCategoryProps {
  categories: Category[];
  selectedId: string | null;
  selectedName: string | null;
  selectedColor: string | null;
  onChange: (id: string, name: string) => void;
}

export function QuickCaptureCategory({
  categories,
  selectedId,
  selectedName,
  selectedColor,
  onChange,
}: QuickCaptureCategoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white min-h-[32px] transition-opacity hover:opacity-80"
          style={{ backgroundColor: selectedColor ?? '#6b7280' }}
          aria-label="Change category"
        >
          {selectedName ?? 'Select category'}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
        {categories.map((cat) => (
          <DropdownMenuItem
            key={cat.id}
            onSelect={() => {
              onChange(cat.id, cat.name);
              setOpen(false);
            }}
            className={`flex items-center gap-2 ${cat.id === selectedId ? 'font-semibold' : ''}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cat.color ?? '#6b7280' }}
            />
            {cat.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
