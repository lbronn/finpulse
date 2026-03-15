import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TagInput from './TagInput';
import type { JournalEntry, JournalEntryFormData } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: JournalEntryFormData) => Promise<void>;
  initialData?: JournalEntry;
}

const today = new Date().toISOString().split('T')[0];

export default function JournalForm({ open, onOpenChange, onSubmit, initialData }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [entryDate, setEntryDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      setTags(initialData.tags ?? []);
      setEntryDate(initialData.entry_date);
    } else {
      setTitle('');
      setContent('');
      setTags([]);
      setEntryDate(today);
    }
    setError(null);
  }, [initialData, open]);

  const handleSubmit = async () => {
    setError(null);

    if (!title.trim()) { setError('Title is required.'); return; }
    if (!content.trim()) { setError('Content is required.'); return; }
    if (!entryDate) { setError('Date is required.'); return; }

    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim(), tags, entry_date: entryDate });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Entry' : 'New Journal Entry'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened today?" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Content *</Label>
            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your thoughts..." rows={6} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entryDate">Date *</Label>
            <Input id="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : initialData ? 'Save changes' : 'Add entry'}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
