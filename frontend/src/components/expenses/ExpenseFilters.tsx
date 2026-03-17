import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { Category, ExpenseFilters as Filters } from '@/types';

interface Props {
  categories: Category[];
  onFiltersChange: (filters: Filters) => void;
}

export default function ExpenseFilters({ categories, onFiltersChange }: Props) {
  const [categoryId, setCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const applyFilters = () => {
    onFiltersChange({
      categoryId: categoryId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  const clearFilters = () => {
    setCategoryId('');
    setStartDate('');
    setEndDate('');
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Category</Label>
        <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? '')}>
          <SelectTrigger className="w-44">
            {categoryId
              ? <span>{categories.find((c) => c.id === categoryId)?.name}</span>
              : <span className="text-muted-foreground">All categories</span>}
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
      </div>
      <Button variant="secondary" size="sm" onClick={applyFilters}>Apply</Button>
      <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
    </div>
  );
}
