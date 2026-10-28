import { describe, expect, it } from 'vitest';
import { clozeNumbers, nextClozeNumber } from './cloze.ts';
import { importData } from './exchange.ts';
import { BASIC_SLOT, REVIEW_LOG_LIMIT } from './model.ts';
import { createEmptyData, normalizeAppData } from './normalize.ts';
import { newSchedule, previewDue, review } from './scheduler.ts';
import { migrate } from './schema.ts';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const NOW = Date.UTC(2026, 9, 22, 10, 0);

describe('cloze', () => {
  it('finds gap numbers, with or without hints', () => {
    expect(clozeNumbers('{{c2::Париж}} — столица {{c1::Франции::страна}}, {{c2::да}}')).toEqual([
      '1',
      '2',
    ]);
    expect(clozeNumbers('нет пропусков, {{c0::ноль}} и {c1::не то}')).toEqual([]);
    expect(nextClozeNumber('{{c1::a}} {{c3::b}}')).toBe(4);
    expect(nextClozeNumber('')).toBe(1);
  });

  it('allows formulas inside a gap', () => {
    expect(clozeNumbers('Площадь круга: {{c1::$S = \\pi r^2$}}')).toEqual(['1']);
  });
});

describe('scheduler (FSRS)', () => {
  it('starts new items due right away', () => {
    expect(newSchedule(NOW)).toMatchObject({ due: NOW, state: 0, reps: 0, lastReview: null });
  });

  it('moves an item through learning to review and spaces reviews out', () => {
    let s = newSchedule(NOW);
    s = review(s, 3, NOW);
    expect(s.state).toBe(1);
    expect(s.due - NOW).toBeLessThan(DAY);

    let now = s.due;
    s = review(s, 3, now);
    expect(s.state).toBe(2);
    const first = s.scheduledDays;
    expect(first).toBeGreaterThanOrEqual(1);

    now = s.due;
    s = review(s, 3, now);
    expect(s.scheduledDays).toBeGreaterThan(first);
    expect(s.reps).toBe(3);
    expect(s.lastReview).toBe(now);
  });

  it('sends a forgotten review back to relearning', () => {
    let s = review(review(newSchedule(NOW), 4, NOW), 3, NOW + 10 * DAY);
    expect(s.state).toBe(2);
    s = review(s, 1, s.due);
    expect(s).toMatchObject({ state: 3, lapses: 1 });
  });

  it('previews later due dates for better answers', () => {
    const p = previewDue(newSchedule(NOW), NOW);
    expect(p[1]).toBeLessThanOrEqual(p[2]);
    expect(p[2]).toBeLessThanOrEqual(p[3]);
    expect(p[3]).toBeLessThan(p[4]);
  });

  it('gives the same result for the same inputs', () => {
    const s = review(newSchedule(NOW), 4, NOW);
    expect(review(s, 3, NOW + 5 * DAY)).toEqual(review(s, 3, NOW + 5 * DAY));
  });
});

describe('schema 3', () => {
  it('adds empty flashcard lists and the daily limit to older data', () => {
    expect(migrate({ schemaVersion: 2, notes: [] })).toMatchObject({
      decks: [],
      cards: [],
      reviews: [],
    });
    const data = importData(JSON.stringify({ schemaVersion: 2, tasks: [{ id: 't', title: 'T' }] }));
    expect(data).toMatchObject({ decks: [], cards: [], reviews: [] });
    expect(data.settings.newCardsPerDay).toBe(20);
    expect(data.tasks[0]?.title).toBe('T');
  });

  it('keeps schedules for existing review items and creates the missing ones', () => {
    const studied = review(newSchedule(NOW), 3, NOW);
    const data = normalizeAppData(
      {
        decks: [{ id: 'd', name: 'Колода' }],
        cards: [
          {
            id: 'c',
            deckId: 'd',
            kind: 'cloze',
            front: '{{c1::a}} {{c2::b}}',
            schedules: { '1': studied, '9': studied },
          },
        ],
      },
      NOW,
    );
    const card = data.cards[0]!;
    expect(Object.keys(card.schedules)).toEqual(['1', '2']);
    expect(card.schedules['1']).toEqual(studied);
    expect(card.schedules['2']).toMatchObject({ state: 0, due: NOW });
  });

  it('repairs broken cards without losing them', () => {
    const data = normalizeAppData(
      {
        notes: [{ id: 'n', title: 'Note' }],
        decks: [{ id: 'd', name: '' }],
        cards: [
          { id: 'a', deckId: 'gone', kind: 'cloze', front: 'без пропусков', noteId: 'n' },
          { id: 'b', deckId: 'gone', front: '   ' },
          { id: 'c', deckId: 'gone', front: 'Q', noteId: 'missing', schedules: 'x' },
        ],
        reviews: [
          { cardId: 'a', slot: '0', rating: 3, state: 0, at: 1 },
          { cardId: 'b', slot: '0', rating: 3, state: 0, at: 2 },
          { cardId: 'a', slot: '0', rating: 7, state: 0, at: 3 },
        ],
      },
      NOW,
    );
    expect(data.decks.map((x) => x.name)).toEqual(['Без колоды']);
    expect(data.cards.map((c) => [c.id, c.kind, c.noteId, Object.keys(c.schedules)])).toEqual([
      ['a', 'basic', 'n', [BASIC_SLOT]],
      ['c', 'basic', null, [BASIC_SLOT]],
    ]);
    expect(data.cards.every((c) => c.deckId === data.decks[0]?.id)).toBe(true);
    expect(data.reviews).toEqual([{ cardId: 'a', slot: '0', rating: 3, state: 0, at: 1 }]);
  });

  it('caps the review history and clamps the daily limit', () => {
    const reviews = Array.from({ length: REVIEW_LOG_LIMIT + 5 }, (_, i) => ({
      cardId: 'c',
      slot: '0',
      rating: 3,
      state: 2,
      at: i,
    }));
    const data = normalizeAppData({
      decks: [{ id: 'd', name: 'D' }],
      cards: [{ id: 'c', deckId: 'd', front: 'Q' }],
      reviews,
      settings: { newCardsPerDay: 0 },
    });
    expect(data.reviews).toHaveLength(REVIEW_LOG_LIMIT);
    expect(data.reviews[0]?.at).toBe(5);
    expect(data.settings.newCardsPerDay).toBe(0);
    expect(normalizeAppData({ settings: { newCardsPerDay: 5000 } }).settings.newCardsPerDay).toBe(
      999,
    );
    expect(createEmptyData().settings.newCardsPerDay).toBe(20);
  });
});
