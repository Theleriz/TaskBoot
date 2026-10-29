import { describe, expect, it } from 'vitest';
import { importData } from '../../data/exchange.ts';
import { createEmptyData, normalizeAppData } from '../../data/normalize.ts';
import { CURRENT_SCHEMA_VERSION, migrate } from '../../data/schema.ts';
import {
  addDays,
  cardSummary,
  dailyStats,
  firstDay,
  heatmapWeeks,
  lastDays,
  levelScale,
  levelOf,
  metricValue,
  streaks,
  sumOver,
  weekdayOf,
} from './stats.ts';

const at = (day: string, hour = 12) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour).getTime();
};

const day = (fields: Record<string, number>) => ({
  tasksCreated: 0,
  tasksDone: 0,
  pomodoroSessions: 0,
  pomodoroMinutes: 0,
  notesEdited: 0,
  ...fields,
});

describe('schema 6', () => {
  it('adds «Статистика» at the end of «Основное» only', () => {
    const v5 = {
      schemaVersion: 5,
      settings: {
        workspaces: [
          { id: 'main', name: 'Основное', tabs: ['matrix', 'backlog'] },
          { id: 'w', name: 'Учёба', tabs: ['cards'] },
        ],
      },
    };
    expect(migrate(v5)).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION });
    expect(importData(JSON.stringify(v5)).settings.workspaces.map((w) => w.tabs)).toEqual([
      ['matrix', 'backlog', 'stats'],
      ['cards'],
    ]);
    const twice = importData(
      JSON.stringify({
        schemaVersion: 5,
        settings: { workspaces: [{ id: 'main', name: 'Основное', tabs: ['stats', 'matrix'] }] },
      }),
    );
    expect(twice.settings.workspaces[0]?.tabs).toEqual(['stats', 'matrix']);
  });

  it('upgrades data without settings', () => {
    expect(importData(JSON.stringify({ schemaVersion: 5 })).settings.workspaces[0]?.tabs).toContain(
      'stats',
    );
  });
});

describe('calendar helpers', () => {
  it('steps over months and years and tells weekdays (Monday first)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekdayOf('2026-10-26')).toBe(0); // Monday
    expect(weekdayOf('2026-11-01')).toBe(6); // Sunday
    expect(lastDays('2026-10-29', 3)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
  });

  it('lays out weeks from Monday to Sunday, the last one holding today', () => {
    const weeks = heatmapWeeks('2026-10-29', 3); // a Thursday
    expect(weeks).toHaveLength(3);
    expect(weeks[0]![0]).toBe('2026-10-12');
    expect(weeks[2]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      null,
      null,
      null,
    ]);
  });
});

describe('daily statistics', () => {
  it('joins the counters and card answers by day', () => {
    const d = normalizeAppData({
      activity: { '2026-10-28': day({ tasksDone: 2, pomodoroSessions: 1, pomodoroMinutes: 45 }) },
      decks: [{ id: 'd', name: 'D' }],
      cards: [{ id: 'c', deckId: 'd', kind: 'basic', front: 'Q' }],
      reviews: [
        { cardId: 'c', slot: '0', rating: 3, state: 0, at: at('2026-10-28') },
        { cardId: 'c', slot: '0', rating: 1, state: 1, at: at('2026-10-29', 1) },
      ],
    });
    const days = dailyStats(d);
    expect(metricValue(days.get('2026-10-28'), 'all')).toBe(2 + 1 + 1);
    expect(metricValue(days.get('2026-10-28'), 'pomodoroMinutes')).toBe(45);
    // An answer at 1:00 belongs to that calendar day.
    expect(metricValue(days.get('2026-10-29'), 'reviews')).toBe(1);
    expect(metricValue(undefined, 'all')).toBe(0);
    expect(sumOver(days, ['2026-10-28', '2026-10-29'], 'reviews')).toBe(2);
    expect(firstDay(days)).toBe('2026-10-28');
  });

  it('does not count a created task as activity of «all», but as a streak day', () => {
    const days = dailyStats(
      normalizeAppData({ activity: { '2026-10-29': day({ tasksCreated: 3 }) } }),
    );
    expect(metricValue(days.get('2026-10-29'), 'all')).toBe(0);
    expect(streaks(days, '2026-10-29').current).toBe(1);
  });

  it('counts streaks; today without activity does not break the current one', () => {
    const active = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-27', '2026-10-28'];
    const days = dailyStats(
      normalizeAppData({
        activity: Object.fromEntries(active.map((k) => [k, day({ notesEdited: 1 })])),
      }),
    );
    expect(streaks(days, '2026-10-29')).toEqual({ current: 2, longest: 3 });
    expect(streaks(days, '2026-10-30')).toEqual({ current: 0, longest: 3 });
    expect(streaks(dailyStats(createEmptyData()), '2026-10-29')).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it('puts values into four levels by rank among busy days', () => {
    const scale = levelScale([0, 7, 1, 2, 3, 4, 5, 6, 100]);
    expect(scale).toEqual([1, 2, 3, 4, 5, 6, 7, 100]);
    // One very busy day does not push all the others to the lightest level.
    expect([0, 1, 3, 5, 7, 100].map((v) => levelOf(v, scale))).toEqual([0, 1, 1, 2, 3, 4]);
    expect([3, 4, 5].map((v) => levelOf(v, [3, 4, 5]))).toEqual([1, 2, 4]);
    expect(levelOf(2, [2])).toBe(4);
    expect(levelOf(0, [])).toBe(0);
  });

  it('summarizes flashcards over 30 days', () => {
    const d = normalizeAppData({
      decks: [{ id: 'd', name: 'D' }],
      cards: [
        {
          id: 'a',
          deckId: 'd',
          kind: 'cloze',
          front: '{{c1::x}} {{c2::y}} {{c3::z}}',
          schedules: { 1: { state: 2 }, 2: { state: 3 } },
        },
      ],
      reviews: [
        { cardId: 'a', slot: '1', rating: 3, state: 0, at: at('2026-10-29') },
        { cardId: 'a', slot: '2', rating: 1, state: 2, at: at('2026-10-20') },
        { cardId: 'a', slot: '1', rating: 4, state: 2, at: at('2026-09-01') },
      ],
    });
    expect(cardSummary(d, '2026-10-29')).toEqual({
      total: 3,
      recent: 2,
      recalled: 0.5,
      items: { new: 1, learning: 1, review: 1 },
    });
    expect(cardSummary(createEmptyData(), '2026-10-29').recalled).toBeNull();
  });
});
