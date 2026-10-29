// Statistics from the daily counters (schema 4) and the card review history (phase 1.5).
// Days are local calendar days, "YYYY-MM-DD" (data/activity.ts). Card reviews count on the
// calendar day of the answer, not the study day that starts at 4:00, so all metrics share days.

import { dayKey } from '../../data/activity.ts';
import { type AppData, type DayActivity, DAY_ACTIVITY_FIELDS } from '../../data/model.ts';

export interface DayStats extends DayActivity {
  /** Card answers that day. */
  reviews: number;
}

export const METRICS = [
  { key: 'all', title: 'Вся активность', unit: 'действий' },
  { key: 'tasksDone', title: 'Выполненные задачи', unit: 'задач' },
  { key: 'pomodoroMinutes', title: 'Минуты Pomodoro', unit: 'мин' },
  { key: 'reviews', title: 'Повторения карточек', unit: 'повторений' },
  { key: 'notesEdited', title: 'Заметки', unit: 'заметок' },
] as const;
export type MetricKey = (typeof METRICS)[number]['key'];

const emptyStats = (): DayStats => ({
  tasksCreated: 0,
  tasksDone: 0,
  pomodoroSessions: 0,
  pomodoroMinutes: 0,
  notesEdited: 0,
  reviews: 0,
});

/** Everything that happened, by day. */
export function dailyStats(d: AppData): Map<string, DayStats> {
  const days = new Map<string, DayStats>();
  const day = (key: string) => {
    let s = days.get(key);
    if (!s) days.set(key, (s = emptyStats()));
    return s;
  };
  for (const [key, activity] of Object.entries(d.activity)) {
    const s = day(key);
    for (const f of DAY_ACTIVITY_FIELDS) s[f] += activity[f];
  }
  for (const r of d.reviews) day(dayKey(r.at)).reviews += 1;
  return days;
}

/**
 * «Вся активность» counts actions: tasks done, finished Pomodoro sessions, card answers and
 * edited notes. Created tasks are left out — writing a task down is not getting it done.
 */
export function metricValue(s: DayStats | undefined, metric: MetricKey): number {
  if (!s) return 0;
  if (metric === 'all') return s.tasksDone + s.pomodoroSessions + s.reviews + s.notesEdited;
  return s[metric];
}

/** A day counts towards a streak when anything at all happened in it. */
export const isActive = (s: DayStats | undefined) =>
  s !== undefined && (Object.values(s) as number[]).some((v) => v > 0);

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Calendar arithmetic through Date keeps daylight-saving changes out of the way. */
export function addDays(day: string, n: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return dayKey(date.getTime());
}

/** Monday 0 … Sunday 6. */
export const weekdayOf = (day: string) => (parseDay(day).getDay() + 6) % 7;

/** The `n` days ending with `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/**
 * Columns of a calendar heatmap: weeks from Monday to Sunday, the last one holding `today`.
 * Days after today are null.
 */
export function heatmapWeeks(today: string, weeks: number): (string | null)[][] {
  const start = addDays(today, -weekdayOf(today) - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      return day > today ? null : day;
    }),
  );
}

/** The non-zero values in ascending order: the scale for levelOf(). */
export const levelScale = (values: number[]): number[] =>
  values.filter((v) => v > 0).sort((a, b) => a - b);

/**
 * 0 — nothing; 1…4 — from light to dark by rank among the busy days, so one very busy day does
 * not wash out all the others. The quietest day is 1, the busiest is 4.
 */
export function levelOf(value: number, scale: number[]): number {
  if (value <= 0) return 0;
  if (scale.length <= 1) return 4;
  const rank = scale.filter((v) => v <= value).length;
  return Math.min(4, 1 + Math.floor((3 * Math.max(0, rank - 1)) / (scale.length - 1)));
}

/**
 * Days in a row with any activity. The current streak is still alive when today is empty so
 * far: it then ends yesterday.
 */
export function streaks(days: Map<string, DayStats>, today: string) {
  let current = 0;
  for (
    let day = isActive(days.get(today)) ? today : addDays(today, -1);
    isActive(days.get(day));
    day = addDays(day, -1)
  ) {
    current += 1;
  }
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days.keys()].filter((k) => isActive(days.get(k))).sort()) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest };
}

/** Sum of a metric over some days. */
export const sumOver = (days: Map<string, DayStats>, keys: string[], metric: MetricKey) =>
  keys.reduce((sum, k) => sum + metricValue(days.get(k), metric), 0);

/** The first day with any data: statistics are collected since v2.3.0. */
export function firstDay(days: Map<string, DayStats>): string | null {
  const active = [...days.keys()].filter((k) => isActive(days.get(k))).sort();
  return active[0] ?? null;
}

/** Flashcards: answers over the last 30 days, the share not rated «Снова», review items by state. */
export function cardSummary(d: AppData, today: string) {
  const since = addDays(today, -29);
  const recent = d.reviews.filter((r) => dayKey(r.at) >= since);
  const items = { new: 0, learning: 0, review: 0 };
  for (const card of d.cards) {
    for (const s of Object.values(card.schedules)) {
      if (s.state === 0) items.new += 1;
      else if (s.state === 2) items.review += 1;
      else items.learning += 1;
    }
  }
  return {
    total: d.reviews.length,
    recent: recent.length,
    /** null when there were no answers. */
    recalled:
      recent.length === 0 ? null : recent.filter((r) => r.rating > 1).length / recent.length,
    items,
  };
}
