/**
 * Shared formatting utilities for currency and dates.
 * Used across expense lists, budget cards, charts, and dashboard.
 */

export function formatCurrency(amount: number, currency: string = 'PHP'): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
}

export function formatDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  // Append time to avoid timezone-shift on ISO date strings (YYYY-MM-DD)
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', options);
}

/** Returns the month label (e.g. 'Mar 2026') from a YYYY-MM string. */
export function formatMonth(monthStr: string): string {
  return new Date(`${monthStr}-01T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns the Tailwind / hex color to use for a budget progress bar based on
 * the percentage of budget consumed.
 *   < 75%  → green
 *   75-90% → yellow/amber
 *   > 90%  → red
 */
export function getBudgetProgressColor(percentage: number | null): string {
  if (percentage === null) return '#94a3b8'; // muted slate when no goal
  if (percentage > 90) return '#ef4444';
  if (percentage >= 75) return '#eab308';
  return '#22c55e';
}

/** Returns the YYYY-MM-DD string for the first day of the given month. */
export function monthToDateString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Returns YYYY-MM from a YYYY-MM-DD string. */
export function dateStringToMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}
