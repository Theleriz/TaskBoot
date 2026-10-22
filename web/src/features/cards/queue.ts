// What to study next. Pure functions of the data and the current time.
//
// A study day starts at 4:00 local time, as in Anki, so a late-night session counts as the
// same day. Order within a session: learning items that are due, then reviews due today,
// then new items (up to the daily limit per deck), then learning items due within 20 minutes —
// so a session does not end just because the next learning step is a few minutes away.

import type { AppData, Flashcard, Schedule } from '../../data/model.ts';

export const DAY_START_HOUR = 4;
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/** The start of the study day `now` belongs to. */
export function studyDayStart(now: number): number {
  const d = new Date(now);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

export function nextStudyDayStart(now: number): number {
  const d = new Date(studyDayStart(now));
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export interface StudyItem {
  card: Flashcard;
  slot: string;
  schedule: Schedule;
}

export interface DeckCounts {
  /** New items still allowed today. */
  new: number;
  /** Items in (re)learning due today. */
  learning: number;
  /** Reviews due today. */
  review: number;
}

/** null — all decks. */
export type DeckScope = string | null;

const inScope = (card: Flashcard, scope: DeckScope) => scope === null || card.deckId === scope;

function items(d: AppData, scope: DeckScope): StudyItem[] {
  const out: StudyItem[] = [];
  for (const card of d.cards) {
    if (!inScope(card, scope)) continue;
    for (const [slot, schedule] of Object.entries(card.schedules))
      out.push({ card, slot, schedule });
  }
  return out;
}

/** New items each deck may still introduce today. */
function newQuota(d: AppData, now: number): Map<string, number> {
  const since = studyDayStart(now);
  const deckOf = new Map(d.cards.map((c) => [c.id, c.deckId]));
  const used = new Map<string, number>();
  for (const r of d.reviews) {
    if (r.state !== 0 || r.at < since) continue;
    const deck = deckOf.get(r.cardId);
    if (deck) used.set(deck, (used.get(deck) ?? 0) + 1);
  }
  const limit = d.settings.newCardsPerDay;
  return new Map(d.decks.map((x) => [x.id, Math.max(0, limit - (used.get(x.id) ?? 0))]));
}

const byDue = (a: StudyItem, b: StudyItem) => a.schedule.due - b.schedule.due;
const byCreation = (a: StudyItem, b: StudyItem) =>
  a.card.createdAt - b.card.createdAt ||
  a.card.id.localeCompare(b.card.id) ||
  Number(a.slot) - Number(b.slot);

function newItemsAllowed(d: AppData, all: StudyItem[], now: number): StudyItem[] {
  const quota = newQuota(d, now);
  const allowed: StudyItem[] = [];
  for (const item of all.filter((i) => i.schedule.state === 0).sort(byCreation)) {
    const left = quota.get(item.card.deckId) ?? 0;
    if (left <= 0) continue;
    quota.set(item.card.deckId, left - 1);
    allowed.push(item);
  }
  return allowed;
}

const isLearning = (i: StudyItem) => i.schedule.state === 1 || i.schedule.state === 3;

export function deckCounts(d: AppData, scope: DeckScope, now: number): DeckCounts {
  const all = items(d, scope);
  const dayEnd = nextStudyDayStart(now);
  return {
    new: newItemsAllowed(d, all, now).length,
    learning: all.filter((i) => isLearning(i) && i.schedule.due < dayEnd).length,
    review: all.filter((i) => i.schedule.state === 2 && i.schedule.due < dayEnd).length,
  };
}

/** The item to show now, or null when the session is over. */
export function nextItem(d: AppData, scope: DeckScope, now: number): StudyItem | null {
  const all = items(d, scope);
  const dayEnd = nextStudyDayStart(now);
  const learning = all.filter(isLearning).sort(byDue);
  return (
    learning.find((i) => i.schedule.due <= now) ??
    all.filter((i) => i.schedule.state === 2 && i.schedule.due < dayEnd).sort(byDue)[0] ??
    newItemsAllowed(d, all, now)[0] ??
    learning.find((i) => i.schedule.due <= now + LEARN_AHEAD_MS) ??
    null
  );
}

/** When the next item of the scope becomes due (to tell the user when to come back). */
export function nextDue(d: AppData, scope: DeckScope): number | null {
  const dues = items(d, scope)
    .filter((i) => i.schedule.state !== 0)
    .map((i) => i.schedule.due);
  return dues.length ? Math.min(...dues) : null;
}
