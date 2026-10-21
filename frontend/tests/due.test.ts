import { describe, expect, it } from 'vitest';
import { daysUntil, getDueHint } from '../src/lib/due';

// Fixed "today": Tuesday 21 October 2025, mid-afternoon local time.
const TODAY = new Date(2025, 9, 21, 15, 30);

describe('getDueHint', () => {
  it.each([
    ['2025-10-21', 'due today', 'soon'],
    ['2025-10-22', 'in 1 day', 'soon'],
    ['2025-10-23', 'in 2 days', 'soon'],
    ['2025-10-24', 'in 3 days', 'normal'],
    ['2025-12-01', 'in 41 days', 'normal'],
    ['2025-10-20', '1 day overdue', 'overdue'],
    ['2025-10-19', '2 days overdue', 'overdue'],
    ['2024-10-21', '365 days overdue', 'overdue'],
  ])('%s -> %s (%s)', (due, label, tone) => {
    expect(getDueHint(due, 'todo', TODAY)).toEqual({ label, tone });
  });

  it('shows no hint for done tasks, missing dates or invalid dates', () => {
    expect(getDueHint('2025-10-19', 'done', TODAY)).toBeNull();
    expect(getDueHint(null, 'todo', TODAY)).toBeNull();
    expect(getDueHint('2025-02-30', 'todo', TODAY)).toBeNull();
    expect(getDueHint('soon', 'in_progress', TODAY)).toBeNull();
  });

  it('applies to in-progress tasks', () => {
    expect(getDueHint('2025-10-19', 'in_progress', TODAY)?.tone).toBe('overdue');
  });

  it('is unaffected by the time of day', () => {
    expect(getDueHint('2025-10-22', 'todo', new Date(2025, 9, 21, 0, 0, 1))?.label).toBe(
      'in 1 day',
    );
    expect(getDueHint('2025-10-22', 'todo', new Date(2025, 9, 21, 23, 59, 59))?.label).toBe(
      'in 1 day',
    );
  });

  it('counts across month and leap-year boundaries', () => {
    expect(daysUntil('2024-03-01', new Date(2024, 1, 28))).toBe(2);
    expect(daysUntil('2026-01-01', new Date(2025, 11, 31))).toBe(1);
  });
});
