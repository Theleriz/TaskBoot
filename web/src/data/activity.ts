// Daily activity counters (phase 2): the source of the statistics tab.
// Days are local calendar days, "YYYY-MM-DD"; a day exists only once something happened.

import type { AppData, DayActivity } from './model.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a moment. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const emptyDay = (): DayActivity => ({
  tasksCreated: 0,
  tasksDone: 0,
  pomodoroSessions: 0,
  pomodoroMinutes: 0,
  notesEdited: 0,
});

/** Adds `delta` to a counter of the day of `at`; counters never go below zero. */
export function countActivity(d: AppData, at: number, field: keyof DayActivity, delta = 1) {
  const key = dayKey(at);
  const day = d.activity[key] ?? emptyDay();
  day[field] = Math.max(0, day[field] + delta);
  d.activity[key] = day;
}
