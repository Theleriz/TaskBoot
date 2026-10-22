import { describe, expect, it } from 'vitest';
import type { AppData } from '../../data/model.ts';
import { createEmptyData } from '../../data/normalize.ts';
import { addCard, addDeck, answerCard } from '../../state/ops.ts';
import { deckCounts, nextItem, studyDayStart } from './queue.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// 22 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 22, 10, 0).getTime();

function data(newPerDay = 20): AppData {
  const d = createEmptyData();
  d.settings.newCardsPerDay = newPerDay;
  addDeck(d, 'Английский', 'en', NOW);
  addDeck(d, 'Физика', 'ph', NOW);
  addCard(d, { deckId: 'en', kind: 'basic', front: 'cat', back: 'кошка' }, 'c1', NOW);
  addCard(d, { deckId: 'en', kind: 'basic', front: 'dog', back: 'собака' }, 'c2', NOW + 1);
  addCard(
    d,
    { deckId: 'ph', kind: 'cloze', front: '{{c1::E}} = {{c2::mc^2}}', back: '' },
    'c3',
    NOW + 2,
  );
  return d;
}

describe('study day', () => {
  it('starts at 4:00, so a night session belongs to the previous day', () => {
    expect(studyDayStart(NOW)).toBe(new Date(2026, 9, 22, 4, 0).getTime());
    const night = new Date(2026, 9, 23, 2, 30).getTime();
    expect(studyDayStart(night)).toBe(new Date(2026, 9, 22, 4, 0).getTime());
  });
});

describe('study queue', () => {
  it('counts new items per deck and in all decks', () => {
    const d = data();
    expect(deckCounts(d, 'en', NOW)).toEqual({ new: 2, learning: 0, review: 0 });
    expect(deckCounts(d, 'ph', NOW)).toEqual({ new: 2, learning: 0, review: 0 });
    expect(deckCounts(d, null, NOW)).toEqual({ new: 4, learning: 0, review: 0 });
  });

  it('shows new items in the order they were added', () => {
    const d = data();
    expect(nextItem(d, null, NOW)).toMatchObject({ card: { id: 'c1' }, slot: '0' });
    expect(nextItem(d, 'ph', NOW)).toMatchObject({ card: { id: 'c3' }, slot: '1' });
  });

  it('respects the daily limit of new items per deck', () => {
    const d = data(1);
    expect(deckCounts(d, null, NOW).new).toBe(2);
    answerCard(d, 'c1', '0', 4, NOW);
    expect(deckCounts(d, 'en', NOW).new).toBe(0);
    expect(nextItem(d, 'en', NOW + MINUTE)).toBeNull();
    // A new study day brings a new allowance.
    expect(deckCounts(d, 'en', NOW + 24 * HOUR).new).toBe(1);
  });

  it('brings learning items back first and looks a little ahead at the end', () => {
    const d = data(1);
    answerCard(d, 'c1', '0', 1, NOW);
    const due = d.cards[0]!.schedules['0']!.due;
    expect(deckCounts(d, 'en', NOW).learning).toBe(1);
    // Nothing else left in the deck: the learning item is shown a bit early.
    expect(nextItem(d, 'en', NOW + 1000)).toMatchObject({ card: { id: 'c1' } });
    // With other work available, that comes first until the item is due.
    d.settings.newCardsPerDay = 2;
    expect(nextItem(d, 'en', NOW + 1000)).toMatchObject({ card: { id: 'c2' } });
    expect(nextItem(d, 'en', due)).toMatchObject({ card: { id: 'c1' } });
  });

  it('lists reviews due today and hides the ones due later', () => {
    const d = data();
    answerCard(d, 'c1', '0', 4, NOW);
    const schedule = d.cards[0]!.schedules['0']!;
    expect(schedule.state).toBe(2);
    expect(deckCounts(d, 'en', NOW).review).toBe(0);
    expect(deckCounts(d, 'en', schedule.due).review).toBe(1);
    expect(nextItem(d, 'en', schedule.due)).toMatchObject({ card: { id: 'c1' } });
  });
});
