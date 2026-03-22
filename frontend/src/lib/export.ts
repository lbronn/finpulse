import type { Expense } from '@/types';

/**
 * Converts an array of expenses to a CSV string and triggers a browser download.
 *
 * Parameters:
 *   expenses: Expense[] — the list of expenses to export
 *
 * Output: Triggers browser file download of `finpulse-expenses-YYYY-MM-DD.csv`
 *
 * Dependencies: None (uses browser Blob + URL APIs only)
 */
export function exportExpensesToCSV(expenses: Expense[]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const headers = ['Date', 'Category', 'Amount', 'Description', 'Notes'].map(escape);

  const rows = expenses.map((e) => [
    escape(e.expense_date),
    escape(e.categories?.name ?? ''),
    e.amount.toFixed(2),
    escape(e.description),
    escape(e.notes ?? ''),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `finpulse-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();

  // Defer revoke so browser has time to initiate the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
