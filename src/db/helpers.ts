// Small shared utilities for the data layer.

// UUID for our TEXT primary keys (better-sqlite3 is gone, so we generate ids
// in JS rather than relying on rowid).
export const newId = (): string => crypto.randomUUID();

// ISO timestamp for created_at / updated_at columns.
export const nowIso = (): string => new Date().toISOString();

// Local 'YYYY-MM-DD' for the `date` column. Built from local parts on purpose:
// toISOString() would shift the date across the UTC boundary in the evening.
export function todayDate(): string {
  return formatDate(new Date());
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Shift a 'YYYY-MM-DD' string by whole days, staying in local time.
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return formatDate(date);
}
