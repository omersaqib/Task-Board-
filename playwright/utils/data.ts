import { randomUUID } from 'node:crypto';

export const VALID_PASSWORD = 'Passw0rd-secret1';

/** Unique per call, so tests never collide on shared state. */
export function uniqueId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export function uniqueEmail(prefix = 'qa'): string {
  return `${prefix}.${uniqueId()}@example.com`;
}

export function uniqueTitle(prefix = 'Task'): string {
  return `${prefix} ${uniqueId()}`;
}

/** YYYY-MM-DD, `days` from today (UTC). */
export function isoDate(days = 7): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
