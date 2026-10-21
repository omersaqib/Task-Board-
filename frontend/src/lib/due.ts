import type { TaskStatus } from './api';

export type DueTone = 'normal' | 'soon' | 'overdue';

export interface DueHint {
  label: string;
  tone: DueTone;
}

/** A task counts as "soon" when it is due within this many days (and not overdue). */
export const SOON_DAYS = 2;

const DAY_MS = 86_400_000;

function dayNumber(year: number, month: number, day: number) {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Whole days from `today` (local calendar date) to `dueDate` (YYYY-MM-DD); null if unparsable. */
export function daysUntil(dueDate: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const due = new Date(Date.UTC(year, month - 1, day));
  if (
    due.getUTCFullYear() !== year ||
    due.getUTCMonth() !== month - 1 ||
    due.getUTCDate() !== day
  ) {
    return null;
  }
  return (
    dayNumber(year, month, day) -
    dayNumber(today.getFullYear(), today.getMonth() + 1, today.getDate())
  );
}

const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Relative due-date hint ("due today", "in 3 days", "2 days overdue"), or null when there is
 * nothing to show (no due date, task done, invalid date). `today` is injectable for tests.
 */
export function getDueHint(
  dueDate: string | null,
  status: TaskStatus,
  today: Date = new Date(),
): DueHint | null {
  if (!dueDate || status === 'done') return null;
  const diff = daysUntil(dueDate, today);
  if (diff === null) return null;
  if (diff < 0) return { label: `${plural(-diff)} overdue`, tone: 'overdue' };
  if (diff === 0) return { label: 'due today', tone: 'soon' };
  return { label: `in ${plural(diff)}`, tone: diff <= SOON_DAYS ? 'soon' : 'normal' };
}
