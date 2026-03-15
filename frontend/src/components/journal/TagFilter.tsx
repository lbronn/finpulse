import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  allTags: string[];
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export default function TagFilter({ allTags, activeTag, onTagSelect }: Props) {
  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground">Filter:</span>
      {activeTag && (
        <Button variant="ghost" size="sm" onClick={() => onTagSelect(null)}>
          Clear
        </Button>
      )}
      {allTags.map((tag) => (
        <Badge
          key={tag}
          variant={activeTag === tag ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => onTagSelect(activeTag === tag ? null : tag)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
