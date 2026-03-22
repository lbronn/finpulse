import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import JournalList from '@/components/journal/JournalList';
import JournalForm from '@/components/journal/JournalForm';
import TagFilter from '@/components/journal/TagFilter';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import type { JournalEntry } from '@/types';

export default function JournalPage() {
  const { entries, loading, error, fetchEntries, createEntry, updateEntry, deleteEntry } = useJournalEntries();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<JournalEntry | undefined>(undefined);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries(activeTag ?? undefined);
  }, [fetchEntries, activeTag]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [entries]);

  const handleEdit = (entry: JournalEntry) => {
    setEditTarget(entry);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditTarget(undefined);
  };

  const handleSubmit = async (data: Parameters<typeof createEntry>[0]) => {
    if (editTarget) {
      await updateEntry(editTarget.id, data);
    } else {
      await createEntry(data);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Journal</h1>
        <Button className="min-h-[44px]" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New entry
        </Button>
      </div>

      <div className="mb-4">
        <TagFilter allTags={allTags} activeTag={activeTag} onTagSelect={setActiveTag} />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <JournalList entries={entries} loading={loading} onEdit={handleEdit} onDelete={deleteEntry} />

      <JournalForm open={formOpen} onOpenChange={handleFormClose} onSubmit={handleSubmit} initialData={editTarget} />
    </div>
  );
}
