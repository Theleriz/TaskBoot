import type { Quadrant, Status } from '../../data/model.ts';

export interface Zone<K extends string> {
  key: K;
  title: string;
  /** CSS color (a theme variable). */
  color: string;
}

/** F-10 / F-11 */
export const QUADRANT_ZONES: Zone<Quadrant>[] = [
  { key: 'q1', title: 'Важно · Срочно', color: 'var(--q1)' },
  { key: 'q2', title: 'Важно · Не срочно', color: 'var(--q2)' },
  { key: 'q3', title: 'Не важно · Срочно', color: 'var(--q3)' },
  { key: 'q4', title: 'Не важно · Не срочно', color: 'var(--q4)' },
];

/** F-20 */
export const STAGE_ZONES: Zone<Status>[] = [
  { key: 'todo', title: 'TODO', color: 'var(--muted)' },
  { key: 'doing', title: 'В работе', color: 'var(--accent)' },
  { key: 'done', title: 'Готово', color: 'var(--rest)' },
];

export const zoneTitle = (zones: Zone<string>[], key: string) =>
  zones.find((z) => z.key === key) ?? zones[0];
